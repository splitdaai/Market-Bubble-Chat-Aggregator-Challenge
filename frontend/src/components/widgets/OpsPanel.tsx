import { useState } from "react";
import { Activity, Gift, Film } from "lucide-react";
import { ConnectionStatusWidget } from "./ConnectionStatusWidget";
import { GiveawayBot } from "./GiveawayBot";
import { Clips } from "./Clips";

type Tab = "connections" | "giveaway" | "clips";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "connections", label: "Connections", icon: <Activity size={13} /> },
  { id: "giveaway", label: "Giveaway", icon: <Gift size={13} /> },
  { id: "clips", label: "Clips", icon: <Film size={13} /> },
];

/**
 * One tile, three tools — Connections, the Giveaway Bot and Clips share a tab
 * strip so the dashboard can devote a big tile to Live Stats and the stream
 * preview instead of three separate panels.
 */
export function OpsPanel() {
  const [tab, setTab] = useState<Tab>("connections");
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1 border-b border-white/10 p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-bold transition ${
              tab === t.id ? "bg-accent/20 text-accent shadow-neon" : "text-muted hover:text-ink"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {tab === "connections" && <ConnectionStatusWidget />}
        {tab === "giveaway" && <GiveawayBot />}
        {tab === "clips" && <Clips />}
      </div>
    </div>
  );
}
