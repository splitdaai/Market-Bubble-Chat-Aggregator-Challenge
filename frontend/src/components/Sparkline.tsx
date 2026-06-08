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
  fitWidth = false,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  /** Scale the SVG to its container width (viewBox) instead of a fixed px width — prevents the line spilling outside a tile. */
  fitWidth?: boolean;
}) {
  if (!data || data.length < 2) return fitWidth ? <svg width="100%" height={height} aria-hidden /> : <svg width={width} height={height} aria-hidden />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const x = (i: number) => (i / (data.length - 1)) * (width - 2) + 1;
  const y = (v: number) => height - 2 - ((v - min) / range) * (height - 4);
  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  const stroke = color ?? (up ? "#34d399" : "#f87171");
  const content = (
    <>
      <path d={line} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" vectorEffect={fitWidth ? "non-scaling-stroke" : undefined} />
      {!fitWidth && <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={1.6} fill={stroke} />}
    </>
  );
  if (fitWidth) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden className="block w-full">
        {content}
      </svg>
    );
  }
  return (
    <svg width={width} height={height} aria-hidden className="shrink-0 overflow-visible">
      {content}
    </svg>
  );
}
