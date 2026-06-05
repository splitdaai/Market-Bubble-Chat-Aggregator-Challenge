import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useChatStore } from "@/store/chatStore";
import { Flame } from "lucide-react";
import { burst } from "../Particles";
import { accentColor } from "@/lib/theme";

/**
 * A "hype train" gauge that fills as hype messages roll in and decays over time.
 * Fires confetti when it tops out — DogeFundMe milestone energy.
 */
export function HypeMeter() {
  const messages = useChatStore((s) => s.messages);
  const [level, setLevel] = useState(0);
  const lastId = useRef<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // bump on new hype message
  useEffect(() => {
    const newest = messages[messages.length - 1];
    if (newest?.hype && newest.id !== lastId.current) {
      lastId.current = newest.id;
      setLevel((l) => Math.min(100, l + 18));
    }
  }, [messages]);

  // decay
  useEffect(() => {
    const id = window.setInterval(() => setLevel((l) => Math.max(0, l - 4)), 800);
    return () => window.clearInterval(id);
  }, []);

  // celebrate at full
  useEffect(() => {
    if (level >= 100 && ref.current) {
      const r = ref.current.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, accentColor(), 40);
      setLevel(20);
    }
  }, [level]);

  return (
    <div ref={ref} className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Flame size={14} className={level > 60 ? "animate-pulse-glow text-orange-400" : "text-muted"} />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Hype Meter</span>
      </div>
      <div className="relative mt-auto h-4 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: "linear-gradient(90deg, var(--vc-accent2), var(--vc-accent), #ff7edb)",
            boxShadow: "0 0 16px color-mix(in srgb, var(--vc-accent) 70%, transparent)",
          }}
          animate={{ width: `${level}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 26 }}
        />
      </div>
      <div className="mt-1.5 text-right text-[10px] font-bold tabular-nums text-accent">{Math.round(level)}%</div>
    </div>
  );
}
