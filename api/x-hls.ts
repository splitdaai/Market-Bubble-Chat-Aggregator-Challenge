// Vercel serverless port of backend/src/xVod.ts proxyHls + /api/x-hls.
// Proxies pscp.tv playlists/segments with the Referer the CDN requires, and
// rewrites playlist URIs back through this endpoint so the whole HLS tree
// (variants, segments, keys) flows through the proxy.
import type { IncomingMessage, ServerResponse } from "node:http";

const X_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

function isPscpUrl(u: string): boolean {
  try { return new URL(u).hostname.endsWith(".pscp.tv"); } catch { return false; }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url ?? "/", "http://x");
    const rawUrl = url.searchParams.get("u") ?? "";
    if (!isPscpUrl(rawUrl)) { res.statusCode = 400; return res.end(); }
    const r = await fetch(rawUrl, { headers: { "User-Agent": X_UA, Referer: "https://x.com/", Origin: "https://x.com" } });
    const ct = r.headers.get("content-type") ?? "";
    const isPlaylist = rawUrl.includes(".m3u8") || ct.includes("mpegurl");
    res.statusCode = r.status;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=60");
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
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.end(text);
    }
    res.setHeader("Content-Type", ct || "video/mp2t");
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch {
    res.statusCode = 502;
    res.end();
  }
}
