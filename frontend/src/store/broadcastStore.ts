import { create } from "zustand";

/** A broadcast — the live stream or a past VOD, playable in the stream preview. */
export interface Broadcast {
  id: string;
  title: string;
  /** Friendly recency label, e.g. "2 days ago". */
  date: string;
  /** Original broadcast length label (the preview clip is a highlight). */
  duration: string;
  src: string;
  /** Seconds into the clip to start playback at (defaults to 0). */
  startAt?: number;
  live?: boolean;
  /** X broadcast id — when set, the preview plays the FULL episode replay via the
   *  HLS proxy instead of the local highlight clip. */
  bid?: string | null;
}

/**
 * The live stream + the real past episodes. Each past entry maps to its actual X
 * broadcast replay (`bid`) so selecting it streams the FULL episode in the
 * preview; the local `src` clip is just the list thumbnail / fallback. EP1 has
 * only a highlight (no full replay posted), so it keeps the local clip.
 */
export const BROADCASTS: Broadcast[] = [
  { id: "live", title: "LIVE with Mike Majlak", date: "now", duration: "LIVE", src: "/stream-preview.mp4", startAt: 0, live: true },
  { id: "ep-5", title: "The Dollar Is Going to Zero", date: "Jun 5, 2026", duration: "4:42:00", src: "/vods/vod-1.mp4", bid: "1dxYllbQZELJX" },
  { id: "ep-4", title: "Why Ansem Thinks Ethereum Is Done", date: "May 22, 2026", duration: "2:54:00", src: "/vods/vod-2.mp4", bid: "1OxwbldAYLDJB" },
  { id: "ep-3", title: "How to Get Rich Playing GTA 6", date: "May 15, 2026", duration: "3:33:00", src: "/vods/vod-3.mp4", bid: "1DGleEgbRRzJL" },
  { id: "ep-2", title: "Why AI Is Beating Crypto Right Now", date: "May 8, 2026", duration: "3:45:00", src: "/vods/vod-4.mp4", bid: "1DGleEqQkYVJL" },
  { id: "ep-1", title: "The Truth About Crypto in 2026", date: "May 1, 2026", duration: "1:06:00", src: "/vods/vod-5.mp4", bid: null },
];

interface BroadcastState {
  currentId: string;
  select: (id: string) => void;
  current: () => Broadcast;
}

export const useBroadcastStore = create<BroadcastState>((set, get) => ({
  currentId: "live",
  select: (currentId) => set({ currentId }),
  current: () => BROADCASTS.find((b) => b.id === get().currentId) ?? BROADCASTS[0],
}));
