import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Demo vs Live. When `demo` is on, the mock firehose generates fake data so the
 * UI is alive with zero infrastructure. LIVE is the default (the operator's own
 * channels, real chat); Demo is opt-in via the pill or `?mode=demo`.
 */
interface ModeState {
  demo: boolean;
  setDemo: (v: boolean) => void;
  toggle: () => void;
}

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      demo: false,
      setDemo: (demo) => set({ demo }),
      toggle: () => set((s) => ({ demo: !s.demo })),
    }),
    { name: "vibechat-mode-v2" }, // v2: default flipped to LIVE
  ),
);
