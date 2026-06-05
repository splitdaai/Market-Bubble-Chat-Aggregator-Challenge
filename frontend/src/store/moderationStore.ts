import { create } from "zustand";
import type { Platform } from "@shared/types";

/** Active timeout for a viewer, tracked so durations can stack / reduce / clear. */
export interface ActiveTimeout {
  /** Accumulated total timeout in seconds. */
  seconds: number;
  /** When the current total was last (re)applied — for a live countdown. */
  setAt: number;
}

const keyOf = (platform: Platform, name: string) => `${platform}:${name.toLowerCase()}`;

interface ModState {
  timeouts: Record<string, ActiveTimeout>;
  banned: Record<string, boolean>;

  getTimeout: (platform: Platform, name: string) => ActiveTimeout | undefined;
  isBanned: (platform: Platform, name: string) => boolean;
  /** Stack `delta` seconds onto the running total; returns the new total. */
  addTimeout: (platform: Platform, name: string, delta: number) => number;
  /** Reduce the running total by `delta` (clamped at 0); returns the new total. */
  reduceTimeout: (platform: Platform, name: string, delta: number) => number;
  /** Clear a viewer's timeout entirely. */
  clearTimeout: (platform: Platform, name: string) => void;
  setBanned: (platform: Platform, name: string, v: boolean) => void;
}

export const useModerationStore = create<ModState>((set, get) => ({
  timeouts: {},
  banned: {},

  getTimeout: (platform, name) => get().timeouts[keyOf(platform, name)],
  isBanned: (platform, name) => !!get().banned[keyOf(platform, name)],

  addTimeout: (platform, name, delta) => {
    const k = keyOf(platform, name);
    const cur = get().timeouts[k]?.seconds ?? 0;
    const seconds = cur + delta;
    set((s) => ({ timeouts: { ...s.timeouts, [k]: { seconds, setAt: Date.now() } } }));
    return seconds;
  },

  reduceTimeout: (platform, name, delta) => {
    const k = keyOf(platform, name);
    const cur = get().timeouts[k]?.seconds ?? 0;
    const seconds = Math.max(0, cur - delta);
    set((s) => {
      const next = { ...s.timeouts };
      if (seconds <= 0) delete next[k];
      else next[k] = { seconds, setAt: Date.now() };
      return { timeouts: next };
    });
    return seconds;
  },

  clearTimeout: (platform, name) => {
    const k = keyOf(platform, name);
    set((s) => {
      const next = { ...s.timeouts };
      delete next[k];
      return { timeouts: next };
    });
  },

  setBanned: (platform, name, v) => {
    const k = keyOf(platform, name);
    set((s) => ({ banned: { ...s.banned, [k]: v } }));
  },
}));

/** Format a duration in seconds as "1d 2h 5m" / "15m" / "30s". */
export function fmtDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, !d && !h && s && `${s}s`].filter(Boolean).join(" ") || "0s";
}

/** The stackable timeout presets the moderator picks from. */
export const TIMEOUT_PRESETS: { label: string; seconds: number }[] = [
  { label: "1m", seconds: 60 },
  { label: "5m", seconds: 300 },
  { label: "15m", seconds: 900 },
  { label: "1h", seconds: 3600 },
  { label: "1d", seconds: 86400 },
];
