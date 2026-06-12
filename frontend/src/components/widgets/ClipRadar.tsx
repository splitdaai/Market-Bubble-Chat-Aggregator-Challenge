import { useEffect, useId, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scissors, Radio, Zap } from "lucide-react";
import { useStatsStore } from "@/store/statsStore";
import { useToastStore } from "@/store/toastStore";
import { useClipsStore } from "@/store/clipsStore";
import { useConnectionsStore } from "@/store/connectionsStore";
import { SourceBadge } from "../SourceBadge";
import { compact, elapsed } from "@/lib/format";

/**
 * Clip Radar — auto-detects clip-worthy moments from chat-velocity spikes, with
 * a live stream preview (chat-velocity rendered as a market chart) and the
 * detected moments in a horizontal slider.
 *
 * The preview is the seam for a real player embed (Twitch/YouTube iframe of the
 * primary channel) when a backend is connected.
 */
export function ClipRadar() {
  const velocity = useStatsStore((s) => s.snapshot.velocity);
  const moments = useStatsStore((s) => s.snapshot.clipMoments);
  const hot = useStatsStore((s) => s.snapshot.hot);
  const sessionStart = useStatsStore((s) => s.snapshot.sessionStart);
  const viewers = useStatsStore((s) => s.snapshot.totals.viewers);
  const accountStats = useStatsStore((s) => s.snapshot.accounts);
  const accounts = useConnectionsStore((s) => s.accounts);
  const push = useToastStore((s) => s.push);
  const capture = useClipsStore((s) => s.capture);
  const lastAuto = useRef<number>(0);
  const gid = useId().replace(/:/g, "");

  // Smart auto-clip — uses the detector's verdict, not raw spike count:
  //   "auto-clip" → capture + clip-worthy toast
  //   "alert"    → toast only, operator decides
  //   "watch"    → ignored (radar still shows it on the strip)
  useEffect(() => {
    const newest = moments[0];
    if (!newest || newest.t === lastAuto.current) return;
    lastAuto.current = newest.t;
    if (newest.verdict === "auto-clip") {
      capture("auto-radar", `${newest.kind} · ${newest.why}`);
      push({ message: `📎 Auto-clipped — ${newest.kind} (${newest.score}). ${newest.why}`, tone: "ok" });
    } else if (newest.verdict === "alert") {
      push({ message: `🔔 ${newest.kind} brewing (${newest.score}). ${newest.why}`, tone: "info" });
    }
  }, [moments, capture, push]);

  // Most-active channel right now → shown on the preview.
  const primary = useMemo(() => {
    const top = [...accountStats].sort((a, b) => b.messages - a.messages)[0];
    if (!top) return null;
    const meta = accounts.find((a) => a.id === top.accountId);
    return meta ? { name: meta.displayName, platform: meta.platform } : null;
  }, [accountStats, accounts]);

  // Build the area-chart path for the velocity (the "stream content").
  const chart = useMemo(() => {
    const W = 100, H = 56;
    if (velocity.length < 2) return { line: "", area: "" };
    const max = Math.max(10, ...velocity);
    const x = (i: number) => (i / (velocity.length - 1)) * W;
    const y = (v: number) => H - 6 - (v / max) * (H - 12);
    const line = velocity.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
    return { line, area: `${line} L${W},${H} L0,${H} Z` };
  }, [velocity]);

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Radio size={14} className={hot ? "animate-pulse-glow text-accent" : "text-muted"} />
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Clip Radar</span>
        </div>
        <AnimatePresence>
          {hot && (
            <motion.button
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0 }}
              onClick={() => { capture("manual", "Clip Radar spike"); push({ message: "✂ Clipped this moment", tone: "ok" }); }}
              className="flex items-center gap-1 rounded-full border border-accent bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent shadow-neon"
            >
              <Scissors size={11} /> CLIP THIS
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* stream preview — chat velocity rendered as a live market chart */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-black/40 to-[color-mix(in_srgb,var(--vc-accent)_10%,#04100c)]">
        <img src="/logo-white.png" alt="" className="pointer-events-none absolute left-1/2 top-1/2 h-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06]" />
        <svg viewBox="0 0 100 56" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id={`prev-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--vc-accent)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--vc-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {chart.area && <path d={chart.area} fill={`url(#prev-${gid})`} />}
          {chart.line && <path d={chart.line} fill="none" stroke="var(--vc-accent)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        </svg>
        {/* moving shimmer for "live" feel */}
        <div className="pointer-events-none absolute inset-0 animate-shimmer bg-[linear-gradient(110deg,transparent_40%,rgba(255,255,255,0.05)_50%,transparent_60%)] bg-[length:200%_100%]" />

        {/* overlays */}
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-400 backdrop-blur">
          <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500/70" /><span className="relative h-1.5 w-1.5 rounded-full bg-red-500" /></span>
          Live
        </span>
        <span className="absolute right-2 top-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-ink backdrop-blur">👁 {compact(viewers)}</span>
        {primary && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-md bg-black/55 px-1.5 py-0.5 backdrop-blur">
            <SourceBadge platform={primary.platform} compact />
            <span className="text-[10px] font-semibold text-ink">{primary.name}</span>
          </span>
        )}
        <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[9px] tabular-nums text-muted backdrop-blur">{velocity[velocity.length - 1] ?? 0} msg/min</span>
      </div>

      {/* detected moments — horizontal slider */}
      <div className="mb-1 mt-3 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
        <Zap size={10} /> Detected Moments {moments.length > 0 && <span className="text-accent">· {moments.length}</span>}
      </div>
      <div className="vc-scroll flex gap-2 overflow-x-auto pb-1">
        {moments.length === 0 && <div className="py-2 text-[10px] text-muted opacity-70">none yet — radar is armed</div>}
        <AnimatePresence initial={false}>
          {moments.map((m) => (
            <motion.button
              key={m.t}
              layout
              initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
              onClick={() => { capture("manual", `${m.intensity.toFixed(1)}× spike`); push({ message: "✂ Clipped this moment", tone: "ok" }); }}
              className="flex shrink-0 flex-col items-start gap-0.5 rounded-lg border border-accent/30 bg-accent/[0.07] px-2.5 py-1.5 text-left transition hover:bg-accent/15"
            >
              <span className="flex items-center gap-1 text-[11px] font-bold text-accent"><Scissors size={11} /> {m.intensity.toFixed(1)}×</span>
              <span className="text-[10px] tabular-nums text-muted">@ {elapsed(m.t - sessionStart)}</span>
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
