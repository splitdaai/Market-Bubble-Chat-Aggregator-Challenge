import type { Platform, ExtPlatform } from "@shared/types";
import { Twitch, Youtube, Rocket } from "lucide-react";

/**
 * The non-negotiable source label. Every message carries one.
 * Twitch = purple, X = white-on-black, Kick = green, YouTube = red,
 * pump.fun = mint-green — each a tinted glass chip.
 */

const META: Record<
  ExtPlatform,
  { label: string; color: string; icon: React.ReactNode }
> = {
  twitch: {
    label: "Twitch",
    color: "#9146ff",
    icon: <Twitch size={12} strokeWidth={2.5} />,
  },
  kick: {
    label: "Kick",
    color: "#53fc18",
    icon: <span className="text-[11px] font-extrabold leading-none">K</span>,
  },
  x: {
    label: "X",
    color: "#e7e9ea",
    icon: (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M18.9 1.6h3.3l-7.2 8.2L23.7 22h-6.6l-5.2-6.8L5.9 22H2.6l7.7-8.8L1.3 1.6H8l4.7 6.2 5.2-6.2Zm-1.2 18.4h1.8L7.1 3.5H5.2L17.7 20Z" />
      </svg>
    ),
  },
  youtube: {
    label: "YouTube",
    color: "#ff3b3b",
    icon: <Youtube size={13} strokeWidth={2.4} />,
  },
  pumpfun: {
    label: "pump.fun",
    color: "#5fe6a8",
    icon: <Rocket size={11} strokeWidth={2.5} />,
  },
};

/** Every platform we aggregate — all are first-class chat sources now. */
export const CHAT_PLATFORMS: Platform[] = ["twitch", "kick", "x", "youtube"];
/** Alias kept for existing imports. */
export const EXT_PLATFORMS: ExtPlatform[] = CHAT_PLATFORMS;

export function SourceBadge({ platform, compact = false }: { platform: ExtPlatform; compact?: boolean }) {
  const m = META[platform];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{
        color: m.color,
        background: `color-mix(in srgb, ${m.color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${m.color} 45%, transparent)`,
        boxShadow: `0 0 8px color-mix(in srgb, ${m.color} 35%, transparent)`,
      }}
      title={`${m.label} chat`}
    >
      <span className="grid place-items-center" style={{ color: m.color }}>
        {m.icon}
      </span>
      {!compact && m.label}
    </span>
  );
}

export const platformColor = (p: ExtPlatform) => META[p].color;
export const platformLabel = (p: ExtPlatform) => META[p].label;
export const platformIcon = (p: ExtPlatform) => META[p].icon;
