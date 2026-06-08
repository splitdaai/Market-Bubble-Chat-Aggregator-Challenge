import { useMemo, useState } from "react";
import { Sparkline } from "./Sparkline";

// label, point count, total-trend bias
const RANGES: [string, number, number][] = [
  ["1D", 24, 0.05], ["7D", 28, 0.16], ["30D", 32, 0.5], ["1Y", 52, 1.1], ["All", 64, 1.6],
];

function makeRng(seed: string) {
  let h = 2166136261;
  for (const c of seed) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return () => { h = (Math.imul(h, 1103515245) + 12345) & 0x7fffffff; return h / 0x7fffffff; };
}

function genSeries(seed: string, n: number, totalTrend: number): number[] {
  const r = makeRng(seed);
  const drift = totalTrend / n;
  let v = 100;
  const out: number[] = [];
  for (let i = 0; i < n; i++) { v *= 1 + drift + (r() - 0.5) * 0.055; out.push(v); }
  return out;
}

/** A line chart with 1D/7D/30D/1Y/All range tabs (deterministic demo series per seed). */
export function RangeChart({ seed, label, icon, width = 900, height = 130, bias = 1, defaultRange = "30D" }: {
  seed: string; label: string; icon?: React.ReactNode; width?: number; height?: number; bias?: number; defaultRange?: string;
}) {
  const [range, setRange] = useState(defaultRange);
  const cfg = RANGES.find((x) => x[0] === range) ?? RANGES[2];
  const data = useMemo(() => genSeries(seed + range, cfg[1], cfg[2] * bias), [seed, range, cfg, bias]);
  const pct = (data[data.length - 1] / data[0] - 1) * 100;
  const up = pct >= 0;
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-faint">{icon} {label} · {range}</span>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-lg border border-white/10 bg-black/40 p-0.5">
            {RANGES.map(([l]) => (
              <button key={l} onClick={() => setRange(l)} className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold transition ${range === l ? "bg-accent/20 text-accent" : "text-faint hover:text-ink"}`}>{l}</button>
            ))}
          </div>
          <span className={`text-[11px] font-bold tabular-nums ${up ? "text-up" : "text-down"}`}>{up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%</span>
        </div>
      </div>
      <Sparkline data={data} width={width} height={height} fitWidth color={up ? "#16e6a4" : "#ff5a6a"} />
    </div>
  );
}
