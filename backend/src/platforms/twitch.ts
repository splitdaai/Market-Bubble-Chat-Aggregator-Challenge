import tmi from "tmi.js";
import { BaseConnector } from "./types.ts";
import type { ChatMessage, ModerationRequest, ModerationResult, Badge, ChatEvent } from "../../../shared/types.ts";

/** Twitch sub plan → USD-equivalent for the donor leaderboard. */
const SUB_USD: Record<string, number> = { Prime: 5, "1000": 5, "2000": 10, "3000": 25 };
const SUB_TIER: Record<string, string> = { Prime: "Prime", "1000": "Tier 1", "2000": "Tier 2", "3000": "Tier 3" };

/**
 * Twitch connector via tmi.js (IRC-over-WebSocket).
 *
 * Anonymous read works with no credentials. To moderate you must supply a
 * broadcaster/mod OAuth token with the `channel:moderate` + chat scopes in
 * TWITCH_OAUTH (format: "oauth:xxxx") and TWITCH_USERNAME.
 */
export class TwitchConnector extends BaseConnector {
  readonly platform = "twitch" as const;
  private client: tmi.Client | null = null;

  constructor(private channel: string, private username?: string, private oauth?: string) {
    super("twitch", `#${channel}`);
  }

  async start() {
    this.client = new tmi.Client({
      options: { debug: false },
      connection: { reconnect: true, secure: true },
      identity: this.username && this.oauth ? { username: this.username, password: this.oauth } : undefined,
      channels: [this.channel],
    });

    this.client.on("message", (_ch, tags, message, self) => {
      if (self) return;
      this.messageCb(this.normalize(tags, message));
    });

    // --- sub / gift events → donor/sub leaderboards (bits ride in via `message`) ---
    const sub = (user?: string, plan?: string) => {
      const key = plan ?? "1000";
      this.emitEvent(user ?? "anon", undefined, `${SUB_TIER[key] ?? "Sub"} sub`,
        { kind: "subscription", amount: SUB_USD[key] ?? 5, count: 1, label: SUB_TIER[key] ?? "Sub" });
    };
    this.client.on("subscription", (_c, user, methods) => sub(user, methods?.plan));
    this.client.on("resub", (_c, user, _m, _msg, _s, methods) => sub(user, methods?.plan));
    this.client.on("subgift", (_c, user, _streak, _recipient, methods) =>
      this.emitEvent(user ?? "anon", undefined, "gifted a sub 🎁",
        { kind: "gift", amount: SUB_USD[methods?.plan ?? "1000"] ?? 5, count: 1, label: "1× gifted" }));
    this.client.on("submysterygift", (_c, user, count, methods) =>
      this.emitEvent(user ?? "anon", undefined, `gifted ${count} subs 🎁`,
        { kind: "gift", amount: (SUB_USD[methods?.plan ?? "1000"] ?? 5) * Number(count), count: Number(count), label: `${count}× gifted` }));

    this.client.on("connected", () => this.setStatus({ connected: true }));
    this.client.on("disconnected", (reason) => this.setStatus({ connected: false, error: reason }));

    await this.client.connect();
  }

  /** Emit a synthetic message carrying a monetization event. */
  private emitEvent(username: string, color: string | undefined, message: string, event: ChatEvent) {
    this.messageCb({
      id: `twitch:evt-${Date.now()}-${Math.round(event.amount * 100)}`,
      platform: "twitch",
      username,
      color,
      message,
      timestamp: Date.now(),
      hype: true,
      event,
    });
  }

  async stop() {
    await this.client?.disconnect();
    this.setStatus({ connected: false });
  }

  private normalize(tags: tmi.ChatUserstate, message: string): ChatMessage {
    const badges: Badge[] = [];
    if (tags.badges?.broadcaster) badges.push({ type: "broadcaster", label: "Broadcaster" });
    if (tags.mod) badges.push({ type: "moderator", label: "Mod" });
    if (tags.subscriber) badges.push({ type: "subscriber", label: "Sub" });
    if (tags.badges?.vip) badges.push({ type: "vip", label: "VIP" });

    const bits = Number(tags.bits ?? 0);
    const event: ChatEvent | undefined = bits > 0 ? { kind: "bits", amount: bits / 100, label: `${bits} bits` } : undefined;
    return {
      id: `twitch:${tags.id ?? Date.now()}`,
      nativeId: tags.id,
      platform: "twitch",
      username: tags["display-name"] ?? tags.username ?? "anon",
      color: tags.color ?? undefined,
      message,
      timestamp: Date.now(),
      badges,
      hype: bits > 0,
      event,
    };
  }

  async moderate(req: ModerationRequest): Promise<ModerationResult> {
    if (!this.client || !this.username) {
      return { ok: false, request: req, error: "no_mod_credentials" };
    }
    try {
      const ch = this.channel;
      switch (req.action.kind) {
        case "delete":
          if (req.messageId) await this.client.deletemessage(ch, req.messageId);
          break;
        case "timeout":
          if (req.username) await this.client.timeout(ch, req.username, req.action.seconds);
          break;
        case "ban":
          if (req.username) await this.client.ban(ch, req.username);
          break;
        case "unban":
          if (req.username) await this.client.unban(ch, req.username);
          break;
        case "slow":
          await this.client.slow(ch, req.action.seconds);
          break;
      }
      return { ok: true, request: req, undoToken: req.action.kind === "ban" ? req.username : undefined };
    } catch (e) {
      return { ok: false, request: req, error: String(e) };
    }
  }
}
