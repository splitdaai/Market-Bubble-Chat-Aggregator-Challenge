import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OverlayElement, OverlaySource } from "@shared/types";

/**
 * On-screen / OBS overlay. The user freely positions viewer-count badges
 * anywhere on screen; positions persist and are read by both the in-app overlay
 * layer and the standalone `?overlay=1` OBS browser-source route.
 */

const DEFAULTS: OverlayElement[] = [
  { id: "ov-combined", source: "combined", x: 40, y: 90, scale: 1, showLabel: true, visible: true },
  { id: "ov-twitch", source: "twitch", x: 40, y: 160, scale: 1, showLabel: true, visible: false },
  { id: "ov-kick", source: "kick", x: 40, y: 220, scale: 1, showLabel: true, visible: false },
  { id: "ov-x", source: "x", x: 40, y: 280, scale: 1, showLabel: true, visible: false },
];

interface OverlayState {
  enabled: boolean; // overlay shown over the dashboard (edit/preview)
  elements: OverlayElement[];

  setEnabled: (v: boolean) => void;
  toggleEnabled: () => void;
  toggleSource: (source: OverlaySource) => void;
  move: (id: string, x: number, y: number) => void;
  setScale: (id: string, scale: number) => void;
  reset: () => void;
}

export const useOverlayStore = create<OverlayState>()(
  persist(
    (set) => ({
      enabled: false,
      elements: DEFAULTS,

      setEnabled: (enabled) => set({ enabled }),
      toggleEnabled: () => set((s) => ({ enabled: !s.enabled })),

      toggleSource: (source) =>
        set((s) => ({
          elements: s.elements.map((e) => (e.source === source ? { ...e, visible: !e.visible } : e)),
        })),

      move: (id, x, y) =>
        set((s) => ({ elements: s.elements.map((e) => (e.id === id ? { ...e, x, y } : e)) })),

      setScale: (id, scale) =>
        set((s) => ({ elements: s.elements.map((e) => (e.id === id ? { ...e, scale } : e)) })),

      reset: () => set({ elements: DEFAULTS }),
    }),
    { name: "vibechat-overlay" },
  ),
);
