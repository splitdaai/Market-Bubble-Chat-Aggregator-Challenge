import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Whether the in-dashboard stream preview is collapsed. */
interface PreviewState {
  hidden: boolean;
  toggle: () => void;
}

export const usePreviewStore = create<PreviewState>()(
  persist(
    (set) => ({
      hidden: false,
      toggle: () => set((s) => ({ hidden: !s.hidden })),
    }),
    { name: "vibechat-preview" },
  ),
);
