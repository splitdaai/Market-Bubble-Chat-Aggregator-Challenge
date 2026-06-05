import type { Clip } from "../../shared/types.ts";

/**
 * Cut a native platform clip for a flagged moment. Currently implements Twitch
 * (Helix Create Clip), which needs a USER token with the `clips:edit` scope and
 * the broadcaster id. Returns the public clip URL, or null when not configured /
 * unsupported (the frontend keeps its chat-context clip either way).
 */
export async function createClip(clip: Clip): Promise<string | null> {
  const platform = clip.sourcePlatform ?? "twitch";
  if (platform !== "twitch") return null;

  const clientId = process.env.TWITCH_CLIENT_ID;
  const userToken = process.env.TWITCH_USER_TOKEN;
  const broadcasterId = process.env.TWITCH_BROADCASTER_ID;
  if (!clientId || !userToken || !broadcasterId) {
    console.warn("clip:create — Twitch clip not configured (need TWITCH_CLIENT_ID, TWITCH_USER_TOKEN, TWITCH_BROADCASTER_ID)");
    return null;
  }

  try {
    const res = await fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${broadcasterId}`, {
      method: "POST",
      headers: { "Client-Id": clientId, Authorization: `Bearer ${userToken}` },
    });
    if (!res.ok) {
      console.error("clip:create failed", res.status, await res.text());
      return null;
    }
    const d = (await res.json()) as { data?: { id: string }[] };
    const id = d.data?.[0]?.id;
    return id ? `https://clips.twitch.tv/${id}` : null;
  } catch (e) {
    console.error("clip:create error", e);
    return null;
  }
}
