import { useEffect, useState } from "react";
import { useStatsStore } from "@/store/statsStore";

/** Format ms uptime as H:MM:SS (or MM:SS under an hour). */
function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/**
 * A real-time stream-uptime clock that ticks every second (the stats snapshot
 * only updates every ~1.5s, so this drives its own interval for a smooth count).
 */
export function LiveTimer({ className }: { className?: string }) {
  const sessionStart = useStatsStore((s) => s.snapshot.sessionStart);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return <span className={className}>{fmt(now - sessionStart)}</span>;
}
