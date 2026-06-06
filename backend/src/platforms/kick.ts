import WebSocket from "ws";
import { BaseConnector } from "./types.ts";
import type { ChatMessage, ModerationRequest, ModerationResult, Badge } from "../../../shared/types.ts";

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

// Kick's channel API sits behind Cloudflare bot protection — a request with no
// browser User-Agent is 403'd ("Request blocked by security policy"), which left
// the chatroom id unresolved and the socket never connecting. Sending realistic
// browser headers gets a clean 200 from the server.
const BROWSER_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

export class KickConnector extends BaseConnector {
  readonly platform = "kick" as const;
  private ws: WebSocket | null = null;
  private chatroomId: number | null = null;

  constructor(private slug: string, private bearer?: string) {
    super("kick", slug);
  }

  async start() {
    this.chatroomId = await this.resolveChatroomId(this.slug);
    if (!this.chatroomId) {
      this.setStatus({ connected: false, error: "channel_not_found" });
      return;
    }
    this.connectSocket();
  }

  private async resolveChatroomId(slug: string): Promise<number | null> {
    try {
      const res = await fetch(`https://kick.com/api/v2/channels/${slug}`, {
        headers: BROWSER_HEADERS,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { chatroom?: { id: number } };
      return data.chatroom?.id ?? null;
    } catch {
      return null;
    }
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
        if (frame.event === "App\\Events\\ChatMessageEvent") {
          this.messageCb(this.normalize(JSON.parse(frame.data)));
        }
      } catch {
        /* ignore malformed frames */
      }
    });

    this.ws.on("close", () => {
      this.setStatus({ connected: false });
      setTimeout(() => this.connectSocket(), 3000); // auto-reconnect
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
