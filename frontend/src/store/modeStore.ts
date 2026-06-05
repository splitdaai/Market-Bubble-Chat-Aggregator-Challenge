import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Demo vs Live. When `demo` is on, the mock firehose generates fake data so the
 * UI is alive with zero infrastructure. Turn it off to go live — the app then
 * takes data only from the real backend (and shows empty/connecting if none).
 */
interface ModeState {
  demo: boolean;
  setDemo: (v: boolean) => void;
  toggle: () => void;
}

export const useModeStore = create<ModeState>()(
  persist(
    (set) => ({
      demo: true,
      setDemo: (demo) => set({ demo }),
      toggle: () => set((s) => ({ demo: !s.demo })),
    }),
    { name: "vibechat-mode" },
  ),
);
