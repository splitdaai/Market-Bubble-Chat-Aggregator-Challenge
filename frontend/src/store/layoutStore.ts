import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Layout, PanelLayout, WidgetKind, ActionButton } from "@shared/types";

/** The layout the app ships with on first run. */
const DEFAULT_LAYOUT: Layout = {
  version: 1,
  panels: [
    // Live Stats — tall column down the LEFT (all per-platform/channel data).
    { i: "stats-1", widget: "stats", x: 0, y: 0, w: 5, h: 40, minW: 4, minH: 10 },
    // Stream preview in the middle.
    { i: "preview-1", widget: "stream-preview", x: 5, y: 0, w: 4, h: 15, minW: 3, minH: 4 },
    // Chat down the right side.
    { i: "feed-1", widget: "chat-feed", x: 9, y: 0, w: 3, h: 40, minW: 3, minH: 6 },
    // Middle column under the preview: consolidated ops + leaderboards + users.
    { i: "ops-1", widget: "ops", x: 5, y: 15, w: 4, h: 14, minW: 3, minH: 8 },
    { i: "chatters-1", widget: "top-chatters", x: 5, y: 29, w: 4, h: 11, minW: 2, minH: 6 },
    { i: "users-1", widget: "user-list", x: 5, y: 40, w: 4, h: 11, minW: 3, minH: 6 },
  ],
};

/** Starter action buttons for the Button Deck. */
const DEFAULT_BUTTONS: ActionButton[] = [
  { id: "b-raid", label: "Raid", icon: "Swords", color: "#b14dff", platforms: ["twitch"], command: "/raid {target}" },
  { id: "b-slow", label: "Slow Mode", icon: "Timer", color: "#2dd4ff", platforms: ["twitch", "kick"], command: "/slow 30" },
  { id: "b-hype", label: "Hype Train", icon: "Rocket", color: "#53fc18", platforms: ["twitch"], command: "/hype" },
  { id: "b-shout", label: "Shoutout", icon: "Megaphone", color: "#ff7edb", platforms: ["twitch", "kick", "x"], command: "/so {target}" },
];

interface LayoutState {
  editMode: boolean;
  layout: Layout;
  buttons: ActionButton[];

  setEditMode: (v: boolean) => void;
  toggleEditMode: () => void;
  /** react-grid-layout reports new geometry; merge x/y/w/h back into panels. */
  updateGeometry: (items: { i: string; x: number; y: number; w: number; h: number }[]) => void;
  addPanel: (widget: WidgetKind) => void;
  removePanel: (i: string) => void;
  resetLayout: () => void;

  addButton: (b: ActionButton) => void;
  updateButton: (b: ActionButton) => void;
  removeButton: (id: string) => void;
}

let panelSeq = 100;

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      editMode: false,
      layout: DEFAULT_LAYOUT,
      buttons: DEFAULT_BUTTONS,

      setEditMode: (editMode) => set({ editMode }),
      toggleEditMode: () => set((s) => ({ editMode: !s.editMode })),

      updateGeometry: (items) =>
        set((s) => {
          const byId = new Map(items.map((it) => [it.i, it]));
          return {
            layout: {
              ...s.layout,
              panels: s.layout.panels.map((p) => {
                const g = byId.get(p.i);
                return g ? { ...p, x: g.x, y: g.y, w: g.w, h: g.h } : p;
              }),
            },
          };
        }),

      addPanel: (widget) =>
        set((s) => {
          panelSeq += 1;
          const panel: PanelLayout = {
            i: `${widget}-${panelSeq}`,
            widget,
            x: 0,
            y: Infinity, // react-grid-layout drops it at the bottom
            w: widget === "chat-feed" ? 5 : 3,
            h: widget === "chat-feed" ? 12 : 5,
            minW: 2,
            minH: 3,
          };
          return { layout: { ...s.layout, panels: [...s.layout.panels, panel] } };
        }),

      removePanel: (i) =>
        set((s) => ({
          layout: { ...s.layout, panels: s.layout.panels.filter((p) => p.i !== i) },
        })),

      resetLayout: () => set({ layout: DEFAULT_LAYOUT }),

      addButton: (b) => set((s) => ({ buttons: [...s.buttons, b] })),
      updateButton: (b) =>
        set((s) => ({ buttons: s.buttons.map((x) => (x.id === b.id ? b : x)) })),
      removeButton: (id) => set((s) => ({ buttons: s.buttons.filter((x) => x.id !== id) })),
    }),
    { name: "vibechat-layout-v9" },
  ),
);
