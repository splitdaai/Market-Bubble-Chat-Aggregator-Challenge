import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OverlayCustomAsset, OverlayEffectProfile, OverlayElement, OverlaySource, OverlayMarketData } from "@shared/types";
import { defaultOverlayEffectProfile, defaultOverlayEffectProfiles, normalizeOverlayEffectProfile } from "@/lib/overlayFx";

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
  { id: "ov-youtube", source: "youtube", x: 40, y: 340, scale: 1, showLabel: true, visible: false },
  { id: "ov-chat", source: "chat", x: 40, y: 480, scale: 1, showLabel: true, visible: false, w: 320, h: 380 },
];

interface OverlayState {
  enabled: boolean; // overlay shown over the dashboard (edit/preview)
  elements: OverlayElement[];
  customAssets: OverlayCustomAsset[];
  effectProfiles: Record<string, OverlayEffectProfile>;

  setEnabled: (v: boolean) => void;
  toggleEnabled: () => void;
  toggleSource: (source: OverlaySource) => void;
  move: (id: string, x: number, y: number) => void;
  setSize: (id: string, w: number, h: number) => void;
  addCustomAsset: (asset: OverlayCustomAsset) => void;
  updateCustomAsset: (id: string, patch: Partial<OverlayCustomAsset>) => void;
  removeCustomAsset: (id: string) => void;
  updateEffectProfile: (actionId: string, patch: Partial<OverlayEffectProfile>) => void;
  resetEffectProfile: (actionId: string) => void;
  resetEffectProfiles: () => void;
  /** Pin a Polymarket market to the overlay (enables it if off). */
  addMarket: (market: OverlayMarketData) => void;
  /** Remove any element (used by the dynamic market cards). */
  removeElement: (id: string) => void;
  reset: () => void;
}

export const useOverlayStore = create<OverlayState>()(
  persist(
    (set) => ({
      enabled: false,
      elements: DEFAULTS,
      customAssets: [],
      effectProfiles: defaultOverlayEffectProfiles(),

      setEnabled: (enabled) => set({ enabled }),
      toggleEnabled: () => set((s) => ({ enabled: !s.enabled })),

      toggleSource: (source) =>
        set((s) => ({
          elements: s.elements.map((e) => (e.source === source ? { ...e, visible: !e.visible } : e)),
        })),

      move: (id, x, y) =>
        set((s) => ({ elements: s.elements.map((e) => (e.id === id ? { ...e, x, y } : e)) })),

      setSize: (id, w, h) =>
        set((s) => ({ elements: s.elements.map((e) => (e.id === id ? { ...e, w, h } : e)) })),

      addCustomAsset: (asset) =>
        set((s) => {
          const n = s.elements.filter((e) => e.source === "custom").length;
          const element: OverlayElement = {
            id: `custom-${asset.id}`,
            source: "custom",
            x: 120 + (n % 4) * 42,
            y: 140 + (n % 4) * 34,
            scale: 1,
            showLabel: false,
            visible: true,
            w: asset.size,
            h: asset.size,
            custom: asset,
          };
          return {
            enabled: true,
            customAssets: [asset, ...s.customAssets.filter((a) => a.id !== asset.id)].slice(0, 18),
            elements: [...s.elements.filter((e) => e.id !== element.id), element],
          };
        }),

      updateCustomAsset: (id, patch) =>
        set((s) => {
          const customAssets = s.customAssets.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset));
          const nextAsset = customAssets.find((asset) => asset.id === id);
          return {
            customAssets,
            elements: s.elements.map((e) => (e.custom?.id === id && nextAsset ? { ...e, custom: nextAsset, w: nextAsset.size, h: nextAsset.size } : e)),
          };
        }),

      removeCustomAsset: (id) =>
        set((s) => ({
          customAssets: s.customAssets.filter((asset) => asset.id !== id),
          elements: s.elements.filter((e) => e.custom?.id !== id),
        })),

      updateEffectProfile: (actionId, patch) =>
        set((s) => {
          const current = s.effectProfiles[actionId] ?? defaultOverlayEffectProfile(actionId);
          const profile = normalizeOverlayEffectProfile({ ...current, ...patch, actionId });
          return { effectProfiles: { ...s.effectProfiles, [actionId]: profile } };
        }),

      resetEffectProfile: (actionId) =>
        set((s) => ({ effectProfiles: { ...s.effectProfiles, [actionId]: defaultOverlayEffectProfile(actionId) } })),

      resetEffectProfiles: () => set({ effectProfiles: defaultOverlayEffectProfiles() }),

      addMarket: (market) =>
        set((s) => {
          const id = `mkt-${market.id}`;
          if (s.elements.some((e) => e.id === id)) {
            // already pinned — just make sure it's visible
            return { enabled: true, elements: s.elements.map((e) => (e.id === id ? { ...e, visible: true } : e)) };
          }
          // stagger new cards so they don't stack exactly
          const n = s.elements.filter((e) => e.source === "market").length;
          const el: OverlayElement = {
            id, source: "market", x: 60 + (n % 4) * 28, y: 120 + (n % 4) * 28,
            scale: 1, showLabel: true, visible: true, w: 300, h: 120, market,
          };
          return { enabled: true, elements: [...s.elements, el] };
        }),

      removeElement: (id) =>
        set((s) => ({ elements: s.elements.filter((e) => e.id !== id) })),

      reset: () => set({ elements: DEFAULTS }),
    }),
    {
      name: "vibechat-overlay-v3",
      merge: (persisted, current) => {
        const saved = persisted as Partial<OverlayState> | undefined;
        const savedProfiles = saved?.effectProfiles ?? {};
        const effectProfiles = { ...defaultOverlayEffectProfiles(), ...savedProfiles };
        for (const [key, profile] of Object.entries(effectProfiles)) {
          effectProfiles[key] = normalizeOverlayEffectProfile(profile);
        }
        return {
          ...current,
          ...saved,
          customAssets: saved?.customAssets ?? current.customAssets,
          elements: saved?.elements ?? current.elements,
          effectProfiles,
        };
      },
    },
  ),
);
