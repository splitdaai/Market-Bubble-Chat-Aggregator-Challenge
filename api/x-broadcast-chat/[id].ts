// Serverless port of GET /api/x-broadcast-chat/:id — a batch of real chat
// messages from a broadcast (demo mode drips these into the unified feed).
// Cold call walks replay history pages sequentially; capped + maxDuration 60.
import type { IncomingMessage, ServerResponse } from "node:http";
import { ID_RE, resolveBroadcastChat, replayChatPage, type ChatMsg } from "../_xchat.js";

export const config = { maxDuration: 60 };

export default async function handler(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const url = new URL(req.url ?? "/", "http://x");
    const id = String((req.query?.id as string) ?? url.pathname.split("/").pop() ?? "");
    if (!ID_RE.test(id)) { res.statusCode = 400; return res.end(JSON.stringify({ error: "bad id" })); }
    const access = await resolveBroadcastChat(id);
    if (!access) { res.statusCode = 200; return res.end(JSON.stringify({ title: "", messages: [] })); }
    const dedup = new Map<string, ChatMsg>();
    let cursor = "";
    for (let i = 0; i < 40 && dedup.size < 150; i++) {
      const page = await replayChatPage(access.endpoint, access.accessToken, cursor);
      for (const m of page.messages) dedup.set(`${m.username}:${m.text}`, m);
      if (!page.cursor || page.cursor === cursor) break;
      cursor = page.cursor;
    }
    const out = [...dedup.values()].sort((a, b) => a.t - b.t);
    res.setHeader("Cache-Control", "public, max-age=1800, stale-while-revalidate=3600");
    res.statusCode = 200;
    res.end(JSON.stringify({ title: access.title, messages: out }));
  } catch {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "x chat fetch failed" }));
  }
}
