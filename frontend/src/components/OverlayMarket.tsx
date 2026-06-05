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
 * favored outcome with its live probability bar, 24h volume and category.
 * Solid-ish dark card so it reads cleanly over any stream.
 */
export function OverlayMarket({ el }: { el: OverlayElement }) {
  const m = el.market;
  if (!m) return null;
  const pct = Math.round(m.prob * 100);
  const w = el.w ?? 300;

  return (
    <div style={{ transform: `scale(${el.scale})`, transformOrigin: "top left", width: w }}>
      <div
        className="overflow-hidden rounded-xl border"
        style={{
          background: "rgba(8,6,16,0.86)",
          borderColor: "color-mix(in srgb, var(--vc-accent) 50%, transparent)",
          boxShadow: "0 6px 24px rgba(0,0,0,0.5), 0 0 18px color-mix(in srgb, var(--vc-accent) 28%, transparent)",
        }}
      >
        <div className="flex items-center justify-between px-3 pt-2">
          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Polymarket
          </span>
          {el.showLabel && <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/70">{m.category}</span>}
        </div>
        <div className="px-3 pb-1 pt-1">
          <div className="line-clamp-2 text-[15px] font-extrabold leading-tight text-white">{m.question}</div>
        </div>
        <div className="px-3 pb-2.5">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="truncate text-sm font-bold text-white/90">{m.outcome}</span>
            <span className="text-xl font-black tabular-nums text-accent">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--vc-accent)", boxShadow: "0 0 10px var(--vc-accent)" }} />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] font-semibold text-white/55">
            <span>24h vol {vol(m.volume24h)}</span>
            <span className="uppercase tracking-wider">live</span>
          </div>
        </div>
      </div>
    </div>
  );
}
