import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { StreamSession } from "@shared/types";
import { generateHistory } from "@/lib/mockHistory";

interface AnalyticsState {
  /** Past streams. Backend-provided when live; mock-seeded in demo mode. */
  sessions: StreamSession[];
  /** True once real history has been received from the backend. */
  live: boolean;
  /** Seed demo history (no-op in live mode or once populated). */
  ensureSeeded: () => void;
  /** Replace history with real sessions from the backend `history` event. */
  setSessions: (sessions: StreamSession[]) => void;
  /** Persist a finished session. */
  saveSession: (s: StreamSession) => void;
  /** Re-roll the demo history (demo mode only). */
  reseed: () => void;
}

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      sessions: [],
      live: false,
      ensureSeeded: () => {
        if (!get().live && get().sessions.length === 0) set({ sessions: generateHistory(12) });
      },
      setSessions: (sessions) => {
        // An empty history from the backend (no saved streams yet) must NOT wipe
        // the demo seed or flip us into "live" — otherwise analytics is stuck on
        // "Loading…" forever. Only real sessions take over.
        if (sessions.length === 0) return;
        set({ sessions, live: true });
      },
      saveSession: (s) => set((st) => ({ sessions: [...st.sessions, s] })),
      reseed: () => {
        if (!get().live) set({ sessions: generateHistory(12) });
      },
    }),
    {
      name: "vibechat-analytics-v4",
      // Never persist real (live) history — it's re-sent by the backend on connect.
      partialize: (s) => ({ sessions: s.live ? [] : s.sessions }),
    },
  ),
);
