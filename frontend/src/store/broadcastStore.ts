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
  /** Seconds into the clip to start at, so VODs open on different frames. */
  startAt?: number;
  live?: boolean;
}

/**
 * The live stream + recent VODs. In production each VOD is its own recording
 * URL; here they share the highlight clip but open at different points so the
 * library + playback flow is fully demonstrable.
 */
export const BROADCASTS: Broadcast[] = [
  { id: "live", title: "LIVE with Mike Majlak", date: "now", duration: "LIVE", src: "/stream-preview.mp4", startAt: 0, live: true },
  { id: "vod-1", title: "Ansem & Banks: Market Open Mayhem", date: "Yesterday", duration: "3:42:10", src: "/stream-preview.mp4", startAt: 28 },
  { id: "vod-2", title: "Fed Day Special ft. Mike Majlak", date: "3 days ago", duration: "2:58:33", src: "/stream-preview.mp4", startAt: 14 },
  { id: "vod-3", title: "Weekend Degen Trading Session", date: "5 days ago", duration: "4:12:05", src: "/stream-preview.mp4", startAt: 42 },
  { id: "vod-4", title: "$50k Polymarket Giveaway Stream", date: "1 week ago", duration: "3:30:00", src: "/stream-preview.mp4", startAt: 6 },
  { id: "vod-5", title: "All-Time-High Party 🎉", date: "2 weeks ago", duration: "5:01:48", src: "/stream-preview.mp4", startAt: 20 },
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
