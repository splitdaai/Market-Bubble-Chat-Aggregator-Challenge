import { create } from "zustand";
import { persist } from "zustand/middleware";
import { LATEST_EPISODE_BID } from "@/lib/broadcastConstants";

/**
 * Extra bits the LIVE readers need beyond the account list in connectionsStore:
 *   • xBroadcastId — X chat lives on a *broadcast*, not a profile, so the
 *     operator pastes the live link (x.com/i/broadcasts/<id>) each show.
 *   • kickRooms    — Kick chat rides Pusher rooms keyed by a permanent chatroom
 *     id per channel; Kick's lookup endpoint is bot-walled, so ids are resolved
 *     once (by us) and remembered here, seeded with the show's channels.
 * Persisted per browser; OBS sources receive the same values via the `ch=` URL
 * param (see lib/urlOverrides.ts) since OBS has its own storage.
 */
export const KNOWN_KICK_ROOMS: Record<string, string> = {
  ansem: "108796898",
  banks: "86037190",
};

interface LiveSourcesState {
  xBroadcastId: string;
  xBroadcastTitle: string;
  kickRooms: Record<string, string>;
  setXBroadcast: (id: string, title?: string) => void;
  setKickRoom: (slug: string, roomId: string) => void;
}

export const useLiveSourcesStore = create<LiveSourcesState>()(
  persist(
    (set) => ({
      xBroadcastId: LATEST_EPISODE_BID,
      xBroadcastTitle: "",
      kickRooms: { ...KNOWN_KICK_ROOMS },
      setXBroadcast: (id, title) => set({ xBroadcastId: id.trim(), xBroadcastTitle: title ?? "" }),
      setKickRoom: (slug, roomId) =>
        set((s) => ({ kickRooms: { ...s.kickRooms, [slug.trim().toLowerCase()]: roomId.trim() } })),
    }),
    {
      name: "vibechat-live-sources-v1",
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LiveSourcesState>;
        return { ...current, ...p, kickRooms: { ...KNOWN_KICK_ROOMS, ...(p.kickRooms ?? {}) } };
      },
    },
  ),
);

/** Room id for a Kick slug, if we know it. */
export const kickRoomFor = (slug: string, rooms: Record<string, string>) => rooms[slug.trim().toLowerCase()] ?? KNOWN_KICK_ROOMS[slug.trim().toLowerCase()];

/** `x.com/i/broadcasts/1abc…`, `twitter.com/i/broadcasts/…`, `/broadcasts/…` or a bare id → id. */
export function parseXBroadcastId(input: string): string | null {
  const s = input.trim();
  const m = s.match(/broadcasts\/([A-Za-z0-9]{6,32})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9]{6,32}$/.test(s)) return s;
  return null;
}
