import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, Volume1, VolumeX } from "lucide-react";
import { useAudioStore } from "@/store/audioStore";

/**
 * Topbar speaker control for the stream-preview clip: click to open a volume
 * slider + mute toggle. Drives the shared audio store the <video> reads.
 */
export function AudioControl() {
  const muted = useAudioStore((s) => s.muted);
  const volume = useAudioStore((s) => s.volume);
  const setVolume = useAudioStore((s) => s.setVolume);
  const toggleMuted = useAudioStore((s) => s.toggleMuted);
  const [open, setOpen] = useState(false);

  const effective = muted ? 0 : volume;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Stream clip audio"
        className={`grid h-9 w-9 place-items-center rounded-xl border transition ${
          open || !muted ? "border-accent/50 bg-accent/15 text-accent" : "border-white/10 bg-white/[0.03] text-muted hover:text-ink"
        }`}
      >
        <Icon size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* click-away */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              className="vc-glass absolute right-0 top-11 z-50 w-52 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Clip Audio</span>
                <button
                  onClick={toggleMuted}
                  className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition ${
                    muted ? "bg-red-500/15 text-red-300" : "bg-accent/15 text-accent"
                  }`}
                >
                  {muted ? "Muted" : "On"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={toggleMuted} className="text-muted transition hover:text-ink">
                  <Icon size={16} />
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={effective}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="vc-volume h-1.5 flex-1 cursor-pointer appearance-none rounded-full"
                  style={{
                    background: `linear-gradient(to right, var(--vc-accent) ${effective * 100}%, rgba(255,255,255,0.12) ${effective * 100}%)`,
                  }}
                />
                <span className="w-7 text-right text-[10px] tabular-nums text-muted">{Math.round(effective * 100)}</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
