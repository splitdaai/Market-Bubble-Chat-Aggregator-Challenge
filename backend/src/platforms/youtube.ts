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

  constructor(private videoId: string, private apiKey: string) {
    super("youtube", videoId);
  }

  async start() {
    this.stopped = false;
    this.liveChatId = await this.resolveLiveChatId();
    if (!this.liveChatId) {
      this.setStatus({ connected: false, error: "no_active_live_chat" });
      return;
    }
    this.setStatus({ connected: true });
    void this.poll();
  }

  /** A live video exposes its chat id under liveStreamingDetails.activeLiveChatId. */
  private async resolveLiveChatId(): Promise<string | null> {
    try {
      const r = await fetch(`${API}/videos?part=liveStreamingDetails&id=${this.videoId}&key=${this.apiKey}`);
      if (!r.ok) return null;
      const d = (await r.json()) as { items?: { liveStreamingDetails?: { activeLiveChatId?: string } }[] };
      return d.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
    } catch {
      return null;
    }
  }

  private async poll() {
    if (this.stopped || !this.liveChatId) return;
    let nextDelay = 5000;
    try {
      const url = new URL(`${API}/liveChat/messages`);
      url.searchParams.set("liveChatId", this.liveChatId);
      url.searchParams.set("part", "snippet,authorDetails");
      url.searchParams.set("key", this.apiKey);
      if (this.pageToken) url.searchParams.set("pageToken", this.pageToken);

      const r = await fetch(url);
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
      } else if (r.status === 403 || r.status === 404) {
        // chat ended / quota exceeded / invalid id — stop polling cleanly
        this.setStatus({ connected: false, error: `http_${r.status}` });
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
