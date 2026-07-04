// Vercel serverless port of backend/src/xVod.ts resolveXVod + /api/x-vod/:id.
// The EC2 backend was retired; these functions keep the full-episode replay
// working from the same origin the frontend is served from.
import type { IncomingMessage, ServerResponse } from "node:http";

const X_BEARER = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const X_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function guestToken(): Promise<string> {
  const r = await fetch("https://api.twitter.com/1.1/guest/activate.json", { method: "POST", headers: { authorization: `Bearer ${X_BEARER}`, "User-Agent": X_UA } });
  const j = (await r.json()) as { guest_token?: string };
  if (!j.guest_token) throw new Error("no guest token");
  return j.guest_token;
}

async function resolveXVod(id: string): Promise<{ master: string; title: string; state: string } | null> {
  const gt = await guestToken();
  const H = { authorization: `Bearer ${X_BEARER}`, "x-guest-token": gt, "User-Agent": X_UA } as Record<string, string>;
  const show = (await (await fetch(`https://api.twitter.com/1.1/broadcasts/show.json?ids=${id}&include_events=true`, { headers: H })).json()) as {
    broadcasts?: Record<string, { media_key: string; status?: string; state?: string }>;
  };
  const bc = show.broadcasts?.[id];
  if (!bc?.media_key) return null;
  const st = (await (await fetch(`https://api.twitter.com/1.1/live_video_stream/status/${bc.media_key}?client=web`, { headers: H })).json()) as {
    source?: Record<string, unknown>;
  };
  const master = (st.source?.location ?? st.source?.noRedirectPlaybackUrl) as string | undefined;
  if (!master) return null;
  return { master, title: bc.status ?? "", state: bc.state ?? "" };
}

export default async function handler(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: ServerResponse & { json?: (b: unknown) => void }) {
  try {
    const url = new URL(req.url ?? "/", "http://x");
    const id = String((req.query?.id as string) ?? url.pathname.split("/").pop() ?? "").replace(/[^0-9a-zA-Z]/g, "");
    if (!id) { res.statusCode = 400; return res.end(JSON.stringify({ error: "missing id" })); }
    const v = await resolveXVod(id);
    if (!v) { res.statusCode = 404; return res.end(JSON.stringify({ error: "unavailable" })); }
    res.statusCode = 200;
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify({ master: `/api/x-hls?u=${encodeURIComponent(v.master)}`, title: v.title, state: v.state }));
  } catch {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: "x vod failed" }));
  }
}
