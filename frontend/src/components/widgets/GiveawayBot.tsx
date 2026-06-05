import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Play, Square, Dices, RotateCcw, Users } from "lucide-react";
import { useGiveawayStore, entrantsByPlatform } from "@/store/giveawayStore";
import { SourceBadge, platformColor } from "../SourceBadge";
import { burst } from "../Particles";
import { compact } from "@/lib/format";
import type { Platform } from "@shared/types";

const ALL: Platform[] = ["twitch", "kick", "x"];

/**
 * Cross-platform giveaway bot. Viewers on Twitch, Kick and X all enter with the
 * same keyword; the bot pools them and draws one winner across every platform.
 */
export function GiveawayBot() {
  const phase = useGiveawayStore((s) => s.phase);
  const config = useGiveawayStore((s) => s.config);
  const entrants = useGiveawayStore((s) => s.entrants);
  const winner = useGiveawayStore((s) => s.winner);
  const setConfig = useGiveawayStore((s) => s.setConfig);
  const start = useGiveawayStore((s) => s.start);
  const stop = useGiveawayStore((s) => s.stop);
  const reset = useGiveawayStore((s) => s.reset);
  const draw = useGiveawayStore((s) => s.draw);

  const rootRef = useRef<HTMLDivElement>(null);
  const counts = entrantsByPlatform(entrants);

  // Confetti when a winner is revealed.
  useEffect(() => {
    if (phase === "winner" && rootRef.current) {
      const r = rootRef.current.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, platformColor(winner?.platform ?? "twitch"), 48);
    }
  }, [phase, winner]);

  return (
    <div ref={rootRef} className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Gift size={14} className="text-accent" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Giveaway Bot</span>
        </div>
        {phase === "running" && (
          <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-400" /> Live
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* -------------------------------- IDLE -------------------------------- */}
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">Entry keyword</span>
              <input value={config.keyword} onChange={(e) => setConfig({ keyword: e.target.value })} className="vc-input font-mono" placeholder="!enter" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">Prize</span>
              <input value={config.prize} onChange={(e) => setConfig({ prize: e.target.value })} className="vc-input" placeholder="What are they winning?" />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={config.uniqueOnly} onChange={(e) => setConfig({ uniqueOnly: e.target.checked })} className="accent-[var(--vc-accent)]" />
              One entry per viewer
            </label>
            <button
              onClick={start}
              className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/20 py-2.5 text-sm font-bold text-accent shadow-neon transition hover:bg-accent/30"
            >
              <Play size={15} /> Open Giveaway
            </button>
          </motion.div>
        )}

        {/* ------------------------------- RUNNING ------------------------------ */}
        {(phase === "running" || phase === "drawing") && (
          <motion.div key="running" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col">
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted">type <span className="font-mono font-bold text-accent">{config.keyword}</span> to enter</div>
              <motion.div
                key={entrants.length}
                initial={{ scale: 1.15 }}
                animate={{ scale: 1 }}
                className="flex items-center justify-center gap-2 text-4xl font-extrabold text-ink"
              >
                <Users size={22} className="text-accent" /> {compact(entrants.length)}
              </motion.div>
              <div className="text-[10px] text-muted">entrants for <span className="font-semibold text-ink">{config.prize}</span></div>
            </div>

            {/* per-platform entry split */}
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {ALL.map((p) => (
                <div key={p} className="rounded-lg border border-white/8 bg-white/[0.02] py-1.5 text-center">
                  <div className="mb-0.5 flex justify-center"><SourceBadge platform={p} compact /></div>
                  <div className="text-sm font-bold tabular-nums" style={{ color: platformColor(p) }}>{counts[p]}</div>
                </div>
              ))}
            </div>

            <div className="mt-auto flex gap-2 pt-2">
              <button onClick={stop} className="flex items-center gap-1 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-muted transition hover:text-ink">
                <Square size={13} /> Close
              </button>
              <button
                onClick={draw}
                disabled={entrants.length === 0 || phase === "drawing"}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent/20 py-2 text-sm font-bold text-accent shadow-neon transition hover:bg-accent/30 disabled:opacity-40"
              >
                <Dices size={15} className={phase === "drawing" ? "animate-spin" : ""} />
                {phase === "drawing" ? "Rolling…" : "Draw Winner"}
              </button>
            </div>
          </motion.div>
        )}

        {/* ------------------------------- WINNER ------------------------------- */}
        {phase === "winner" && winner && (
          <motion.div
            key="winner"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-1 flex-col items-center justify-center text-center"
          >
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted">🎉 Winner 🎉</div>
            <motion.div
              initial={{ rotate: -6, scale: 0.9 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 12 }}
              className="my-2 rounded-2xl border px-5 py-3"
              style={{
                borderColor: `color-mix(in srgb, ${platformColor(winner.platform)} 60%, transparent)`,
                background: `color-mix(in srgb, ${platformColor(winner.platform)} 12%, transparent)`,
                boxShadow: `0 0 24px color-mix(in srgb, ${platformColor(winner.platform)} 45%, transparent)`,
              }}
            >
              <div className="mb-1 flex justify-center"><SourceBadge platform={winner.platform} /></div>
              <div className="text-xl font-extrabold text-ink">{winner.username}</div>
            </motion.div>
            <div className="text-xs text-muted">wins <span className="font-semibold text-accent">{config.prize}</span></div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => useGiveawayStore.getState().draw()} className="flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-muted hover:text-ink">
                <Dices size={13} /> Redraw
              </button>
              <button onClick={reset} className="flex items-center gap-1 rounded-lg bg-accent/20 px-3 py-1.5 text-xs font-bold text-accent hover:bg-accent/30">
                <RotateCcw size={13} /> New
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
