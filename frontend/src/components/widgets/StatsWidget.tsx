import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, Users, Clock, TrendingUp, Zap } from "lucide-react";
import { useStatsStore } from "@/store/statsStore";
import { platformColor, platformLabel } from "../SourceBadge";
import { useActivePlatforms } from "@/hooks/useActivePlatforms";
import { byStreamer } from "@/lib/streamers";
import { compact, watchTime, elapsed } from "@/lib/format";

/**
 * The headline live-stats panel: aggregate viewers + a per-platform OR
 * per-channel breakdown of viewers, unique chatters, watch time and engagement.
 */
export function StatsWidget() {
  const snap = useStatsStore((s) => s.snapshot);
  const ALL = useActivePlatforms();
  const [mode, setMode] = useState<"platform" | "channel">("platform");
  const streamers = byStreamer(snap.accounts);
  const t = snap.totals;
  const totalViewers = Math.max(1, t.viewers);

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden p-3">
      {/* header */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Live Stats</span>
        <span className="flex items-center gap-1 text-[10px] tabular-nums text-muted">
          <Clock size={10} /> {elapsed(snap.elapsedMs)}
        </span>
      </div>

      {/* combined viewers headline — the number nobody else aggregates */}
      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
          <Eye size={12} /> Combined Viewers
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <motion.span
            key={Math.round(t.viewers / 5)}
            initial={{ opacity: 0.5, y: -2 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold text-accent"
            style={{ textShadow: "0 0 18px color-mix(in srgb, var(--vc-accent) 55%, transparent)" }}
          >
            {compact(t.viewers)}
          </motion.span>
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <TrendingUp size={12} /> peak {compact(t.peakViewers)}
          </span>
        </div>
        {/* share of voice */}
        <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-white/5">
          {ALL.map((p) => (
            <div
              key={p}
              style={{ width: `${(snap.perPlatform[p].viewers / totalViewers) * 100}%`, background: platformColor(p) }}
              title={`${platformLabel(p)}: ${compact(snap.perPlatform[p].viewers)} viewers`}
            />
          ))}
        </div>
      </div>

      {/* aggregate mini-cards */}
      <div className="grid grid-cols-3 gap-2">
        <MiniStat icon={<Users size={13} />} label="Chatters" value={compact(t.uniqueChatters)} sub={`${compact(t.activeChatters)} active`} />
        <MiniStat icon={<Clock size={13} />} label="Watch" value={watchTime(t.watchTimeMinutes).value} sub={watchTime(t.watchTimeMinutes).unit} />
        <MiniStat icon={<Zap size={13} />} label="Chat" value={String(t.messagesPerMin)} sub="msg/min" />
      </div>

      {/* group toggle */}
      <div className="flex gap-1 rounded-lg bg-white/[0.03] p-0.5">
        {(["platform", "channel"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md py-0.5 text-[10px] font-bold transition ${mode === m ? "bg-accent/20 text-accent" : "text-muted hover:text-ink"}`}
          >
            {m === "platform" ? "By platform" : "By channel"}
          </button>
        ))}
      </div>

      {/* breakdown rows — single line so everything fits with no scroll */}
      <div className="flex min-h-0 flex-1 flex-col justify-between gap-1">
        {mode === "platform"
          ? ALL.map((p) => {
              const s = snap.perPlatform[p];
              const wt = watchTime(s.watchTimeMinutes);
              const engagement = s.viewers > 0 ? (s.activeChatters / s.viewers) * 100 : 0;
              return (
                <div key={p} className="flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.02] px-2 py-1">
                  <span className="w-16 shrink-0 text-[11px] font-bold" style={{ color: platformColor(p) }}>{platformLabel(p)}</span>
                  <span className="flex items-center gap-0.5 text-[11px] font-semibold text-ink"><Eye size={10} className="text-muted" /> {compact(s.viewers)}</span>
                  <span className="ml-auto flex items-center gap-2 text-[9px] tabular-nums text-muted">
                    <span title="unique chatters">{compact(s.uniqueChatters)}<span className="opacity-50"> chat</span></span>
                    <span title="watch time">{wt.value}{wt.unit === "min" ? "m" : "h"}</span>
                    <span title="engagement">{engagement.toFixed(1)}%</span>
                  </span>
                </div>
              );
            })
          : streamers.map((st) => {
              const wt = watchTime(st.watchTimeMinutes);
              return (
                <div key={st.name} className="flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.02] px-2 py-1">
                  <span className="max-w-[78px] shrink-0 truncate text-[11px] font-bold text-ink">{st.name}</span>
                  <span className="flex shrink-0 gap-0.5">
                    {st.platforms.map((p) => <span key={p} className="h-1.5 w-2 rounded-full" style={{ background: platformColor(p) }} title={p} />)}
                  </span>
                  <span className="flex items-center gap-0.5 text-[11px] font-semibold text-ink"><Eye size={10} className="text-muted" /> {compact(st.viewers)}</span>
                  <span className="ml-auto flex items-center gap-2 text-[9px] tabular-nums text-muted">
                    <span title="unique chatters">{compact(st.uniqueChatters)}</span>
                    <span title="watch time">{wt.value}{wt.unit === "min" ? "m" : "h"}</span>
                    <span className="text-emerald-400" title="raised">${compact(st.donated)}</span>
                    <span title="subs">{compact(st.subs)} sub</span>
                  </span>
                </div>
              );
            })}
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-muted">{icon}</div>
      <div className="mt-0.5 text-lg font-extrabold leading-none text-ink">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-[9px] text-muted opacity-70">{sub}</div>
    </div>
  );
}
