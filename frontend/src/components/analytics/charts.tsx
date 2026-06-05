import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { pctDelta } from "@/lib/analytics";

/** Measure an element's width (for responsive, crisp SVG charts). */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface TrendPoint {
  label: string;
  value: number;
  live?: boolean;
}

/** Responsive line + area trend chart, themed off --vc-accent. */
export function TrendChart({
  points,
  height = 250,
  formatY = (n: number) => String(n),
}: {
  points: TrendPoint[];
  height?: number;
  formatY?: (n: number) => string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const gid = useId().replace(/:/g, "");
  const W = Math.max(width, 240);
  const padL = 44, padR = 16, padT = 18, padB = 30;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;

  const vals = points.map((p) => p.value);
  const rawMax = Math.max(1, ...vals);
  const max = rawMax * 1.12;
  const min = 0;

  const x = (i: number) => padL + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => padT + innerH - ((v - min) / (max - min || 1)) * innerH;

  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(padT + innerH).toFixed(1)} L${x(0).toFixed(1)},${(padT + innerH).toFixed(1)} Z`;

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * (max - min));
  // Show ~7 x labels max to avoid crowding.
  const step = Math.max(1, Math.ceil(points.length / 7));

  return (
    <div ref={ref} className="w-full">
      <svg width={W} height={height} role="img">
        <defs>
          <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--vc-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--vc-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines + y labels */}
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(gv)} y2={y(gv)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={padL - 8} y={y(gv) + 3} textAnchor="end" className="fill-muted" fontSize={9}>
              {formatY(gv)}
            </text>
          </g>
        ))}

        <path d={area} fill={`url(#area-${gid})`} />
        <path d={line} fill="none" stroke="var(--vc-accent)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p, i) => (
          <g key={i}>
            {p.live ? (
              <>
                <circle cx={x(i)} cy={y(p.value)} r={7} fill="var(--vc-accent)" opacity={0.25}>
                  <animate attributeName="r" values="6;11;6" dur="1.6s" repeatCount="indefinite" />
                </circle>
                <circle cx={x(i)} cy={y(p.value)} r={4} fill="var(--vc-accent)" stroke="#fff" strokeWidth={1.5} />
              </>
            ) : (
              <circle cx={x(i)} cy={y(p.value)} r={2.5} fill="var(--vc-accent)" />
            )}
            {(i % step === 0 || p.live) && (
              <text x={x(i)} y={height - 10} textAnchor="middle" className="fill-muted" fontSize={9}>
                {p.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Tiny inline sparkline (no axes) for KPI cards. */
export function Sparkline({ data, width = 96, height = 30, color }: { data: number[]; width?: number; height?: number; color?: string }) {
  const gid = useId().replace(/:/g, "");
  if (data.length < 2) return <svg width={width} height={height} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const x = (i: number) => (i / (data.length - 1)) * (width - 2) + 1;
  const y = (v: number) => height - 3 - ((v - min) / (max - min || 1)) * (height - 6);
  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
  const stroke = color ?? "var(--vc-accent)";
  return (
    <svg width={width} height={height}>
      <defs>
        <linearGradient id={`spk-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spk-${gid})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/** Growth/loss badge: ▲ +12.4% (green) / ▼ -5.1% (red) / "new". */
export function DeltaBadge({ curr, prev, size = "sm" }: { curr: number; prev: number; size?: "sm" | "lg" }) {
  const d = pctDelta(curr, prev);
  const pad = size === "lg" ? "px-2 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]";
  if (d === null) {
    return <span className={`inline-flex items-center gap-0.5 rounded-md bg-white/8 font-bold text-muted ${pad}`}>new</span>;
  }
  const flat = Math.abs(d) < 0.05;
  const up = d >= 0;
  const cls = flat
    ? "bg-white/8 text-muted"
    : up
      ? "bg-emerald-500/15 text-emerald-400"
      : "bg-red-500/15 text-red-400";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md font-bold tabular-nums ${cls} ${pad}`}>
      <Icon size={size === "lg" ? 13 : 11} />
      {up && !flat ? "+" : ""}{d.toFixed(1)}%
    </span>
  );
}
