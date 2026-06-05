import { Eye, Twitch, Youtube, Users } from "lucide-react";
import { useStatsStore } from "@/store/statsStore";
import { platformColor } from "./SourceBadge";
import { compact } from "@/lib/format";
import type { OverlayElement, OverlaySource, Platform } from "@shared/types";

const LABEL: Record<OverlaySource, string> = {
  twitch: "Twitch",
  kick: "Kick",
  x: "X",
  youtube: "YouTube",
  pumpfun: "pump.fun",
  combined: "Total",
  chat: "Chat",
};

function Glyph({ source, color }: { source: OverlaySource; color: string }) {
  if (source === "twitch") return <Twitch size={16} style={{ color }} strokeWidth={2.5} />;
  if (source === "kick") return <span className="text-sm font-extrabold leading-none" style={{ color }}>K</span>;
  if (source === "youtube") return <Youtube size={16} style={{ color }} strokeWidth={2.5} />;
  if (source === "pumpfun") return <span className="text-sm font-extrabold leading-none" style={{ color }}>pf</span>;
  if (source === "x")
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill={color} aria-hidden>
        <path d="M18.9 1.6h3.3l-7.2 8.2L23.7 22h-6.6l-5.2-6.8L5.9 22H2.6l7.7-8.8L1.3 1.6H8l4.7 6.2 5.2-6.2Zm-1.2 18.4h1.8L7.1 3.5H5.2L17.7 20Z" />
      </svg>
    );
  return <Users size={16} style={{ color }} />;
}

/**
 * A single viewer-count badge used by both the in-app overlay layer and the
 * standalone OBS browser-source page. Reads live viewers from the stats store.
 */
export function OverlayChip({ el }: { el: OverlayElement }) {
  const snap = useStatsStore((s) => s.snapshot);
  const viewers = el.source === "combined" ? snap.totals.viewers : snap.perPlatform[el.source as Platform].viewers;
  const color = el.source === "combined" ? "var(--vc-accent)" : platformColor(el.source as Platform);

  return (
    <div style={{ transform: `scale(${el.scale})`, transformOrigin: "top left" }}>
      <div
        className="flex select-none items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-md"
        style={{
          color,
          background: `color-mix(in srgb, ${color} 12%, rgba(8,6,16,0.72))`,
          border: `1.5px solid color-mix(in srgb, ${color} 55%, transparent)`,
          boxShadow: `0 0 18px color-mix(in srgb, ${color} 45%, transparent)`,
        }}
      >
        <Glyph source={el.source} color={color} />
        <Eye size={13} className="opacity-70" />
        <span className="text-lg font-extrabold tabular-nums text-white">{compact(viewers)}</span>
        {el.showLabel && <span className="text-[11px] font-bold uppercase tracking-wider opacity-80">{LABEL[el.source]}</span>}
      </div>
    </div>
  );
}
