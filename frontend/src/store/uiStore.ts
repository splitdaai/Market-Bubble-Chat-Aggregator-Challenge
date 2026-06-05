import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Misc dashboard UI preferences that persist across sessions. */
interface UiState {
  /** Show the trend line graphs (sparklines) in Live Stats. */
  trends: boolean;
  toggleTrends: () => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      trends: true,
      toggleTrends: () => set((s) => ({ trends: !s.trends })),
    }),
    { name: "vibechat-ui" },
  ),
);
