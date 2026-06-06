import { BaseConnector } from "./types.ts";
import type { ChatMessage, ModerationRequest, ModerationResult } from "../../../shared/types.ts";

/**
 * X (Twitter) connector with two modes:
 *
 *  - **Per-account mentions** (a connected account's OAuth token): polls the
 *    tweets that @-mention the account — the closest thing X has to a "chat" —
 *    and aggregates them into the unified feed. This is what drives X from the
 *    multi-account OAuth flow.
 *  - **App-level filtered stream** (X_BEARER_TOKEN + rules): tweets matching
 *    rules like "#yourstream,@yourhandle".
 *
 * X is broadcast, not a moderatable room, so moderation is a best-effort no-op.
 */
const API = "https://api.twitter.com/2";
const RULES_URL = `${API}/tweets/search/stream/rules`;
const STREAM_URL = `${API}/tweets/search/stream?tweet.fields=created_at&expansions=author_id&user.fields=username,profile_image_url,verified`;

interface XTweet { id: string; text: string; created_at?: string; author_id?: string }
interface XUser { id?: string; username: string; profile_image_url?: string; verified?: boolean }

export class XConnector extends BaseConnector {
  readonly platform = "x" as const;
  private abort: AbortController | null = null;
  private mentionsTimer: ReturnType<typeof setTimeout> | null = null;
  private sinceId: string | undefined;
  private userId: string | null = null;
  private stopped = false;

  constructor(private opts: { bearer?: string; rules?: string[]; oauthToken?: string; label?: string }) {
    super("x", opts.label ?? "stream");
  }

  async start() {
    this.stopped = false;
    if (this.opts.oauthToken) return this.startMentions(); // account mode
    if (!this.opts.bearer) { this.setStatus({ connected: false, error: "no_bearer_token" }); return; }
    await this.syncRules();
    void this.openStream();
  }

  /* ---------------- per-account mentions polling (OAuth token) ---------------- */

  private async startMentions() {
    this.userId = await this.resolveUserId();
    if (!this.userId) { this.setStatus({ connected: false, error: "could_not_resolve_user" }); return; }
    this.setStatus({ connected: true });
    void this.pollMentions(true);
  }

  private async resolveUserId(): Promise<string | null> {
    try {
      const r = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${this.opts.oauthToken}` } });
      if (!r.ok) return null;
      const d = (await r.json()) as { data?: { id?: string } };
      return d.data?.id ?? null;
    } catch {
      return null;
    }
  }

  private async pollMentions(first = false) {
    if (this.stopped || !this.userId) return;
    try {
      const url = new URL(`${API}/users/${this.userId}/mentions`);
      url.searchParams.set("tweet.fields", "created_at");
      url.searchParams.set("expansions", "author_id");
      url.searchParams.set("user.fields", "username,profile_image_url,verified");
      url.searchParams.set("max_results", "20");
      if (this.sinceId) url.searchParams.set("since_id", this.sinceId);

      const r = await fetch(url, { headers: { Authorization: `Bearer ${this.opts.oauthToken}` } });
      if (r.ok) {
        const d = (await r.json()) as { data?: XTweet[]; includes?: { users?: XUser[] }; meta?: { newest_id?: string } };
        if (d.meta?.newest_id) this.sinceId = d.meta.newest_id;
        // Skip the initial backlog; stream new mentions oldest→newest thereafter.
        if (!first) {
          const users = new Map((d.includes?.users ?? []).map((u) => [u.id, u]));
          for (const t of (d.data ?? []).slice().reverse()) {
            this.messageCb(this.normalizeTweet(t, users.get(t.author_id ?? "")));
          }
        }
        if (!this._status.connected) this.setStatus({ connected: true });
      } else if (r.status === 401 || r.status === 403) {
        this.setStatus({ connected: false, error: `http_${r.status}` }); // bad/expired token
        return;
      }
    } catch {
      /* transient network error — retry next tick */
    }
    this.mentionsTimer = setTimeout(() => void this.pollMentions(false), 20_000); // 20s, rate-limit friendly
  }

  private normalizeTweet(t: XTweet, user?: XUser): ChatMessage {
    return {
      id: `x:${t.id}`,
      nativeId: t.id,
      platform: "x",
      username: user ? `@${user.username}` : "@unknown",
      avatar: user?.profile_image_url,
      message: t.text,
      timestamp: t.created_at ? Date.parse(t.created_at) : Date.now(),
      badges: user?.verified ? [{ type: "verified", label: "Verified" }] : [],
    };
  }

  /* ------------------- app-level filtered stream (bearer) -------------------- */

  private headers() {
    return { Authorization: `Bearer ${this.opts.bearer}` };
  }

  /** Replace existing rules with our configured set. */
  private async syncRules() {
    try {
      const current = await fetch(RULES_URL, { headers: this.headers() }).then((r) => r.json() as Promise<{ data?: { id: string }[] }>);
      if (current.data?.length) {
        await fetch(RULES_URL, {
          method: "POST",
          headers: { ...this.headers(), "Content-Type": "application/json" },
          body: JSON.stringify({ delete: { ids: current.data.map((r) => r.id) } }),
        });
      }
      await fetch(RULES_URL, {
        method: "POST",
        headers: { ...this.headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ add: (this.opts.rules ?? []).map((value) => ({ value })) }),
      });
    } catch (e) {
      this.setStatus({ error: `rule_sync_failed: ${e}` });
    }
  }

  private async openStream() {
    this.abort = new AbortController();
    try {
      const res = await fetch(STREAM_URL, { headers: this.headers(), signal: this.abort.signal });
      if (!res.ok || !res.body) {
        this.setStatus({ connected: false, error: `stream_http_${res.status}` });
        return;
      }
      this.setStatus({ connected: true });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue; // keep-alive heartbeat
          try {
            this.messageCb(this.normalize(JSON.parse(line)));
          } catch {
            /* partial frame */
          }
        }
      }
    } catch (e) {
      if (!this.stopped && !this.abort?.signal.aborted) {
        this.setStatus({ connected: false, error: String(e) });
        setTimeout(() => void this.openStream(), 5000); // backoff reconnect
      }
    }
  }

  private normalize(payload: {
    data: { id: string; text: string; created_at?: string };
    includes?: { users?: XUser[] };
  }): ChatMessage {
    return this.normalizeTweet(payload.data, payload.includes?.users?.[0]);
  }

  async stop() {
    this.stopped = true;
    this.abort?.abort();
    if (this.mentionsTimer) clearTimeout(this.mentionsTimer);
    this.setStatus({ connected: false });
  }

  async moderate(req: ModerationRequest): Promise<ModerationResult> {
    // X is not a moderatable room from a broadcaster seat; best-effort no-op.
    return { ok: false, request: req, error: "x_moderation_unsupported" };
  }
}
