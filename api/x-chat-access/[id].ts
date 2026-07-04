// Chat-room credentials for the browser: the guest chat WS (chatnow) has no
// CORS restriction, so the frontend connects to X's chat relay DIRECTLY once
// this function hands it { endpoint, accessToken, roomId }. Short cache — a
// TIMED_OUT→RUNNING blip mints a new chat token.
import type { IncomingMessage, ServerResponse } from "node:http";
import { ID_RE, resolveBroadcastChat } from "../_xchat.js";

export default async function handler(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const url = new URL(req.url ?? "/", "http://x");
    const id = String((req.query?.id as string) ?? url.pathname.split("/").pop() ?? "");
    if (!ID_RE.test(id)) { res.statusCode = 400; return res.end(JSON.stringify({ error: "bad id" })); }
    const access = await resolveBroadcastChat(id);
    if (!access) { res.statusCode = 404; return res.end(JSON.stringify({ error: "unavailable" })); }
    res.setHeader("Cache-Control", "public, max-age=15");
    res.statusCode = 200;
    res.end(JSON.stringify(access));
  } catch {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "x chat access failed" }));
  }
}
