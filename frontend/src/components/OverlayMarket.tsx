import type { OverlayElement } from "@shared/types";

/** Compact volume label, e.g. $1.2M. */
function vol(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${Math.round(n)}`;
}

/**
 * A Polymarket market card for the on-screen / OBS overlay — question, the
 * favored outcome and the Yes/No probability split (green/red, like Polymarket).
 * Honors both width and height so it can be resized skinny in either direction.
 */
export function OverlayMarket({ el }: { el: OverlayElement }) {
  const m = el.market;
  if (!m) return null;
  const yes = Math.round(m.prob * 100);
  const no = 100 - yes;
  const w = el.w ?? 280;
  const h = el.h;
  // Hide the lower meta line when the card is squeezed short.
  const compact = !!h && h < 96;

  return (
    <div style={{ transform: `scale(${el.scale})`, transformOrigin: "top left", width: w, height: h }}>
      <div
        className="flex h-full w-full flex-col justify-center overflow-hidden rounded-xl border px-3 py-2"
        style={{
          background: "rgba(8,6,16,0.88)",
          borderColor: "color-mix(in srgb, var(--vc-accent) 50%, transparent)",
          boxShadow: "0 6px 24px rgba(0,0,0,0.5), 0 0 18px color-mix(in srgb, var(--vc-accent) 26%, transparent)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Polymarket
          </span>
          {el.showLabel && <span className="truncate text-[9px] font-semibold uppercase tracking-wider text-white/55">{m.outcome}</span>}
        </div>

        <div className="line-clamp-2 py-0.5 text-[14px] font-extrabold leading-tight text-white">{m.question}</div>

        {/* yes / no split bar — Market Bubble theme (gold Yes, neutral No) */}
        <div className="mt-0.5 flex h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full" style={{ width: `${yes}%`, background: "var(--vc-accent)", boxShadow: "0 0 10px color-mix(in srgb, var(--vc-accent) 70%, transparent)" }} />
          <div className="h-full bg-white/15" style={{ width: `${no}%` }} />
        </div>
        <div className="mt-1 flex items-center justify-between text-[13px] font-black tabular-nums">
          <span className="text-accent">Yes {yes}%</span>
          <span className="text-white/60">No {no}%</span>
        </div>

        {!compact && (
          <div className="mt-1 flex items-center justify-between text-[9px] font-semibold text-white/50">
            <span className="uppercase tracking-wider">{m.category}</span>
            <span>24h {vol(m.volume24h)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
