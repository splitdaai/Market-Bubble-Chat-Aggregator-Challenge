/**
 * X broadcast replay (VOD) resolver + HLS proxy.
 *
 * Uses X's anonymous *guest* web endpoints (the pscp.tv / Periscope infra X Live
 * still runs on). Public broadcast VIDEO needs no login — only reading the live
 * CHAT would require an account, which we deliberately don't do. So this is
 * fully risk-free: no auth_token, no burner, nothing tied to an X account.
 *
 * Flow: broadcast id -> show.json -> media_key -> live_video_stream/status ->
 * HLS master .m3u8. pscp hotlink-protects the stream (needs Referer https://x.com),
 * so we proxy the playlist + segments through our origin, rewriting playlist URIs
 * back through the proxy and adding the Referer the CDN requires.
 */

// Public x.com web-app bearer (anonymous; same token the logged-out site uses).
const BEARER = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

let guest: { token: string; exp: number } | null = null;
async function guestToken(): Promise<string> {
  if (guest && Date.now() < guest.exp) return guest.token;
  const r = await fetch("https://api.twitter.com/1.1/guest/activate.json", { method: "POST", headers: { authorization: `Bearer ${BEARER}`, "User-Agent": UA } });
  const j = (await r.json()) as { guest_token?: string };
  if (!j.guest_token) throw new Error("no guest token");
  guest = { token: j.guest_token, exp: Date.now() + 2.5 * 3600_000 };
  return guest.token;
}

const ID_RE = /^[A-Za-z0-9]+$/;
const vodCache = new Map<string, { exp: number; data: { master: string; title: string; state: string } }>();

/** Resolve a broadcast id to its (raw) HLS master URL + title + state. */
export async function resolveXVod(id: string): Promise<{ master: string; title: string; state: string } | null> {
  if (!ID_RE.test(id)) return null;
  const hit = vodCache.get(id);
  if (hit && Date.now() < hit.exp) return hit.data;
  try {
    const gt = await guestToken();
    const H = { authorization: `Bearer ${BEARER}`, "x-guest-token": gt, "User-Agent": UA };
    const show = (await (await fetch(`https://api.twitter.com/1.1/broadcasts/show.json?ids=${id}&include_events=true`, { headers: H })).json()) as { broadcasts?: Record<string, { media_key: string; status?: string; state?: string }> };
    const bc = show?.broadcasts?.[id];
    if (!bc) return null;
    const st = (await (await fetch(`https://api.twitter.com/1.1/live_video_stream/status/${bc.media_key}?client=web`, { headers: H })).json()) as { source?: Record<string, unknown> };
    const src = st?.source ?? {};
    const named = [src.location, src.noRedirectPlaybackUrl, src.streamMasterUrl, src.url];
    const m3u8 = (named.find((x) => typeof x === "string" && (x as string).includes(".m3u8")) ?? Object.values(src).find((v) => typeof v === "string" && (v as string).includes(".m3u8"))) as string | undefined;
    if (!m3u8) return null;
    const data = { master: m3u8, title: bc.status ?? "", state: bc.state ?? "" };
    vodCache.set(id, { exp: Date.now() + 10 * 60_000, data });
    return data;
  } catch {
    return null;
  }
}

/** SSRF guard — only ever proxy pscp.tv video hosts. */
export function isPscpUrl(u: string): boolean {
  try { return new URL(u).hostname.endsWith(".pscp.tv"); } catch { return false; }
}

/**
 * Fetch a pscp.tv playlist/segment with the required Referer. For playlists we
 * rewrite every URI back through `/api/x-hls` (resolved absolute) so the whole
 * tree — variants, segments, keys — flows through this proxy too.
 */
export async function proxyHls(rawUrl: string): Promise<{ status: number; contentType: string; body: Buffer | string } | null> {
  if (!isPscpUrl(rawUrl)) return null;
  const r = await fetch(rawUrl, { headers: { "User-Agent": UA, Referer: "https://x.com/", Origin: "https://x.com" } });
  const ct = r.headers.get("content-type") ?? "";
  const isPlaylist = rawUrl.includes(".m3u8") || ct.includes("mpegurl");
  if (isPlaylist) {
    const rewrite = (uri: string) => `/api/x-hls?u=${encodeURIComponent(new URL(uri, rawUrl).toString())}`;
    const text = (await r.text())
      .split("\n")
      .map((line) => {
        const t = line.trim();
        if (!t) return line;
        if (t.startsWith("#")) return line.replace(/URI="([^"]+)"/g, (_m, u) => `URI="${rewrite(u)}"`);
        return rewrite(t);
      })
      .join("\n");
    return { status: r.status, contentType: "application/vnd.apple.mpegurl", body: text };
  }
  return { status: r.status, contentType: ct || "video/mp2t", body: Buffer.from(await r.arrayBuffer()) };
}
