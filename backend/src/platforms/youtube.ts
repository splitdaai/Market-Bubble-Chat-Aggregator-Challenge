import { BaseConnector } from "./types.ts";
import type { ChatMessage, ModerationRequest, ModerationResult, Badge } from "../../../shared/types.ts";

/**
 * YouTube Live chat connector via the Data API v3.
 *
 * Resolves the active live-chat id from a live video, then long-polls
 * liveChat/messages honoring the API's `pollingIntervalMillis` + page tokens.
 * Read needs an API key (YOUTUBE_API_KEY) and the channel must currently be live
 * (an active broadcast `videoId` in YOUTUBE_VIDEO_ID).
 *
 * Moderation needs an OAuth user token with the manage scope — left as a seam.
 */
const API = "https://www.googleapis.com/youtube/v3";

interface LiveChatItem {
  id: string;
  snippet?: { displayMessage?: string; publishedAt?: string };
  authorDetails?: {
    displayName?: string;
    profileImageUrl?: string;
    isChatModerator?: boolean;
    isChatSponsor?: boolean;
    isChatOwner?: boolean;
  };
}

export class YouTubeConnector extends BaseConnector {
  readonly platform = "youtube" as const;
  private liveChatId: string | null = null;
  private pageToken: string | undefined;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  // Either a public video id + API key, OR a connected account's OAuth token
  // (which lets us auto-find that channel's active live broadcast).
  constructor(private opts: { videoId?: string; apiKey?: string; oauthToken?: string; label?: string; refresh?: () => Promise<string | null> }) {
    super("youtube", opts.label ?? opts.videoId ?? "live");
  }

  /** Auth a Data API request — Bearer for OAuth accounts, key param otherwise. */
  private authed(url: URL): RequestInit {
    if (this.opts.oauthToken) return { headers: { Authorization: `Bearer ${this.opts.oauthToken}` } };
    if (this.opts.apiKey) url.searchParams.set("key", this.opts.apiKey);
    return {};
  }

  private label() {
    return this.opts.label ?? this.opts.videoId ?? "live";
  }

  async start() {
    this.stopped = false;
    void this.tryBegin();
  }

  /** YouTube live chat only exists while the channel is actively broadcasting.
   *  If there's no active stream yet, keep re-checking so chat starts flowing
   *  the moment the user goes live — instead of giving up at startup and
   *  requiring a restart. */
  private async tryBegin() {
    if (this.stopped) return;
    this.liveChatId = await this.resolveLiveChatId();
    if (!this.liveChatId) {
      this.setStatus({ connected: false, error: "no_active_live_chat" });
      console.log(`· youtube:${this.label()} — no active live broadcast; re-checking in 60s`);
      this.timer = setTimeout(() => void this.tryBegin(), 60_000);
      return;
    }
    console.log(`✓ youtube:${this.label()} — active live chat found, streaming messages`);
    this.pageToken = undefined;
    this.setStatus({ connected: true });
    void this.poll();
  }

  /** GET a Data API url, refreshing the OAuth token once on a 401. */
  private async ytGet(url: URL): Promise<Response> {
    let r = await fetch(url, this.authed(url));
    if (r.status === 401 && this.opts.refresh) {
      const fresh = await this.opts.refresh();
      if (fresh) { this.opts.oauthToken = fresh; r = await fetch(url, this.authed(url)); }
    }
    return r;
  }

  /** Resolve the live-chat id — from the OAuth account's own live broadcast or
   *  from a public video id.
   *
   *  YouTube only marks a broadcast `active` once it fully transitions to *live*,
   *  but "Stream now"/preview streams sit in `ready`/`upcoming` with a fully open,
   *  chattable live chat. So we gather candidates across active + upcoming and,
   *  when there's more than one, pick the broadcast that's really being used:
   *  truly-live first, then the one whose bound stream is actively ingesting,
   *  then the chat with the most recent messages. */
  private async resolveLiveChatId(): Promise<string | null> {
    try {
      if (!this.opts.oauthToken) {
        const url = new URL(`${API}/videos`);
        url.searchParams.set("part", "liveStreamingDetails");
        url.searchParams.set("id", this.opts.videoId ?? "");
        const r = await this.ytGet(url);
        if (!r.ok) return null;
        const d = (await r.json()) as { items?: { liveStreamingDetails?: { activeLiveChatId?: string } }[] };
        return d.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
      }

      const cands: { liveChatId: string; life?: string; boundStreamId?: string }[] = [];
      for (const st of ["active", "upcoming"] as const) {
        const url = new URL(`${API}/liveBroadcasts`);
        url.searchParams.set("part", "snippet,status,contentDetails");
        url.searchParams.set("broadcastStatus", st);
        url.searchParams.set("broadcastType", "all");
        url.searchParams.set("maxResults", "20");
        const r = await this.ytGet(url);
        if (!r.ok) continue;
        const d = (await r.json()) as {
          items?: { snippet?: { liveChatId?: string }; status?: { lifeCycleStatus?: string }; contentDetails?: { boundStreamId?: string } }[];
        };
        for (const it of d.items ?? []) {
          const liveChatId = it.snippet?.liveChatId;
          if (liveChatId) cands.push({ liveChatId, life: it.status?.lifeCycleStatus, boundStreamId: it.contentDetails?.boundStreamId });
        }
      }
      if (cands.length === 0) return null;
      if (cands.length === 1) return cands[0].liveChatId;

      // 1) a broadcast YouTube already considers live
      const live = cands.find((c) => c.life === "live" || c.life === "liveStarting");
      if (live) return live.liveChatId;
      // 2) the broadcast whose bound stream is actively receiving video
      const ingesting = await this.firstIngestingChat(cands);
      if (ingesting) return ingesting;
      // 3) the chat that's actually getting messages right now
      const active = await this.mostActiveChat(cands.map((c) => c.liveChatId));
      return active ?? cands[0].liveChatId;
    } catch {
      return null;
    }
  }

  /** Of the candidates, the live-chat id whose bound stream is actively
   *  ingesting video (streamStatus "active") — the one really being broadcast. */
  private async firstIngestingChat(cands: { liveChatId: string; boundStreamId?: string }[]): Promise<string | null> {
    const ids = cands.map((c) => c.boundStreamId).filter(Boolean) as string[];
    if (ids.length === 0) return null;
    try {
      const url = new URL(`${API}/liveStreams`);
      url.searchParams.set("part", "status");
      url.searchParams.set("id", ids.join(","));
      url.searchParams.set("maxResults", "50");
      const r = await this.ytGet(url);
      if (!r.ok) return null;
      const d = (await r.json()) as { items?: { id?: string; status?: { streamStatus?: string } }[] };
      const activeStream = d.items?.find((s) => s.status?.streamStatus === "active")?.id;
      if (!activeStream) return null;
      return cands.find((c) => c.boundStreamId === activeStream)?.liveChatId ?? null;
    } catch {
      return null;
    }
  }

  /** Poll each candidate chat once; return the one with the newest message. */
  private async mostActiveChat(chatIds: string[]): Promise<string | null> {
    let best: { id: string; ts: number } | null = null;
    for (const id of chatIds) {
      try {
        const url = new URL(`${API}/liveChat/messages`);
        url.searchParams.set("liveChatId", id);
        url.searchParams.set("part", "snippet");
        url.searchParams.set("maxResults", "200");
        const r = await this.ytGet(url);
        if (!r.ok) continue;
        const d = (await r.json()) as { items?: { snippet?: { publishedAt?: string } }[] };
        const items = d.items ?? [];
        if (items.length === 0) continue;
        const ts = Date.parse(items[items.length - 1].snippet?.publishedAt ?? "") || 0;
        if (!best || ts > best.ts) best = { id, ts };
      } catch {
        /* skip */
      }
    }
    return best?.id ?? null;
  }

  private async poll() {
    if (this.stopped || !this.liveChatId) return;
    let nextDelay = 5000;
    try {
      const url = new URL(`${API}/liveChat/messages`);
      url.searchParams.set("liveChatId", this.liveChatId);
      url.searchParams.set("part", "snippet,authorDetails");
      if (this.pageToken) url.searchParams.set("pageToken", this.pageToken);
      const init = this.authed(url);

      const r = await fetch(url, init);
      if (r.ok) {
        const d = (await r.json()) as {
          nextPageToken?: string;
          pollingIntervalMillis?: number;
          items?: LiveChatItem[];
        };
        // After the first page, the token returns only NEW messages.
        const firstPage = this.pageToken === undefined;
        this.pageToken = d.nextPageToken ?? this.pageToken;
        nextDelay = Math.max(2000, d.pollingIntervalMillis ?? 5000);
        // Skip the initial historical dump; stream live messages from then on.
        if (!firstPage) {
          for (const it of d.items ?? []) {
            const msg = this.normalize(it);
            if (msg) this.messageCb(msg);
          }
        }
        if (!this._status.connected) this.setStatus({ connected: true });
      } else if (r.status === 401 && this.opts.refresh) {
        // Access token expired — refresh and retry on the next tick.
        const fresh = await this.opts.refresh();
        if (fresh) this.opts.oauthToken = fresh;
        else { this.setStatus({ connected: false, error: "http_401" }); return; }
      } else if (r.status === 404 || r.status === 403) {
        // Live chat ended (stream over) or quota hit — don't dead-stop; go back
        // to watching for the next broadcast so the next stream auto-connects.
        console.log(`· youtube:${this.label()} — live chat closed (http_${r.status}); watching for the next stream`);
        this.liveChatId = null;
        this.setStatus({ connected: false, error: `http_${r.status}` });
        this.timer = setTimeout(() => void this.tryBegin(), 60_000);
        return;
      } else if (r.status === 401) {
        this.setStatus({ connected: false, error: "http_401" });
        return;
      }
    } catch {
      /* transient network error — just retry on the next tick */
    }
    this.timer = setTimeout(() => void this.poll(), nextDelay);
  }

  private normalize(it: LiveChatItem): ChatMessage | null {
    const text = it.snippet?.displayMessage;
    const a = it.authorDetails;
    if (!text || !a?.displayName) return null;
    const badges: Badge[] = [];
    if (a.isChatOwner) badges.push({ type: "broadcaster", label: "Owner" });
    if (a.isChatModerator) badges.push({ type: "moderator", label: "Mod" });
    if (a.isChatSponsor) badges.push({ type: "subscriber", label: "Member" });
    return {
      id: `youtube:${it.id}`,
      nativeId: it.id,
      platform: "youtube",
      username: a.displayName,
      avatar: a.profileImageUrl,
      message: text,
      timestamp: it.snippet?.publishedAt ? Date.parse(it.snippet.publishedAt) : Date.now(),
      badges,
      hype: /member|gift|super\s?chat|sponsor/i.test(text),
    };
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.setStatus({ connected: false });
  }

  async moderate(req: ModerationRequest): Promise<ModerationResult> {
    // liveChatMessages/bans needs an OAuth user token with the manage scope;
    // read works with the API key alone, so moderation is a marked seam.
    return { ok: false, request: req, error: "youtube_mod_requires_oauth" };
  }
}
