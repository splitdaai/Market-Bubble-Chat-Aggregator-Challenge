import { useEffect, useState } from "react";
import { CalendarClock, Radio } from "lucide-react";

/**
 * Show schedule — Market Bubble airs 1:00 PM ET every Thursday. Shows the next
 * airing with a live countdown (and a LIVE state during the Thursday window).
 */

// Next Thursday 13:00 America/New_York, returned as a UTC Date.
function nextAiring(now: Date): { date: Date; live: boolean } {
  // ET offset: EDT (-4) Mar–Nov, EST (-5) otherwise — good enough for a countdown.
  const month = now.getUTCMonth(); // 0-11
  const etOffset = month >= 2 && month <= 10 ? 4 : 5;
  // Current time in ET
  const et = new Date(now.getTime() - etOffset * 3600_000);
  const day = et.getUTCDay(); // 0 Sun … 4 Thu
  const hour = et.getUTCHours() + et.getUTCMinutes() / 60;
  // Build this week's Thursday 13:00 ET
  let daysToThu = (4 - day + 7) % 7;
  if (daysToThu === 0 && hour >= 16) daysToThu = 7; // past the ~3h show window today → next week
  const thuEt = new Date(Date.UTC(et.getUTCFullYear(), et.getUTCMonth(), et.getUTCDate() + daysToThu, 13, 0, 0));
  const date = new Date(thuEt.getTime() + etOffset * 3600_000); // back to UTC
  const live = daysToThu === 0 && hour >= 13 && hour < 16;
  return { date, live };
}

/**
 * Slim banner shown ABOVE the stream when the show isn't live — collapses to
 * nothing during the live window so it never competes with the broadcast.
 */
export function ScheduleBanner() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);
  const { date, live } = nextAiring(now);
  if (live) return null;
  const ms = Math.max(0, date.getTime() - now.getTime());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cd = `${d > 0 ? d + "d " : ""}${h}h ${m}m ${s}s`;
  return (
    <div
      className="mb-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-xl border border-accent/25 px-4 py-2 text-center"
      style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--vc-accent) 12%, transparent), transparent 70%)" }}
    >
      <span className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-accent">
        <CalendarClock size={15} /> Next show
      </span>
      <span className="serif text-[15px] font-bold text-ink">
        <span className="text-accent">Thursday</span> · 1:00 PM ET
      </span>
      <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 text-[12px] font-black tabular-nums text-ink">in {cd}</span>
      <span className="text-[11px] text-muted">10AM PT · 1PM ET · 6PM UK</span>
    </div>
  );
}

export function ShowSchedule() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);
  const { date, live } = nextAiring(now);
  const ms = Math.max(0, date.getTime() - now.getTime());
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);

  const Unit = ({ v, l }: { v: number; l: string }) => (
    <div className="flex flex-col items-center">
      <span className="text-[26px] font-black tabular-nums leading-none text-ink">{String(v).padStart(2, "0")}</span>
      <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.18em] text-faint">{l}</span>
    </div>
  );

  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
        <CalendarClock size={14} className="text-accent" /> Show Schedule
      </div>

      {live ? (
        <div className="flex items-center gap-2 rounded-full border border-down/50 bg-down/15 px-4 py-2 text-down">
          <span className="relative flex h-2 w-2"><span className="absolute h-full w-full animate-ping rounded-full bg-down/70" /><span className="relative h-2 w-2 rounded-full bg-down" /></span>
          <span className="text-[15px] font-black uppercase tracking-wide">Live now</span>
        </div>
      ) : (
        <>
          <div className="serif text-[19px] font-bold text-ink">
            Every <span className="text-accent">Thursday</span> · 1:00 PM ET
          </div>
          <div className="flex items-end gap-3">
            {d > 0 && <Unit v={d} l="days" />}
            <Unit v={h} l="hrs" />
            <Unit v={m} l="min" />
            <Unit v={s} l="sec" />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <Radio size={12} className="text-accent" />
            Next: {date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · 10AM PT / 1PM ET / 6PM UK
          </div>
        </>
      )}
    </div>
  );
}
