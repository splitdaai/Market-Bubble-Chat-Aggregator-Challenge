// YouTube live chat for the browser — $0, no API key, no quota.
//   GET /api/yt-chat?target=@handle            → { live, videoId, title, channelName, continuation, apiKey, clientVersion } | { live:false, retryMs }
//   GET /api/yt-chat?continuation=…&key=…&cv=… → { messages, continuation, timeoutMs, live }
// Stateless: the browser round-trips `continuation`. The resolve step is edge-
// cached briefly so several open tabs (dashboard, pop-out, OBS dock) share it.
import type { IncomingMessage, ServerResponse } from "node:http";
import { pollChat, resolveLive, targetUrl } from "./_ytchat.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const url = new URL(req.url ?? "/", "http://x");
    const continuation = url.searchParams.get("continuation");
    if (continuation) {
      if (continuation.length < 40 || continuation.length > 4000) { res.statusCode = 400; return res.end(JSON.stringify({ error: "bad continuation" })); }
      const key = url.searchParams.get("key") || undefined;
      const cv = url.searchParams.get("cv") || undefined;
      const out = await pollChat(continuation, key, cv);
      res.setHeader("Cache-Control", "no-store");
      res.statusCode = 200;
      return res.end(JSON.stringify(out));
    }
    const target = url.searchParams.get("target") ?? "";
    if (!targetUrl(target)) { res.statusCode = 400; return res.end(JSON.stringify({ error: "bad target" })); }
    const out = await resolveLive(target);
    if (!out) { res.statusCode = 400; return res.end(JSON.stringify({ error: "bad target" })); }
    // Live: short cache so tabs share one resolve. Off-air: cache a bit longer.
    res.setHeader("Cache-Control", out.live ? "public, max-age=20" : "public, max-age=45");
    res.statusCode = 200;
    res.end(JSON.stringify(out));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "youtube chat failed", detail: e instanceof Error ? e.message : String(e) }));
  }
}
