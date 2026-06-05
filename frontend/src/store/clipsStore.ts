import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Clip, Platform } from "@shared/types";
import { useChatStore } from "./chatStore";
import { useStatsStore } from "./statsStore";

/** How many surrounding chat lines to snapshot into a clip. */
const CONTEXT_LINES = 14;

let seq = 0;

interface ClipsState {
  clips: Clip[];
  /** Capture the current moment: surrounding chat + live viewer counts. */
  capture: (reason: Clip["reason"], label?: string) => Clip;
  remove: (id: string) => void;
  clear: () => void;
  setExternalUrl: (id: string, url: string) => void;
}

export const useClipsStore = create<ClipsState>()(
  persist(
    (set) => ({
      clips: [],

      capture: (reason, label) => {
        const msgs = useChatStore.getState().messages.slice(-CONTEXT_LINES);
        const snap = useStatsStore.getState().snapshot;
        const viewers: Partial<Record<Platform, number>> = {
          twitch: snap.perPlatform.twitch.viewers,
          kick: snap.perPlatform.kick.viewers,
          x: snap.perPlatform.x.viewers,
        };
        seq += 1;
        const now = Date.now();
        const clip: Clip = {
          id: `clip-${now}-${seq}`,
          createdAt: now,
          label: label ?? defaultLabel(reason),
          reason,
          viewers,
          context: msgs.map((m) => ({ platform: m.platform, username: m.username, message: m.message })),
        };
        set((s) => ({ clips: [clip, ...s.clips].slice(0, 50) }));
        return clip;
      },

      remove: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),
      clear: () => set({ clips: [] }),
      setExternalUrl: (id, externalUrl) =>
        set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, externalUrl } : c)) })),
    }),
    { name: "vibechat-clips" },
  ),
);

function defaultLabel(reason: Clip["reason"]): string {
  return reason === "auto-radar" ? "Auto · chat spike" : "Manual clip";
}
