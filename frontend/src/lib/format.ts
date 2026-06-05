/** Compact a count: 1234 → "1.2k", 1_200_000 → "1.2M". */
export function compact(n: number): string {
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Watch-time minutes → "3.4k hrs" / "altogether human". */
export function watchTime(minutes: number): { value: string; unit: string } {
  if (minutes < 60) return { value: String(Math.round(minutes)), unit: "min" };
  const hours = minutes / 60;
  if (hours < 1000) return { value: hours.toFixed(1), unit: "hrs" };
  return { value: `${(hours / 1000).toFixed(1)}k`, unit: "hrs" };
}

/** Elapsed ms → "1:23:45" / "12:05". */
export function elapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}
