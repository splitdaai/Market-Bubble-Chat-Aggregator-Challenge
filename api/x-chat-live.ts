// Long-poll relay for LIVE X broadcast chat.
//
// Chatman (X's chat backend) refuses WebSocket upgrades from third-party
// browser Origins, and its /history endpoint 404s on live (ancillary)
// endpoints — so the browser cannot read a live room directly. This function
// bridges: it opens the chatman WS server-side (where we control the Origin),
// does the two-step handshake (auth kind 3 → join kind 2/{body:{room}}),
// collects chat for up to ~10s — returning EARLY as soon as messages arrive —
// and hands the batch to the browser, which immediately calls again.
// Stateless per call; the client dedups (username:text:t) across batches.
//
//   POST /api/x-chat-live { endpoint, accessToken, roomId } → { messages, open }
import type { IncomingMessage, ServerResponse } from "node:http";
import WebSocket from "ws";
import { X_UA, isPscpEndpoint, type ChatMsg } from "./_xchat.js";

const WINDOW_MS = 10_000; // max hold per call (function maxDuration is 30s)
const BURST_MS = 350; // after the first message, wait briefly to batch a burst
const JOIN_DELAY_MS = 250;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let s = "";
    req.on("data", (c) => { s += c; if (s.length > 8_192) reject(new Error("too large")); });
    req.on("end", () => resolve(s));
    req.on("error", reject);
  });
}

function parseFrame(raw: string): ChatMsg | null {
  try {
    const env = JSON.parse(raw) as { payload?: string };
    const p = JSON.parse(env.payload ?? "{}") as { body?: string };
    const b = JSON.parse(p.body ?? "{}") as { type?: number; body?: string; username?: string; displayName?: string; timestamp?: number };
    if (b.type !== 1 || !b.body || !b.username) return null;
    return { username: b.username, displayName: b.displayName ?? b.username, text: b.body, t: b.timestamp ?? Date.now() };
  } catch {
    return null;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") { res.statusCode = 405; return res.end(JSON.stringify({ error: "post only" })); }
    const body = JSON.parse((await readBody(req)) || "{}") as { endpoint?: string; accessToken?: string; roomId?: string };
    if (!body.endpoint || !body.accessToken || !body.roomId || !isPscpEndpoint(body.endpoint)) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "bad endpoint" }));
    }
    const { endpoint, accessToken, roomId } = body;

    const out = await new Promise<{ messages: ChatMsg[]; open: boolean }>((resolve) => {
      const messages: ChatMsg[] = [];
      let settled = false;
      let sockOpen = false;
      const ws = new WebSocket(`${endpoint.replace(/^http/, "ws")}/chatapi/v1/chatnow`, {
        headers: { Origin: "https://x.com", "User-Agent": X_UA },
      });
      const timers: NodeJS.Timeout[] = [];
      const finish = (open: boolean) => {
        if (settled) return;
        settled = true;
        timers.forEach(clearTimeout);
        try { ws.terminate(); } catch { /* ignore */ }
        resolve({ messages, open });
      };
      ws.on("open", () => {
        sockOpen = true;
        ws.send(JSON.stringify({ payload: JSON.stringify({ access_token: accessToken }), kind: 3 }));
        timers.push(setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ payload: JSON.stringify({ body: JSON.stringify({ room: roomId }), kind: 1 }), kind: 2 }));
          }
        }, JOIN_DELAY_MS));
      });
      ws.on("message", (raw) => {
        const m = parseFrame(raw.toString());
        if (!m) return;
        messages.push(m);
        if (messages.length === 1) timers.push(setTimeout(() => finish(true), BURST_MS));
        if (messages.length >= 80) finish(true);
      });
      ws.on("close", () => finish(sockOpen));
      ws.on("error", () => finish(false));
      timers.push(setTimeout(() => finish(sockOpen), WINDOW_MS));
    });

    res.statusCode = 200;
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "x live chat failed", detail: e instanceof Error ? e.message : String(e) }));
  }
}
