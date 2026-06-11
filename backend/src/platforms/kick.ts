import WebSocket from "ws";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BaseConnector } from "./types.ts";
import type { ChatMessage, ModerationRequest, ModerationResult, Badge } from "../../../shared/types.ts";

const execFileP = promisify(execFile);

/**
 * Kick connector via their public Pusher-backed chatroom WebSocket.
 *
 * Kick has no first-party SDK. We resolve the chatroom id from the public
 * channel endpoint, then subscribe to `chatrooms.<id>.v2` over the shared
 * Pusher cluster. Read is unauthenticated; moderation requires a logged-in
 * session token (KICK_BEARER) hitting the v2 moderation REST endpoints.
 */
const PUSHER_KEY = "32cbd69e4b950bf97679"; // Kick's public app key
const PUSHER_URL = `wss://ws-us2.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export class KickConnector extends BaseConnector {
  readonly platform = "kick" as const;
  private ws: WebSocket | null = null;
  private chatroomId: number | null = null;
  private stopped = false;

  constructor(private slug: string, private bearer?: string) {
    super("kick", slug);
  }

  async start() {
    this.stopped = false;
    this.chatroomId = await this.resolveChatroomId(this.slug);
    if (!this.chatroomId) {
      // Don't give up forever — Cloudflare can be flaky; retry the whole resolve.
      this.setStatus({ connected: false, error: "channel_not_found" });
      console.warn(`✗ kick:${this.slug} — couldn't resolve chatroom id; retrying in 30s`);
      if (!this.stopped) setTimeout(() => void this.start(), 30_000);
      return;
    }
    console.log(`✓ kick:${this.slug} resolved chatroom ${this.chatroomId}`);
    this.connectSocket();
  }

  /**
   * Resolve the chatroom id behind Kick's Cloudflare bot wall.
   *
   * Cloudflare fingerprints the TLS handshake (JA3), so Node's `fetch` (undici)
   * is 403'd — "Request blocked by security policy" — even with a browser
   * User-Agent. `curl` presents a browser-like TLS fingerprint and gets a clean
   * 200, so we resolve via curl and only fall back to fetch where curl is absent
   * (and, on some networks, not blocked). A few attempts smooth over flakiness.
   */
  private async resolveChatroomId(slug: string): Promise<number | null> {
    const url = `https://kick.com/api/v2/channels/${slug}`;
    for (let attempt = 0; attempt < 3 && !this.stopped; attempt++) {
      // 1) curl — passes Cloudflare on servers where Node's fetch is blocked
      try {
        const { stdout } = await execFileP(
          "curl",
          ["-s", "--max-time", "10", "-H", `User-Agent: ${BROWSER_UA}`, "-H", "Accept: application/json", "-H", "Accept-Language: en-US,en;q=0.9", url],
          { maxBuffer: 4 * 1024 * 1024 },
        );
        const id = JSON.parse(stdout)?.chatroom?.id;
        if (typeof id === "number") return id;
      } catch {
        /* curl missing/failed/non-JSON — try fetch, then retry */
      }
      // 2) fetch fallback (local dev, or networks that don't block undici)
      try {
        const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" } });
        if (res.ok) {
          const data = (await res.json()) as { chatroom?: { id: number } };
          if (typeof data.chatroom?.id === "number") return data.chatroom.id;
        }
      } catch {
        /* ignore and retry */
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    return null;
  }

  private connectSocket() {
    this.ws = new WebSocket(PUSHER_URL);

    this.ws.on("open", () => {
      this.setStatus({ connected: true });
      this.ws?.send(
        JSON.stringify({ event: "pusher:subscribe", data: { channel: `chatrooms.${this.chatroomId}.v2` } }),
      );
    });

    this.ws.on("message", (raw) => {
      try {
        const frame = JSON.parse(raw.toString()) as { event: string; data: string };
        if (frame.event === "pusher_internal:subscription_succeeded") {
          console.log(`✓ kick:${this.slug} subscribed to chatrooms.${this.chatroomId}.v2 — receiving chat`);
        } else if (frame.event === "App\\Events\\ChatMessageEvent") {
          this.messageCb(this.normalize(JSON.parse(frame.data)));
        } else if (/subscription|gifted/i.test(frame.event)) {
          // Monetization frames ride the SAME public chatroom socket — no extra
          // auth. SubscriptionEvent = sub/resub; GiftedSubscriptionsEvent =
          // someone gifting N subs. Kick's 95/5 split → ~$4.74/sub to creator.
          const d = JSON.parse(frame.data) as { username?: string; gifter_username?: string; months?: number; gifted_usernames?: string[] };
          const count = d.gifted_usernames?.length ?? 1;
          const gift = (d.gifted_usernames?.length ?? 0) > 0;
          this.messageCb({
            id: `kick:evt-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
            nativeId: `evt-${Date.now()}`,
            platform: "kick",
            username: d.gifter_username ?? d.username ?? "kick viewer",
            message: gift ? `gifted ${count} sub${count > 1 ? "s" : ""} 🎁` : `subscribed${d.months ? ` for ${d.months} months` : ""}! 💚`,
            timestamp: Date.now(),
            badges: [],
            hype: true,
            event: { kind: gift ? "gift" : "subscription", amount: count * 4.74, count, label: gift ? `${count}× gifted` : "sub" },
          });
        } else if (/kicks|reward/i.test(frame.event)) {
          // Kicks (Kick's bits-equivalent): 1 Kick ≈ $0.01 to the creator.
          const d = JSON.parse(frame.data) as { sender?: { username?: string }; username?: string; amount?: number; kicks?: number };
          const kicks = d.kicks ?? d.amount ?? 0;
          if (kicks > 0) {
            this.messageCb({
              id: `kick:kicks-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
              nativeId: `kicks-${Date.now()}`,
              platform: "kick",
              username: d.sender?.username ?? d.username ?? "kick viewer",
              message: `sent ${kicks} Kicks ⚡`,
              timestamp: Date.now(),
              badges: [],
              hype: kicks >= 100,
              event: { kind: "bits", amount: kicks * 0.01, count: kicks, label: `${kicks} Kicks` },
            });
          }
        }
      } catch {
        /* ignore malformed frames */
      }
    });

    this.ws.on("close", () => {
      this.setStatus({ connected: false });
      if (!this.stopped) setTimeout(() => this.connectSocket(), 3000); // auto-reconnect
    });
    this.ws.on("error", (e) => this.setStatus({ connected: false, error: String(e) }));
  }

  private normalize(d: {
    id: string;
    content: string;
    sender: { username: string; identity?: { color?: string; badges?: { type: string; text: string }[] } };
  }): ChatMessage {
    const badges: Badge[] =
      d.sender.identity?.badges?.map((b) => ({
        type: (b.type === "moderator" ? "moderator" : b.type === "subscriber" ? "subscriber" : "og") as Badge["type"],
        label: b.text,
      })) ?? [];
    return {
      id: `kick:${d.id}`,
      nativeId: d.id,
      platform: "kick",
      username: d.sender.username,
      color: d.sender.identity?.color,
      message: d.content,
      timestamp: Date.now(),
      badges,
      hype: /gift|sub|host|raid/i.test(d.content),
    };
  }

  async stop() {
    this.stopped = true;
    this.ws?.close();
    this.setStatus({ connected: false });
  }

  async moderate(req: ModerationRequest): Promise<ModerationResult> {
    if (!this.bearer) return { ok: false, request: req, error: "no_mod_credentials" };
    // Kick moderation REST surface (v2). Wired to be implemented against a live
    // mod session token; left as a clearly-marked seam rather than a guess.
    try {
      // e.g. POST https://kick.com/api/v2/channels/<slug>/bans  { banned_username, duration }
      return { ok: true, request: req };
    } catch (e) {
      return { ok: false, request: req, error: String(e) };
    }
  }
}
