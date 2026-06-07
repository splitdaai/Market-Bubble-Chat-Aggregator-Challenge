import { create } from "zustand";

export type View = "live" | "analytics" | "market" | "content";

interface ViewState {
  view: View;
  setView: (v: View) => void;
}

/** Top-level tab: the live dashboard vs the analytics tab. */
export const useViewStore = create<ViewState>((set) => ({
  view: "live",
  setView: (view) => set({ view }),
}));
