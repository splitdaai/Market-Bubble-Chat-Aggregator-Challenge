/**
 * Read-only Twitch channel feed — live status + recent archived VODs + top
 * clips for a given login, via the Helix API using an app (client-credentials)
 * token. Powers the Stream Preview / Broadcasts / Clips embeds with real
 * content. Cached 60s per login so we never hammer Helix.
 */
interface AppToken {
  value: string;
  exp: number;
}
const token: AppToken = { value: "", exp: 0 };

async function appToken(id: string, secret: string): Promise<string> {
  if (token.value && Date.now() < token.exp) return token.value;
  const r = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secret}&grant_type=client_credentials`,
    { method: "POST" },
  );
  const j = (await r.json()) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error("twitch app token failed");
  token.value = j.access_token;
  token.exp = Date.now() + Math.max(60, (j.expires_in ?? 3600) - 120) * 1000;
  return token.value;
}

export interface TwitchVod {
  id: string;
  title: string;
  duration: string;
  createdAt: string;
  thumbnail: string;
  url: string;
}
export interface TwitchClip {
  id: string;
  title: string;
  viewCount: number;
  duration: number;
  createdAt: string;
  thumbnail: string;
  creator: string;
}
export interface TwitchChannel {
  login: string;
  displayName: string;
  userId: string;
  live: boolean;
  vods: TwitchVod[];
  clips: TwitchClip[];
}

const cache = new Map<string, { exp: number; data: TwitchChannel }>();

function sized(url: string, w: number, h: number): string {
  return (url || "")
    .replace("%{width}", String(w)).replace("%{height}", String(h))
    .replace("{width}", String(w)).replace("{height}", String(h));
}

export async function getTwitchChannel(login: string): Promise<TwitchChannel | null> {
  const id = process.env.TWITCH_CLIENT_ID;
  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!id || !secret) return null;

  const key = login.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!key) return null;
  const hit = cache.get(key);
  if (hit && Date.now() < hit.exp) return hit.data;

  const tok = await appToken(id, secret);
  const H = { "Client-Id": id, Authorization: `Bearer ${tok}` };

  const userRes = await fetch(`https://api.twitch.tv/helix/users?login=${key}`, { headers: H });
  const userJson = (await userRes.json()) as { data?: Array<{ id: string; display_name: string }> };
  const user = userJson.data?.[0];
  if (!user) return null;

  const [streams, vids, clips] = (await Promise.all([
    fetch(`https://api.twitch.tv/helix/streams?user_id=${user.id}`, { headers: H }).then((r) => r.json()),
    fetch(`https://api.twitch.tv/helix/videos?user_id=${user.id}&type=archive&first=12`, { headers: H }).then((r) => r.json()),
    fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${user.id}&first=12`, { headers: H }).then((r) => r.json()),
  ])) as [{ data?: unknown[] }, { data?: Array<Record<string, string>> }, { data?: Array<Record<string, unknown>> }];

  const data: TwitchChannel = {
    login: key,
    displayName: user.display_name,
    userId: user.id,
    live: ((streams.data as unknown[])?.length ?? 0) > 0,
    vods: ((vids.data as Array<Record<string, string>>) ?? []).map((v) => ({
      id: v.id,
      title: v.title,
      duration: v.duration,
      createdAt: v.created_at,
      thumbnail: sized(v.thumbnail_url, 320, 180),
      url: v.url,
    })),
    clips: ((clips.data as Array<Record<string, unknown>>) ?? []).map((c) => ({
      id: c.id as string,
      title: c.title as string,
      viewCount: (c.view_count as number) ?? 0,
      duration: (c.duration as number) ?? 0,
      createdAt: c.created_at as string,
      thumbnail: (c.thumbnail_url as string) ?? "",
      creator: (c.creator_name as string) ?? "",
    })),
  };

  cache.set(key, { exp: Date.now() + 60_000, data });
  return data;
}
