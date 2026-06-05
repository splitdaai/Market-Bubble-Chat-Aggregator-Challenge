import { motion } from "framer-motion";
import { useStatsStore } from "@/store/statsStore";
import { moodLabel } from "@/lib/sentiment";
import { Smile } from "lucide-react";

/**
 * Real-time chat mood. Rolls sentiment over the last ~90s of messages across
 * all platforms and renders it on a spicy→hyped gradient with a live marker.
 * The kind of "how's the room feeling" read streamers want but never get.
 */
export function MoodMeter() {
  const sentiment = useStatsStore((s) => s.snapshot.sentiment); // -1..1
  const mood = moodLabel(sentiment);
  const pct = ((sentiment + 1) / 2) * 100; // 0..100

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-1 flex items-center gap-1.5">
        <Smile size={14} className="text-muted" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Mood Meter</span>
      </div>

      <div className="flex flex-1 flex-col justify-center">
        <div className="mb-2 flex items-center gap-2">
          <motion.span
            key={mood.label}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-3xl"
          >
            {mood.emoji}
          </motion.span>
          <div>
            <div className="text-lg font-extrabold leading-none text-ink">{mood.label}</div>
            <div className="text-[10px] tabular-nums text-muted">score {sentiment.toFixed(2)}</div>
          </div>
        </div>

        {/* gradient track + marker */}
        <div className="relative h-3 w-full rounded-full" style={{ background: "linear-gradient(90deg, #ff5c5c, #b14dff 50%, #53fc18)" }}>
          <motion.div
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/90 bg-black/60 shadow-neon"
            animate={{ left: `${pct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 18 }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wider text-muted">
          <span>Spicy</span>
          <span>Chill</span>
          <span>Hyped</span>
        </div>
      </div>
    </div>
  );
}
