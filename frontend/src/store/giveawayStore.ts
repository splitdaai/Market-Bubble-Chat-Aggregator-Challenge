import { create } from "zustand";
import type { ChatMessage, GiveawayEntrant, GiveawayConfig, Platform } from "@shared/types";

/**
 * Cross-platform giveaway bot. While running, it watches the unified chat
 * firehose for the entry keyword and collects entrants from Twitch, Kick and X
 * together — then draws a single winner across all of them.
 */

type Phase = "idle" | "running" | "drawing" | "winner";

interface GiveawayState {
  phase: Phase;
  config: GiveawayConfig;
  entrants: GiveawayEntrant[];
  /** key set for O(1) uniqueness checks: `${platform}:${username}`. */
  seen: Set<string>;
  winner: GiveawayEntrant | null;

  setConfig: (patch: Partial<GiveawayConfig>) => void;
  start: () => void;
  stop: () => void;
  reset: () => void;
  /** Fed every chat message by the connection hook. */
  ingest: (m: ChatMessage) => void;
  draw: () => void;
}

const DEFAULT_CONFIG: GiveawayConfig = {
  keyword: "!enter",
  prize: "Steam gift card 🎁",
  uniqueOnly: true,
};

export const useGiveawayStore = create<GiveawayState>((set, get) => ({
  phase: "idle",
  config: DEFAULT_CONFIG,
  entrants: [],
  seen: new Set(),
  winner: null,

  setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),

  start: () =>
    set({ phase: "running", entrants: [], seen: new Set(), winner: null }),

  stop: () => set((s) => ({ phase: s.phase === "running" ? "idle" : s.phase })),

  reset: () => set({ phase: "idle", entrants: [], seen: new Set(), winner: null }),

  ingest: (m) => {
    const { phase, config } = get();
    if (phase !== "running") return;
    const text = m.message.toLowerCase();
    if (!text.includes(config.keyword.toLowerCase())) return;

    const key = `${m.platform}:${m.username.toLowerCase()}`;
    set((s) => {
      if (config.uniqueOnly && s.seen.has(key)) return s;
      const seen = new Set(s.seen);
      seen.add(key);
      return {
        seen,
        entrants: [...s.entrants, { platform: m.platform, username: m.username, at: m.timestamp }],
      };
    });
  },

  draw: () => {
    const { entrants } = get();
    if (entrants.length === 0) return;
    set({ phase: "drawing" });
    // Suspense roll, then lock the winner.
    window.setTimeout(() => {
      const winner = entrants[Math.floor(Math.random() * entrants.length)];
      set({ phase: "winner", winner });
    }, 2200);
  },
}));

/** Helper for the UI: entrant counts per platform. */
export function entrantsByPlatform(entrants: GiveawayEntrant[]): Record<Platform, number> {
  const counts: Record<Platform, number> = { twitch: 0, kick: 0, x: 0, youtube: 0 };
  for (const e of entrants) counts[e.platform] += 1;
  return counts;
}
