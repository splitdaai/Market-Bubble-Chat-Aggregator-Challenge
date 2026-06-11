/**
 * Real viewer-count fetchers. These hit the live platform APIs so the dashboard
 * shows actual concurrent viewers. All are best-effort and return null on
 * failure (missing creds, offline stream, rate limit) so the aggregator simply
 * keeps the last value.
 */

/* ----------------------------------- Twitch ---------------------------------- */

let twitchToken: { value: string; exp: number } | null = null;

/** App access token via client-credentials (cached until expiry). */
async function getTwitchAppToken(clientId: string, secret: string): Promise<string | null> {
  if (twitchToken && Date.now() < twitchToken.exp) return twitchToken.value;
  try {
    const res = await fetch(
      `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${secret}&grant_type=client_credentials`,
      { method: "POST" },
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { access_token: string; expires_in: number };
    twitchToken = { value: d.access_token, exp: Date.now() + (d.expires_in - 60) * 1000 };
    return twitchToken.value;
  } catch {
    return null;
  }
}

/** Live viewer count for a Twitch channel (0 if offline). */
export async function twitchViewers(login: string, clientId: string, secret: string): Promise<number | null> {
  const token = await getTwitchAppToken(clientId, secret);
  if (!token) return null;
  try {
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${login}`, {
      headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { data?: { viewer_count: number }[] };
    return d.data?.[0]?.viewer_count ?? 0;
  } catch {
    return null;
  }
}

/* ------------------------------------ Kick ----------------------------------- */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileP = promisify(execFile);
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

/** Viewers + follower total in ONE call. Cloudflare 403s Node fetch's TLS
 *  fingerprint on kick.com, so curl goes first (same trick as the chat
 *  connector's chatroom-id resolution), fetch as fallback. */
export async function kickChannel(slug: string): Promise<{ viewers: number; followers: number } | null> {
  const url = `https://kick.com/api/v2/channels/${slug}`;
  const parse = (d: { livestream?: { viewer_count: number } | null; followers_count?: number }) =>
    ({ viewers: d?.livestream?.viewer_count ?? 0, followers: d?.followers_count ?? 0 });
  try {
    const { stdout } = await execFileP(
      "curl",
      ["-s", "--max-time", "10", "-H", `User-Agent: ${BROWSER_UA}`, "-H", "Accept: application/json", "-H", "Accept-Language: en-US,en;q=0.9", url],
      { maxBuffer: 4 * 1024 * 1024 },
    );
    return parse(JSON.parse(stdout));
  } catch { /* curl missing or Cloudflare-blocked — try fetch */ }
  try {
    const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": BROWSER_UA } });
    if (!res.ok) return null;
    return parse((await res.json()) as Parameters<typeof parse>[0]);
  } catch {
    return null;
  }
}

export async function kickViewers(slug: string): Promise<number | null> {
  return (await kickChannel(slug))?.viewers ?? null;
}

/* --------------------------- Followers (no-auth) ------------------------------ */

/** Twitch follower total via decapi.me (free, no auth — verified live). */
export async function twitchFollowers(login: string): Promise<number | null> {
  try {
    const r = await fetch(`https://decapi.me/twitch/followcount/${login}`);
    if (!r.ok) return null;
    const n = Number((await r.text()).trim());
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

/* ---------------------------------- YouTube ---------------------------------- */

/** Concurrent viewers for a YouTube live video via the Data API v3. */
export async function youtubeViewers(videoId: string, apiKey: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${apiKey}`,
    );
    if (!res.ok) return null;
    const d = (await res.json()) as { items?: { liveStreamingDetails?: { concurrentViewers?: string } }[] };
    const v = d.items?.[0]?.liveStreamingDetails?.concurrentViewers;
    return v ? Number(v) : 0;
  } catch {
    return null;
  }
}
