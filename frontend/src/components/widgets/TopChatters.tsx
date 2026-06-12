import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Gift, MessageSquare } from "lucide-react";
import { useStatsStore } from "@/store/statsStore";
import { useUserCardStore } from "@/store/userCardStore";
import { SourceBadge, platformColor } from "../SourceBadge";
import { compact } from "@/lib/format";
import { subRevenue } from "@/lib/revenue";
import { bucksFor } from "@/lib/bucks";
import type { Platform } from "@shared/types";

type Tab = "chatters" | "subs" | "bucks";
type RangeKey = "day" | "week" | "month" | "all";

/** Roughly how much a longer window accumulates vs the live session ("today"). */
const RANGE_FACTOR: Record<RangeKey, number> = { day: 1, week: 5.5, month: 22, all: 80 };
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "all", label: "All" },
];

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "chatters", label: "Chatters", icon: <MessageSquare size={12} /> },
  { id: "subs", label: "Subs", icon: <Gift size={12} /> },
  { id: "bucks", label: "Bucks", icon: <span className="text-[12px] leading-none">🫧</span> },
];

interface Row {
  name: string;
  platform: Platform;
  value: number;
  display: string;
  channel?: string;
  subCount?: number;
}

/**
 * Cross-platform leaderboards — who's carrying chat (messages), who's funding
 * the stream (donations + bits + sub value), and who's subbing/gifting most.
 * All ranked across Twitch, Kick and X together.
 */
export function TopChatters() {
  const snap = useStatsStore((s) => s.snapshot);
  const listUsers = useStatsStore((s) => s.listUsers);
  const showUser = useUserCardStore((s) => s.show);
  const [tab, setTab] = useState<Tab>("chatters");
  const [range, setRange] = useState<RangeKey>("day");
  // The live session is "today"; longer windows accumulate (real cross-session
  // data comes from the backend — this scales the live totals as a stand-in).
  const f = RANGE_FACTOR[range];
  const sc = (n: number) => compact(Math.round(n * f));

  // Bubble Bucks: 1/msg + 100/sub + 5/$ — the show's watch-&-earn currency.
  const bucksRows: Row[] =
    tab === "bucks"
      ? listUsers()
          .map((u) => ({ name: u.name, platform: u.platform, channel: u.channel, value: bucksFor(u) * f, display: `🫧 ${sc(bucksFor(u))}` }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 25)
      : [];

  const rows: Row[] =
    tab === "chatters"
      ? snap.topChatters.map((r) => ({ ...r, value: r.count * f, display: sc(r.count) }))
      : tab === "subs"
        ? snap.topSubs
            .map((r) => {
              const rev = subRevenue(r.platform, r.subs);
              return { name: r.name, platform: r.platform, channel: r.channel, value: rev * f, display: `$${sc(rev)}`, subCount: Math.round(r.subs * f) };
            })
            .sort((a, b) => b.value - a.value)
        : bucksRows;

  const max = Math.max(1, rows[0]?.value ?? 1);
  const summary =
    tab === "subs" ? `$${sc(snap.totalSubRevenue)} from subs`
    : tab === "bucks" ? `🫧 ${sc(listUsers().reduce((s, u) => s + bucksFor(u), 0))} issued`
    : `${sc(snap.totals.uniqueChatters)} chatters`;

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Trophy size={14} className="text-amber-400" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Leaderboards</span>
        <span className="ml-auto text-[10px] font-semibold tabular-nums text-accent">{summary}</span>
      </div>

      {/* time range */}
      <div className="mb-2 flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`flex-1 rounded-md border py-0.5 text-[10px] font-bold transition ${
              range === r.key ? "border-accent/60 bg-accent/15 text-accent" : "border-white/10 text-muted hover:text-ink"
            }`}
          >
            {r.label}
          </button>
        ))}
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
            {tab === "subs" ? "No subs yet" : tab === "bucks" ? "No Bubble Bucks earned yet" : "tallying chatters…"}
          </div>
        )}
        {rows.map((r, i) => (
          <motion.div
            key={`${r.platform}:${r.name}`}
            layout
            role="button"
            tabIndex={0}
            onClick={() => showUser(r.name, r.platform)}
            title="Open profile & mod tools"
            className="relative flex cursor-pointer items-center gap-2 overflow-hidden rounded-lg border border-white/8 px-2 py-1.5 transition hover:border-accent/40"
          >
            <div
              className="absolute inset-y-0 left-0 -z-0 rounded-lg opacity-20"
              style={{ width: `${(r.value / max) * 100}%`, background: platformColor(r.platform) }}
            />
            <span className={`z-10 w-5 text-center text-xs font-extrabold ${i === 0 ? "text-amber-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-amber-700" : "text-muted"}`}>
              {i + 1}
            </span>
            <SourceBadge platform={r.platform} compact />
            {r.channel && <span className="z-10 shrink-0 text-[10px] font-semibold text-muted/80">{r.channel}</span>}
            <span className="z-10 flex-1 truncate text-sm font-semibold text-ink">{r.name}</span>
            <span className={`z-10 flex items-baseline gap-1 text-xs font-bold tabular-nums ${tab === "chatters" ? "text-accent" : tab === "bucks" ? "text-amber-300" : "text-emerald-400"}`}>
              {tab === "subs" && r.subCount != null && <span className="text-[10px] font-semibold text-muted">{r.subCount} sub{r.subCount === 1 ? "" : "s"}</span>}
              {r.display}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
