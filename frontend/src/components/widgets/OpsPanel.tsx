import { useState } from "react";
import { motion } from "framer-motion";
import { Gift, Film, Radio } from "lucide-react";
import { GiveawayBot } from "./GiveawayBot";
import { Clips } from "./Clips";
import { Broadcasts } from "./Broadcasts";

type Tab = "giveaway" | "clips" | "broadcasts";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "giveaway", label: "Giveaways", icon: <Gift size={15} /> },
  { id: "clips", label: "Clips", icon: <Film size={15} /> },
  { id: "broadcasts", label: "Broadcasts", icon: <Radio size={15} /> },
];

/**
 * Two tools share one tile — the Giveaway Bot and Clips — behind a pair of big,
 * glowy pill buttons with an animated active indicator.
 */
export function OpsPanel() {
  const [tab, setTab] = useState<Tab>("giveaway");
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-2 p-2">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <motion.button
              key={t.id}
              onClick={() => setTab(t.id)}
              whileTap={{ scale: 0.96 }}
              className={`relative flex flex-1 items-center justify-center gap-1.5 overflow-hidden rounded-xl border px-3 py-2.5 text-sm font-extrabold transition-colors ${
                active
                  ? "border-accent/60 text-accent"
                  : "border-white/10 bg-white/[0.02] text-muted hover:border-white/20 hover:text-ink"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="ops-tab-active"
                  className="absolute inset-0 -z-0"
                  style={{
                    background: "color-mix(in srgb, var(--vc-accent) 18%, transparent)",
                    boxShadow: "0 0 18px color-mix(in srgb, var(--vc-accent) 40%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--vc-accent) 50%, transparent)",
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                {t.icon} {t.label}
              </span>
            </motion.button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1">
        {tab === "giveaway" && <GiveawayBot />}
        {tab === "clips" && <Clips />}
        {tab === "broadcasts" && <Broadcasts />}
      </div>
    </div>
  );
}
