import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scissors, Radio, Zap } from "lucide-react";
import { useStatsStore } from "@/store/statsStore";
import { useToastStore } from "@/store/toastStore";
import { useClipsStore } from "@/store/clipsStore";
import { elapsed } from "@/lib/format";

/**
 * Clip Radar — the thing every streamer asks for and almost nobody ships:
 * automatic detection of *clip-worthy moments* from a live chat-velocity spike.
 * When combined chat suddenly pops off (well above its rolling baseline), it
 * flags the moment so you (or a bot) can grab the clip. Includes a live
 * velocity sparkline and a log of recent detected moments.
 */
export function ClipRadar() {
  const velocity = useStatsStore((s) => s.snapshot.velocity);
  const moments = useStatsStore((s) => s.snapshot.clipMoments);
  const hot = useStatsStore((s) => s.snapshot.hot);
  const sessionStart = useStatsStore((s) => s.snapshot.sessionStart);
  const push = useToastStore((s) => s.push);
  const capture = useClipsStore((s) => s.capture);
  const lastAuto = useRef<number>(0);

  // Auto-save a clip whenever the radar detects a fresh spike moment.
  useEffect(() => {
    const newest = moments[0];
    if (newest && newest.t !== lastAuto.current) {
      lastAuto.current = newest.t;
      capture("auto-radar", `Auto · ${newest.intensity.toFixed(1)}× spike`);
    }
  }, [moments, capture]);

  const max = Math.max(10, ...velocity);

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
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              onClick={() => { capture("manual", "Clip Radar spike"); push({ message: "✂ Clipped this moment", tone: "ok" }); }}
              className="flex items-center gap-1 rounded-full border border-accent bg-accent/20 px-2 py-0.5 text-[10px] font-bold text-accent shadow-neon"
            >
              <Scissors size={11} /> CLIP THIS
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* velocity sparkline */}
      <div className="flex h-12 items-end gap-[2px]">
        {velocity.length === 0 && <div className="m-auto text-[10px] text-muted">listening to chat velocity…</div>}
        {velocity.map((v, i) => {
          const h = Math.max(4, (v / max) * 100);
          const recent = i >= velocity.length - 3;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: `${h}%`,
                minWidth: 2,
                background: recent && hot ? "var(--vc-accent)" : "color-mix(in srgb, var(--vc-accent) 45%, transparent)",
                boxShadow: recent && hot ? "0 0 8px var(--vc-accent)" : undefined,
              }}
            />
          );
        })}
      </div>
      <div className="mt-0.5 text-right text-[9px] tabular-nums text-muted">
        {velocity[velocity.length - 1] ?? 0} msg/min
      </div>

      {/* detected moments log */}
      <div className="mt-2 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
        <Zap size={10} /> Detected Moments
      </div>
      <div className="vc-scroll mt-1 flex-1 space-y-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {moments.length === 0 && <div className="text-[10px] text-muted opacity-70">none yet — radar is armed</div>}
          {moments.map((m) => (
            <motion.div
              key={m.t}
              layout
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between rounded-md border border-accent/25 bg-accent/[0.06] px-2 py-1 text-[11px]"
            >
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <Scissors size={11} className="text-accent" /> @ {elapsed(m.t - sessionStart)}
              </span>
              <span className="font-bold tabular-nums text-accent">{m.intensity.toFixed(1)}× spike</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
