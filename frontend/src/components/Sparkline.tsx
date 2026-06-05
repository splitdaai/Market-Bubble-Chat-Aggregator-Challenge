/**
 * A tiny inline trend sparkline. With no explicit `color` it auto-tints green
 * when the series is trending up and red when down — the at-a-glance "is this
 * metric rising or falling" cue used across Live Stats and Connections.
 */
export function Sparkline({
  data,
  width = 56,
  height = 18,
  color,
  strokeWidth = 1.5,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
}) {
  if (!data || data.length < 2) return <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * (width - 2) + 1;
  const y = (v: number) => height - 2 - ((v - min) / range) * (height - 4);
  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  const stroke = color ?? (up ? "#34d399" : "#f87171");

  return (
    <svg width={width} height={height} aria-hidden className="shrink-0 overflow-visible">
      <path d={line} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={1.6} fill={stroke} />
    </svg>
  );
}
