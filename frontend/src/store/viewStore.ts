import { create } from "zustand";

export type View = "live" | "analytics" | "market" | "content" | "kol";

interface ViewState {
  view: View;
  setView: (v: View) => void;
}

const views: View[] = ["live", "market", "content", "kol", "analytics"];

function initialView(): View {
  if (typeof window === "undefined") return "live";
  const params = new URLSearchParams(window.location.search);
  const requested = params.get("view") ?? params.get("tab") ?? window.location.hash.replace(/^#/, "");
  return views.includes(requested as View) ? (requested as View) : "live";
}

/** Top-level page tab for the dashboard shell. */
export const useViewStore = create<ViewState>((set) => ({
  view: initialView(),
  setView: (view) => set({ view }),
}));
