import WebSocket from "ws";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { BaseConnector } from "./types.ts";
import type { ChatMessage, ModerationRequest, ModerationResult, Badge, Emote } from "../../../shared/types.ts";

const execFileP = promisify(execFile);

/**
 * Kick connector via their public Pusher-backed chatroom WebSocket.
 *
 * Kick has no first-party SDK. We resolve the chatroom id from the public
 * channel endpoint, then subscribe to `chatrooms.<id>.v2` over the shared
 * Pusher cluster. Read is unauthenticated; moderation requires a logged-in
 * user token hitting Kick's public moderation REST endpoints.
 */
const PUSHER_KEY = "32cbd69e4b950bf97679"; // Kick's public app key
const PUSHER_URL = `wss://ws-us2.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;
const KICK_API = "https://api.kick.com/public/v1";

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const DEBUG_EMOTES = process.env.DEBUG_EMOTES === "1" || process.env.DEBUG_EMOTES === "true";

type UnknownRecord = Record<string, unknown>;

interface KickChatPayload {
  id: string | number;
  content: string;
  sender: { id?: string | number; username: string; identity?: { color?: string; badges?: { type: string; text: string }[] } };
  emotes?: unknown;
  metadata?: unknown;
  message?: unknown;
}

interface KickChannelResolve {
  chatroomId: number;
  broadcasterUserId?: number | null;
  emotes: Emote[];
}

const KICK_EMOTE_TOKEN_RE = /\[emote:([^\]:]+):([^\]]+)\]/g;

export class KickConnector extends BaseConnector {
  readonly platform = "kick" as const;
  private ws: WebSocket | null = null;
  private chatroomId: number | null = null;
  private broadcasterUserId: number | null = null;
  private channelEmotes = new Map<string, string>();
  private stopped = false;

  constructor(private slug: string, private bearer?: string, private refresh?: () => Promise<string | null>) {
    super("kick", slug);
  }

  async start() {
    this.stopped = false;
    const resolved = await this.resolveChannel(this.slug);
    this.chatroomId = resolved?.chatroomId ?? null;
    this.broadcasterUserId = resolved?.broadcasterUserId ?? null;
    if (!this.broadcasterUserId && this.bearer) {
      this.broadcasterUserId = await this.resolveBroadcasterUserId(this.slug);
    }
    if (!this.chatroomId) {
      // Don't give up forever — Cloudflare can be flaky; retry the whole resolve.
      this.setStatus({ connected: false, error: "channel_not_found" });
      console.warn(`✗ kick:${this.slug} — couldn't resolve chatroom id; retrying in 30s`);
      if (!this.stopped) setTimeout(() => void this.start(), 30_000);
      return;
    }
    this.channelEmotes = new Map((resolved?.emotes ?? []).map((emote) => [emote.code, emote.url]));
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
  private async resolveChannel(slug: string): Promise<KickChannelResolve | null> {
    const url = `https://kick.com/api/v2/channels/${slug}`;
    for (let attempt = 0; attempt < 3 && !this.stopped; attempt++) {
      // 1) curl — passes Cloudflare on servers where Node's fetch is blocked
      try {
        const { stdout } = await execFileP(
          "curl",
          ["-s", "--max-time", "10", "-H", `User-Agent: ${BROWSER_UA}`, "-H", "Accept: application/json", "-H", "Accept-Language: en-US,en;q=0.9", url],
          { maxBuffer: 4 * 1024 * 1024 },
        );
        const data = JSON.parse(stdout) as unknown;
        const id = asRecord(asRecord(data)?.chatroom)?.id;
        const broadcasterUserId = parseNumber(asRecord(data)?.broadcaster_user_id);
        if (typeof id === "number") return { chatroomId: id, broadcasterUserId, emotes: extractKickEmotesFromUnknown(data) };
      } catch {
        /* curl missing/failed/non-JSON — try fetch, then retry */
      }
      // 2) fetch fallback (local dev, or networks that don't block undici)
      try {
        const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": BROWSER_UA, "Accept-Language": "en-US,en;q=0.9" } });
        if (res.ok) {
          const data = await res.json() as unknown;
          const id = asRecord(asRecord(data)?.chatroom)?.id;
          const broadcasterUserId = parseNumber(asRecord(data)?.broadcaster_user_id);
          if (typeof id === "number") return { chatroomId: id, broadcasterUserId, emotes: extractKickEmotesFromUnknown(data) };
        }
      } catch {
        /* ignore and retry */
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    return null;
  }

  private async resolveBroadcasterUserId(slug: string): Promise<number | null> {
    try {
      const json = await this.kickJson(`/channels?slug=${encodeURIComponent(slug)}`);
      const data = asRecord(json)?.data;
      const first = Array.isArray(data) ? asRecord(data[0]) : null;
      return parseNumber(first?.broadcaster_user_id);
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

  private normalize(d: KickChatPayload): ChatMessage {
    const badges: Badge[] =
      d.sender.identity?.badges?.map((b) => ({
        type: (b.type === "moderator" ? "moderator" : b.type === "subscriber" ? "subscriber" : "og") as Badge["type"],
        label: b.text,
      })) ?? [];
    const message = cleanKickContent(d.content);
    const emotes = mergeEmotes(
      extractKickEmotes(d),
      resolveTextEmotes(message, this.channelEmotes),
    );
    logKickEmoteDebug(this.slug, d, message, emotes, this.channelEmotes.size);
    return {
      id: `kick:${d.id}`,
      nativeId: String(d.id),
      platform: "kick",
      accountId: `kick:${this.slug}`,
      channel: this.slug,
      username: d.sender.username,
      nativeUserId: cleanCode(d.sender.id) ?? undefined,
      color: d.sender.identity?.color,
      message,
      timestamp: Date.now(),
      badges,
      emotes: emotes.length ? emotes : undefined,
      hype: /gift|sub|host|raid/i.test(message),
    };
  }

  async stop() {
    this.stopped = true;
    this.ws?.close();
    this.setStatus({ connected: false });
  }

  async moderate(req: ModerationRequest): Promise<ModerationResult> {
    if (!this.bearer) return { ok: false, request: req, error: "no_mod_credentials" };
    try {
      switch (req.action.kind) {
        case "delete":
          if (!req.messageId) return { ok: false, request: req, error: "missing_message_id" };
          await this.kickRequest(`/chat/${encodeURIComponent(req.messageId)}`, { method: "DELETE" }, [204]);
          break;
        case "ban":
          await this.postBan(req);
          break;
        case "timeout":
          await this.postBan(req, Math.max(1, Math.ceil(req.action.seconds / 60)));
          break;
        case "unban":
          await this.deleteBan(req);
          break;
        case "slow":
          return { ok: false, request: req, error: "kick_slow_mode_api_unsupported" };
      }
      return { ok: true, request: req, undoToken: req.action.kind === "ban" ? req.username : undefined };
    } catch (e) {
      return { ok: false, request: req, error: String(e) };
    }
  }

  private async postBan(req: ModerationRequest, durationMinutes?: number) {
    const body = this.moderationBody(req);
    await this.kickRequest("/moderation/bans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        ...(durationMinutes ? { duration: Math.min(10_080, durationMinutes) } : {}),
        reason: "Market Bubble moderation",
      }),
    });
  }

  private async deleteBan(req: ModerationRequest) {
    await this.kickRequest("/moderation/bans", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.moderationBody(req)),
    });
  }

  private moderationBody(req: ModerationRequest) {
    const broadcaster_user_id = this.broadcasterUserId;
    const user_id = parseNumber(req.userId);
    if (!broadcaster_user_id) throw new Error("missing_broadcaster_user_id");
    if (!user_id) throw new Error("missing_target_user_id");
    return { broadcaster_user_id, user_id };
  }

  private async kickJson(path: string) {
    const res = await this.kickFetch(path, { method: "GET" });
    if (!res.ok) throw new Error(`kick_api_${res.status}`);
    return res.json() as Promise<unknown>;
  }

  private async kickRequest(path: string, init: RequestInit, okStatuses = [200, 204]) {
    const res = await this.kickFetch(path, init);
    if (!okStatuses.includes(res.status)) {
      const body = await res.text().catch(() => "");
      throw new Error(`kick_api_${res.status}${body ? `:${body.slice(0, 240)}` : ""}`);
    }
  }

  private async kickFetch(path: string, init: RequestInit): Promise<Response> {
    const res = await this.kickFetchOnce(path, init, this.bearer);
    if (res.status !== 401 || !this.refresh) return res;
    const fresh = await this.refresh();
    if (!fresh) return res;
    this.bearer = fresh;
    return this.kickFetchOnce(path, init, fresh);
  }

  private async kickFetchOnce(path: string, init: RequestInit, bearer?: string): Promise<Response> {
    if (!bearer) throw new Error("no_mod_credentials");
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${bearer}`);
    headers.set("Accept", "application/json");
    return fetch(`${KICK_API}${path}`, { ...init, headers });
  }
}

function cleanKickContent(content: string): string {
  return content
    .replace(KICK_EMOTE_TOKEN_RE, " $2 ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKickEmotes(payload: KickChatPayload): Emote[] {
  const refsFromContent = [...payload.content.matchAll(KICK_EMOTE_TOKEN_RE)]
    .map((match) => ({ id: cleanCode(match[1]), code: cleanCode(match[2]) }))
    .filter((ref): ref is { id: string; code: string } => Boolean(ref.id && ref.code));
  const candidates = [
    payload.emotes,
    parseMaybeJson(payload.metadata),
    asRecord(parseMaybeJson(payload.metadata))?.emotes,
    asRecord(parseMaybeJson(payload.message))?.emotes,
  ];

  const byCode = new Map<string, string>();
  for (const ref of refsFromContent) {
    const url = kickEmoteUrlFromId(ref.id);
    if (url) byCode.set(ref.code, url);
  }
  let fallbackCodeIndex = 0;
  for (const record of candidates.flatMap((candidate) => collectEmoteRecords(candidate))) {
    const code =
      cleanCode(record.name) ??
      cleanCode(record.code) ??
      cleanCode(record.slug) ??
      cleanCode(record.text) ??
      refsFromContent[fallbackCodeIndex]?.code ??
      cleanCode(record.id);
    const url = findUrl(record);
    fallbackCodeIndex += 1;
    if (code && url) byCode.set(code, url);
  }

  return [...byCode.entries()].map(([code, url]) => ({ code, url }));
}

function kickEmoteUrlFromId(id: string): string | null {
  return /^\d+$/.test(id) ? `https://files.kick.com/emotes/${id}/fullsize` : null;
}

function extractKickEmotesFromUnknown(value: unknown): Emote[] {
  const byCode = new Map<string, string>();
  for (const record of collectEmoteRecords(value)) {
    const code = cleanCode(record.name) ?? cleanCode(record.code) ?? cleanCode(record.slug) ?? cleanCode(record.text);
    const url = findUrl(record);
    if (code && url) byCode.set(code, url);
  }
  return [...byCode.entries()].map(([code, url]) => ({ code, url }));
}

function resolveTextEmotes(message: string, emoteMap: Map<string, string>): Emote[] {
  if (emoteMap.size === 0) return [];
  const byCode = new Map<string, string>();
  for (const rawToken of message.split(/\s+/)) {
    const code = cleanCode(rawToken);
    const url = code ? emoteMap.get(code) : undefined;
    if (code && url) byCode.set(code, url);
  }
  return [...byCode.entries()].map(([code, url]) => ({ code, url }));
}

function mergeEmotes(...groups: Emote[][]): Emote[] {
  const byCode = new Map<string, string>();
  for (const group of groups) {
    for (const emote of group) {
      const code = cleanCode(emote.code);
      const url = cleanUrl(emote.url);
      if (code && url) byCode.set(code, url);
    }
  }
  return [...byCode.entries()].map(([code, url]) => ({ code, url }));
}

function collectEmoteRecords(value: unknown, depth = 0): UnknownRecord[] {
  if (!value || depth > 5) return [];
  if (Array.isArray(value)) return value.flatMap((item) => collectEmoteRecords(item, depth + 1));
  const record = asRecord(value);
  if (!record) return [];

  const isEmote = Boolean(
    (cleanCode(record.name) || cleanCode(record.code) || cleanCode(record.slug) || cleanCode(record.text) || cleanCode(record.id)) &&
    findUrl(record),
  );

  return [
    ...(isEmote ? [record] : []),
    ...collectEmoteRecords(record.emotes, depth + 1),
    ...collectEmoteRecords(record.subscriber_emotes, depth + 1),
    ...collectEmoteRecords(record.channel_emotes, depth + 1),
    ...collectEmoteRecords(record.chatroom, depth + 1),
    ...collectEmoteRecords(record.emote_set, depth + 1),
    ...collectEmoteRecords(record.data, depth + 1),
  ];
}

function findUrl(value: unknown, depth = 0): string | null {
  if (depth > 4) return null;
  const direct = cleanUrl(value);
  if (direct) return direct;
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = findUrl(item, depth + 1);
      if (url) return url;
    }
    return null;
  }
  const record = asRecord(value);
  if (!record) return null;
  for (const key of ["url", "src", "image", "image_url", "static_url", "animated_url", "emote_url", "cdn_url", "asset_url", "url_static", "url_animated", "gif", "asset", "path", "source", "file", "url_4x", "url_2x", "url_1x"]) {
    const url = cleanUrl(record[key]);
    if (url) return url;
  }
  for (const key of ["images", "urls", "variants", "versions", "small", "medium", "large"]) {
    const url = findUrl(record[key], depth + 1);
    if (url) return url;
  }
  return null;
}

function cleanCode(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const code = String(value).trim();
  if (!code) return null;
  return code.length > 2 && code.startsWith(":") && code.endsWith(":") ? code.slice(1, -1) : code;
}

function parseNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

function cleanUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const url = value.trim();
  if (url.startsWith("https://") || url.startsWith("http://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return null;
}

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function logKickEmoteDebug(channel: string, payload: KickChatPayload, message: string, emotes: Emote[], channelEmoteCount: number) {
  if (!DEBUG_EMOTES) return;
  const tokenRefs = [...payload.content.matchAll(KICK_EMOTE_TOKEN_RE)]
    .map((match) => ({ id: match[1], code: match[2], inferredUrl: kickEmoteUrlFromId(match[1]) }))
    .filter((ref) => ref.id || ref.code);
  const metadata = parseMaybeJson(payload.metadata);
  const nestedMessage = parseMaybeJson(payload.message);
  const hasRawEmoteSignal = Boolean(
    tokenRefs.length ||
    payload.emotes ||
    asRecord(metadata)?.emotes ||
    asRecord(nestedMessage)?.emotes ||
    emotes.length,
  );
  if (!hasRawEmoteSignal) return;

  console.log("[emotes:kick]", JSON.stringify({
    channel,
    rawContent: payload.content,
    normalizedMessage: message,
    tokenRefs,
    channelEmoteCount,
    resolved: emotes,
    rawShape: summarizeEmoteShape({
      emotes: payload.emotes,
      metadata,
      message: nestedMessage,
    }),
  }));
}

function summarizeEmoteShape(value: unknown, depth = 0): unknown {
  if (depth > 3 || value == null) return undefined;
  if (Array.isArray(value)) return { type: "array", length: value.length, first: summarizeEmoteShape(value[0], depth + 1) };
  const record = asRecord(value);
  if (!record) return typeof value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    if (/emote|image|url|src|asset|metadata|message|data|name|code|slug|id/i.test(key)) {
      out[key] = typeof item === "string" || typeof item === "number" || typeof item === "boolean"
        ? item
        : summarizeEmoteShape(item, depth + 1);
    }
  }
  return Object.keys(out).length ? out : { keys: Object.keys(record).slice(0, 12) };
}
