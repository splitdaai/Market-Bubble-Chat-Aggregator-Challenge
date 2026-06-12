import type { OverlayEffectMotion, OverlayEffectProfile } from "@shared/types";
import { OVERLAY_ACTIONS } from "@/lib/overlayEngagement";

const MOTION_DEFAULTS: Record<OverlayEffectMotion, Pick<OverlayEffectProfile, "durationScale" | "intensity" | "density" | "scale" | "blur" | "audio">> = {
  default: { durationScale: 1, intensity: 1, density: 1, scale: 1, blur: 1, audio: 1 },
  slower: { durationScale: 1.35, intensity: 0.95, density: 0.95, scale: 1.02, blur: 0.88, audio: 0.9 },
  snappy: { durationScale: 0.72, intensity: 1.1, density: 0.9, scale: 0.96, blur: 0.75, audio: 1 },
  cinematic: { durationScale: 1.18, intensity: 1.22, density: 1.18, scale: 1.08, blur: 1.08, audio: 1.05 },
  chaos: { durationScale: 0.9, intensity: 1.45, density: 1.55, scale: 1.12, blur: 1.25, audio: 1.1 },
};

const SLOWED_HERO_IDS = new Set(["charging-bull", "bear-slash"]);

export function defaultOverlayEffectProfile(actionId: string): OverlayEffectProfile {
  const action = OVERLAY_ACTIONS.find((a) => a.id === actionId);
  const motion: OverlayEffectMotion = SLOWED_HERO_IDS.has(actionId) ? "slower" : "default";
  return {
    actionId,
    label: action?.label ?? actionId,
    enabled: true,
    motion,
    accent: action?.accent,
    ...MOTION_DEFAULTS[motion],
  };
}

export function defaultOverlayEffectProfiles(): Record<string, OverlayEffectProfile> {
  return Object.fromEntries(OVERLAY_ACTIONS.map((action) => [action.id, defaultOverlayEffectProfile(action.id)]));
}

export function normalizeOverlayEffectProfile(profile: OverlayEffectProfile): OverlayEffectProfile {
  const defaults = defaultOverlayEffectProfile(profile.actionId);
  return {
    ...defaults,
    ...profile,
    durationScale: clamp(profile.durationScale, 0.45, 2.4, defaults.durationScale),
    intensity: clamp(profile.intensity, 0, 2, defaults.intensity),
    density: clamp(profile.density, 0.2, 2.2, defaults.density),
    scale: clamp(profile.scale, 0.55, 1.8, defaults.scale),
    blur: clamp(profile.blur, 0, 1.8, defaults.blur),
    audio: clamp(profile.audio, 0, 1.5, defaults.audio),
  };
}

export function profileDuration(profile: OverlayEffectProfile | undefined, base: number): number {
  return base * (profile?.durationScale ?? 1);
}

export function profileCount(profile: OverlayEffectProfile | undefined, base: number): number {
  return Math.max(1, Math.round(base * (profile?.density ?? 1)));
}

export function profileAlpha(profile: OverlayEffectProfile | undefined, base: number): number {
  return Math.max(0, Math.min(1, base * (profile?.intensity ?? 1)));
}

function clamp(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
