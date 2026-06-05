import { BaseConnector } from "./types.ts";
import type { ChatMessage, ModerationRequest, ModerationResult } from "../../../shared/types.ts";

/**
 * X (Twitter) connector via the v2 filtered stream.
 *
 * Requires X_BEARER_TOKEN (OAuth 2.0 App-Only bearer). On start we register the
 * rules in X_STREAM_RULES (comma-separated, e.g. "#yourstream,@yourhandle") and
 * open the streaming connection. Each matching tweet becomes a chat message.
 *
 * Note: X is broadcast, not a moderatable chat room — "moderation" here maps to
 * hiding replies you own / muting, which we expose as a best-effort no-op until
 * a write-scoped user token is supplied.
 */
const RULES_URL = "https://api.twitter.com/2/tweets/search/stream/rules";
const STREAM_URL =
  "https://api.twitter.com/2/tweets/search/stream?tweet.fields=created_at&expansions=author_id&user.fields=username,profile_image_url,verified";

export class XConnector extends BaseConnector {
  readonly platform = "x" as const;
  private abort: AbortController | null = null;

  constructor(private bearer: string | undefined, private rules: string[]) {
    super("x", "stream");
  }

  async start() {
    if (!this.bearer) {
      this.setStatus({ connected: false, error: "no_bearer_token" });
      return;
    }
    await this.syncRules();
    this.openStream();
  }

  private headers() {
    return { Authorization: `Bearer ${this.bearer}` };
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
        body: JSON.stringify({ add: this.rules.map((value) => ({ value })) }),
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
      if (!this.abort?.signal.aborted) {
        this.setStatus({ connected: false, error: String(e) });
        setTimeout(() => this.openStream(), 5000); // backoff reconnect
      }
    }
  }

  private normalize(payload: {
    data: { id: string; text: string; created_at?: string };
    includes?: { users?: { username: string; profile_image_url?: string; verified?: boolean }[] };
  }): ChatMessage {
    const user = payload.includes?.users?.[0];
    return {
      id: `x:${payload.data.id}`,
      nativeId: payload.data.id,
      platform: "x",
      username: user ? `@${user.username}` : "@unknown",
      avatar: user?.profile_image_url,
      message: payload.data.text,
      timestamp: payload.data.created_at ? Date.parse(payload.data.created_at) : Date.now(),
      badges: user?.verified ? [{ type: "verified", label: "Verified" }] : [],
    };
  }

  async stop() {
    this.abort?.abort();
    this.setStatus({ connected: false });
  }

  async moderate(req: ModerationRequest): Promise<ModerationResult> {
    // X is not a moderatable room from a broadcaster seat; expose as best-effort.
    return { ok: false, request: req, error: "x_moderation_unsupported" };
  }
}
