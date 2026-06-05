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

export async function kickViewers(slug: string): Promise<number | null> {
  try {
    const res = await fetch(`https://kick.com/api/v2/channels/${slug}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const d = (await res.json()) as { livestream?: { viewer_count: number } | null };
    return d.livestream?.viewer_count ?? 0;
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
