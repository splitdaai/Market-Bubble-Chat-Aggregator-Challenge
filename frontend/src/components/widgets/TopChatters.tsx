import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, DollarSign, Gift, MessageSquare } from "lucide-react";
import { useStatsStore } from "@/store/statsStore";
import { SourceBadge, platformColor } from "../SourceBadge";
import { compact } from "@/lib/format";
import type { Platform } from "@shared/types";

type Tab = "chatters" | "donors" | "subs";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "chatters", label: "Chatters", icon: <MessageSquare size={12} /> },
  { id: "donors", label: "Donors", icon: <DollarSign size={12} /> },
  { id: "subs", label: "Subs", icon: <Gift size={12} /> },
];

interface Row {
  name: string;
  platform: Platform;
  value: number;
  display: string;
}

/**
 * Cross-platform leaderboards — who's carrying chat (messages), who's funding
 * the stream (donations + bits + sub value), and who's subbing/gifting most.
 * All ranked across Twitch, Kick and X together.
 */
export function TopChatters() {
  const snap = useStatsStore((s) => s.snapshot);
  const [tab, setTab] = useState<Tab>("chatters");

  const rows: Row[] =
    tab === "chatters"
      ? snap.topChatters.map((r) => ({ ...r, value: r.count, display: String(r.count) }))
      : tab === "donors"
        ? snap.topDonors.map((r) => ({ ...r, value: r.amount, display: `$${compact(r.amount)}` }))
        : snap.topSubs.map((r) => ({ ...r, value: r.subs, display: `${r.subs}` }));

  const max = Math.max(1, rows[0]?.value ?? 1);
  const summary =
    tab === "donors" ? `$${compact(snap.totalDonated)} raised`
    : tab === "subs" ? `${compact(snap.totalSubs)} subs total`
    : `${compact(snap.totals.uniqueChatters)} chatters`;

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Trophy size={14} className="text-amber-400" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Leaderboards</span>
        <span className="ml-auto text-[10px] font-semibold tabular-nums text-accent">{summary}</span>
      </div>

      {/* tabs */}
      <div className="mb-2 flex gap-1 rounded-lg bg-white/[0.03] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[11px] font-bold transition ${
              tab === t.id ? "bg-accent/20 text-accent shadow-neon" : "text-muted hover:text-ink"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="vc-scroll flex-1 space-y-1 overflow-y-auto">
        {rows.length === 0 && (
          <div className="grid h-full place-items-center text-center text-[11px] text-muted opacity-70">
            {tab === "donors" ? "No donations yet" : tab === "subs" ? "No subs yet" : "tallying chatters…"}
          </div>
        )}
        {rows.map((r, i) => (
          <motion.div
            key={`${r.platform}:${r.name}`}
            layout
            className="relative flex items-center gap-2 overflow-hidden rounded-lg border border-white/8 px-2 py-1.5"
          >
            <div
              className="absolute inset-y-0 left-0 -z-0 rounded-lg opacity-20"
              style={{ width: `${(r.value / max) * 100}%`, background: platformColor(r.platform) }}
            />
            <span className={`z-10 w-5 text-center text-xs font-extrabold ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-700" : "text-muted"}`}>
              {i + 1}
            </span>
            <SourceBadge platform={r.platform} compact />
            <span className="z-10 flex-1 truncate text-sm font-semibold text-ink">{r.name}</span>
            <span className={`z-10 text-xs font-bold tabular-nums ${tab === "donors" ? "text-emerald-400" : "text-accent"}`}>
              {tab === "subs" ? `${r.display}×` : r.display}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
