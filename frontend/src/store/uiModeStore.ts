import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Simple vs Pro shell. `simple` = the clean stock view (just the stream + the
 * unified chat — Banks' core). `pro` reveals all the extras (market terminal,
 * KOL, analytics, stats, ticker, watchlist, edit). Default is `simple` so a
 * first-time visitor sees a focused, premium product; one tap unlocks the rest.
 */
interface UiModeState {
  mode: "simple" | "pro";
  setMode: (m: "simple" | "pro") => void;
  toggle: () => void;
}

export const useUiModeStore = create<UiModeState>()(
  persist(
    (set) => ({
      mode: "simple",
      setMode: (mode) => set({ mode }),
      toggle: () => set((s) => ({ mode: s.mode === "simple" ? "pro" : "simple" })),
    }),
    { name: "vibechat-uimode" },
  ),
);
