// Shared guest X-broadcast-chat helpers for the serverless functions — port of
// backend/src/xBroadcastChat.ts essentials (the EC2 backend was retired).
export const X_BEARER = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
export const X_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
export const PSCP_HEADERS = { "Content-Type": "application/json", Referer: "https://x.com/", Origin: "https://x.com", "User-Agent": X_UA } as Record<string, string>;
export const ID_RE = /^[A-Za-z0-9]+$/;

export interface ChatAccess { endpoint: string; accessToken: string; roomId: string; replay: boolean; title: string; state: string }
export interface ChatMsg { username: string; displayName: string; text: string; t: number }

async function jsonOrNull<T>(r: Response): Promise<T | null> {
  try { return (await r.json()) as T; } catch { return null; }
}

export async function guestToken(): Promise<string> {
  const r = await fetch("https://api.twitter.com/1.1/guest/activate.json", { method: "POST", headers: { authorization: `Bearer ${X_BEARER}`, "User-Agent": X_UA } });
  const j = (await r.json()) as { guest_token?: string };
  if (!j.guest_token) throw new Error("no guest token");
  return j.guest_token;
}

export async function resolveBroadcastChat(id: string): Promise<ChatAccess | null> {
  if (!ID_RE.test(id)) return null;
  const gt = await guestToken();
  const H = { authorization: `Bearer ${X_BEARER}`, "x-guest-token": gt, "User-Agent": X_UA };
  const show = await jsonOrNull<{ broadcasts?: Record<string, { media_key: string; status?: string; state?: string }> }>(
    await fetch(`https://api.twitter.com/1.1/broadcasts/show.json?ids=${id}`, { headers: H }),
  );
  const bc = show?.broadcasts?.[id];
  if (!bc) return null;
  const st = await jsonOrNull<{ chatToken?: string }>(
    await fetch(`https://api.twitter.com/1.1/live_video_stream/status/${bc.media_key}?client=web`, { headers: H }),
  );
  const chatToken = st?.chatToken;
  if (!chatToken) return null;
  const acc = await jsonOrNull<{ endpoint?: string; access_token?: string; room_id?: string }>(
    await fetch("https://proxsee.pscp.tv/api/v2/accessChatPublic", { method: "POST", headers: PSCP_HEADERS, body: JSON.stringify({ chat_token: chatToken }) }),
  );
  if (!acc?.endpoint || !acc?.access_token) return null;
  const replay = acc.endpoint.includes("-replay-") || (bc.state ?? "").toUpperCase() === "ENDED";
  return { endpoint: acc.endpoint, accessToken: acc.access_token, roomId: acc.room_id ?? id, replay, title: bc.status ?? "", state: bc.state ?? "" };
}

interface RawMsg { kind?: number; payload?: string }
export function parseMsg(m: RawMsg): ChatMsg | null {
  try {
    const p = JSON.parse(m.payload ?? "{}") as { body?: string };
    const b = JSON.parse(p.body ?? "{}") as { type?: number; body?: string; username?: string; displayName?: string; timestamp?: number };
    if (b.type !== 1 || !b.body || !b.username) return null;
    return { username: b.username, displayName: b.displayName ?? b.username, text: b.body, t: b.timestamp ?? Date.now() };
  } catch {
    return null;
  }
}

export function isPscpEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === "https:" && u.hostname.endsWith(".pscp.tv");
  } catch {
    return false;
  }
}

export async function replayChatPage(endpoint: string, accessToken: string, cursor = "", limit = 200): Promise<{ messages: ChatMsg[]; cursor: string }> {
  const r = await fetch(`${endpoint}/chatapi/v1/history`, { method: "POST", headers: PSCP_HEADERS, body: JSON.stringify({ access_token: accessToken, cursor, limit }) });
  const d = await jsonOrNull<{ messages?: RawMsg[]; cursor?: string }>(r);
  if (!d) return { messages: [], cursor };
  const messages = (d.messages ?? []).map(parseMsg).filter((m): m is ChatMsg => !!m);
  return { messages, cursor: d.cursor ?? cursor };
}
