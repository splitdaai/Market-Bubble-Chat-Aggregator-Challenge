/**
 * GUEST X broadcast chat reader — the same anonymous Periscope/pscp.tv infra X
 * Live runs on, with NO login, NO account, NO cookie. Zero ban risk.
 *
 * Flow (verified end-to-end):
 *   broadcast id -> broadcasts/show.json (media_key, state)
 *               -> live_video_stream/status/<media_key> (chatToken — camelCase)
 *               -> proxsee accessChatPublic (access_token + endpoint + room_id)
 *   REPLAY (state ENDED): POST <endpoint>/chatapi/v1/history {access_token,cursor,limit}
 *   LIVE   (state RUNNING): wss <endpoint>/chatapi/v1/chatnow (not used here; we
 *                           poll history which also serves an in-progress room).
 *
 * Messages: payload (string) -> JSON -> .body (string) -> JSON; type===1 is a
 * real text chat message {body, username, displayName, timestamp}.
 */
import WebSocket from "ws";
import { X_BEARER, X_UA, guestToken } from "./xVod.ts";
import { BaseConnector } from "./platforms/types.ts";
import type { ChatMessage, ModerationRequest, ModerationResult } from "../../shared/types.ts";

const PSCP_HEADERS = { "Content-Type": "application/json", Referer: "https://x.com/", Origin: "https://x.com", "User-Agent": X_UA };
const ID_RE = /^[A-Za-z0-9]+$/;

interface ChatAccess { endpoint: string; accessToken: string; roomId: string; replay: boolean; title: string; state: string }

/** Accept a raw broadcast id or a copied X/Twitter broadcast URL. */
export function normalizeBroadcastId(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const match = raw.match(/(?:x|twitter)\.com\/i\/broadcasts\/([A-Za-z0-9]+)/i) ?? raw.match(/broadcasts\/([A-Za-z0-9]+)/i);
  const id = match?.[1] ?? raw;
  return ID_RE.test(id) ? id : null;
}

/** Resolve a broadcast id to a guest chat grant (token + endpoint). */
export async function resolveBroadcastChat(id: string): Promise<ChatAccess | null> {
  if (!ID_RE.test(id)) return null;
  const gt = await guestToken();
  const H = { authorization: `Bearer ${X_BEARER}`, "x-guest-token": gt, "User-Agent": X_UA };
  const show = (await (await fetch(`https://api.twitter.com/1.1/broadcasts/show.json?ids=${id}`, { headers: H })).json()) as { broadcasts?: Record<string, { media_key: string; status?: string; state?: string }> };
  const bc = show?.broadcasts?.[id];
  if (!bc) return null;
  const st = (await (await fetch(`https://api.twitter.com/1.1/live_video_stream/status/${bc.media_key}?client=web`, { headers: H })).json()) as { chatToken?: string };
  const chatToken = st?.chatToken;
  if (!chatToken) return null;
  const acc = (await (await fetch("https://proxsee.pscp.tv/api/v2/accessChatPublic", { method: "POST", headers: PSCP_HEADERS, body: JSON.stringify({ chat_token: chatToken }) })).json()) as { endpoint?: string; access_token?: string; room_id?: string };
  if (!acc?.endpoint || !acc?.access_token) return null;
  const replay = acc.endpoint.includes("-replay-") || (bc.state ?? "").toUpperCase() === "ENDED";
  return { endpoint: acc.endpoint, accessToken: acc.access_token, roomId: acc.room_id ?? id, replay, title: bc.status ?? "", state: bc.state ?? "" };
}

interface RawMsg { kind?: number; payload?: string }
/** Parse a Periscope chat envelope into a clean text message (or null). */
function parseMsg(m: RawMsg): { username: string; displayName: string; text: string; t: number } | null {
  try {
    const p = JSON.parse(m.payload ?? "{}") as { body?: string };
    const b = JSON.parse(p.body ?? "{}") as { type?: number; body?: string; username?: string; displayName?: string; timestamp?: number };
    if (b.type !== 1 || !b.body || !b.username) return null;
    return { username: b.username, displayName: b.displayName ?? b.username, text: b.body, t: b.timestamp ?? Date.now() };
  } catch {
    return null;
  }
}

/** One page of replay chat history from a cursor (ns timestamp; "" = start). */
export async function replayChatPage(access: ChatAccess, cursor = "", limit = 200): Promise<{ messages: { username: string; displayName: string; text: string; t: number }[]; cursor: string }> {
  const r = await fetch(`${access.endpoint}/chatapi/v1/history`, { method: "POST", headers: PSCP_HEADERS, body: JSON.stringify({ access_token: access.accessToken, cursor, limit }) });
  if (!r.ok) return { messages: [], cursor };
  const d = (await r.json()) as { messages?: RawMsg[]; cursor?: string };
  const messages = (d.messages ?? []).map(parseMsg).filter((m): m is NonNullable<typeof m> => !!m);
  return { messages, cursor: d.cursor ?? cursor };
}

/* ----------------------------- REST shape (demo) ---------------------------- */
const restCache = new Map<string, { exp: number; msgs: { username: string; displayName: string; text: string; t: number }[] }>();

/** A batch of real chat messages from a broadcast (mid-stream window so it's not
 *  all join/heartbeat frames). Cached — used by the frontend to drip real X chat
 *  into the unified feed even in demo mode. */
export async function broadcastChatBatch(id: string): Promise<{ title: string; messages: { username: string; displayName: string; text: string; t: number }[] }> {
  const hit = restCache.get(id);
  if (hit && Date.now() < hit.exp) return { title: "", messages: hit.msgs };
  const access = await resolveBroadcastChat(id);
  if (!access) return { title: "", messages: [] };
  // Replay chat is heartbeat-heavy and sparse, so walk deep (cached 30 min, so
  // only the first request pays the cost) and dedup real text messages.
  const dedup = new Map<string, { username: string; displayName: string; text: string; t: number }>();
  let cursor = "";
  for (let i = 0; i < 60 && dedup.size < 150; i++) {
    const page = await replayChatPage(access, cursor);
    for (const m of page.messages) dedup.set(`${m.username}:${m.text}`, m);
    if (!page.cursor || page.cursor === cursor) break;
    cursor = page.cursor;
  }
  const out = [...dedup.values()].sort((a, b) => a.t - b.t);
  restCache.set(id, { exp: Date.now() + 30 * 60_000, msgs: out });
  return { title: access.title, messages: out };
}

/**
 * Streams a LIVE X broadcast's chat into the unified feed via the guest
 * websocket. Used when the Market Bubble X broadcast is actually RUNNING.
 */
export class XBroadcastChatConnector extends BaseConnector {
  readonly platform = "x" as const;
  private ws: WebSocket | null = null;
  private stopped = false;
  private seen = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(private broadcastId: string, label = "X Broadcast") {
    super("x", label);
  }

  async start() {
    this.stopped = false;
    try {
      const access = await resolveBroadcastChat(this.broadcastId);
      if (!access) { this.setStatus({ connected: false, error: "no_broadcast" }); return; }
      this.setStatus({ channel: access.title || this.status().channel || "X Broadcast" });

      // Backfill whatever chat already happened before the connector was added.
      const { messages } = await broadcastChatBatch(this.broadcastId);
      for (const m of messages) this.emit(m);

      if (access.replay) {
        this.setStatus({ connected: true });
        return;
      }
      this.connectWs(access);
    } catch (e) {
      this.setStatus({ connected: false, error: String(e) });
    }
  }

  private connectWs(access: ChatAccess) {
    const url = `${access.endpoint.replace(/^http/, "ws")}/chatapi/v1/chatnow`;
    this.ws = new WebSocket(url, { headers: { Origin: "https://x.com", "User-Agent": X_UA } });
    this.ws.on("open", () => {
      this.setStatus({ connected: true, error: undefined });
      this.ws?.send(JSON.stringify({ payload: JSON.stringify({ access_token: access.accessToken, room_id: access.roomId }), kind: 1 }));
    });
    this.ws.on("message", (raw) => {
      try { const m = parseMsg(JSON.parse(raw.toString())); if (m) this.emit(m); } catch { /* ignore */ }
    });
    this.ws.on("close", () => {
      if (this.stopped) return;
      this.setStatus({ connected: false, error: "socket_closed" });
      this.reconnectTimer = setTimeout(() => void this.start(), 4000);
    });
    this.ws.on("error", (e) => this.setStatus({ connected: false, error: String(e) }));
  }

  private emit(m: { username: string; displayName: string; text: string; t: number }) {
    const key = `${m.username}:${m.text}:${m.t}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.messageCb({
      id: `x:bc-${m.t}-${Math.floor(Math.random() * 1e6)}`,
      nativeId: `bc-${m.t}`,
      platform: "x",
      username: m.displayName || m.username,
      channel: this.status().channel,
      message: m.text,
      timestamp: Date.now(),
      badges: [],
      hype: false,
    });
  }

  async stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.setStatus({ connected: false });
  }

  async moderate(req: ModerationRequest): Promise<ModerationResult> {
    return { ok: false, request: req, error: "x_broadcast_moderation_unsupported" };
  }
}
