import { motion } from "framer-motion";
import { Eye, Users, Clock, TrendingUp, Zap } from "lucide-react";
import { useStatsStore } from "@/store/statsStore";
import { platformColor, platformLabel } from "../SourceBadge";
import { Sparkline } from "../Sparkline";
import { useActivePlatforms } from "@/hooks/useActivePlatforms";
import { compact, watchTime, elapsed } from "@/lib/format";

/**
 * The headline live-stats panel: combined viewers up top, then a hierarchical
 * breakdown — each platform's total with a viewer-trend sparkline, and nested
 * under it every channel (Ansem / Banks / Market Bubble) with its own trend.
 */
export function StatsWidget() {
  const snap = useStatsStore((s) => s.snapshot);
  const ALL = useActivePlatforms();
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
          <span className="ml-auto"><Sparkline data={t.history} width={70} height={22} /></span>
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

      {/* hierarchical breakdown: platform total → its channels, each with a trend */}
      <div className="vc-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {ALL.map((p) => {
          const s = snap.perPlatform[p];
          const wt = watchTime(s.watchTimeMinutes);
          const engagement = s.viewers > 0 ? (s.activeChatters / s.viewers) * 100 : 0;
          const channels = snap.accounts.filter((a) => a.platform === p);
          return (
            <div key={p} className="rounded-md border border-white/8 bg-white/[0.02]">
              {/* platform total */}
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="w-16 shrink-0 text-[11px] font-bold" style={{ color: platformColor(p) }}>{platformLabel(p)}</span>
                <span className="flex items-center gap-0.5 text-[11px] font-semibold text-ink"><Eye size={10} className="text-muted" /> {compact(s.viewers)}</span>
                <Sparkline data={s.history} color={platformColor(p)} width={48} height={16} />
                <span className="ml-auto flex items-center gap-2 text-[9px] tabular-nums text-muted">
                  <span title="unique chatters">{compact(s.uniqueChatters)}<span className="opacity-50"> chat</span></span>
                  <span title="watch time">{wt.value}{wt.unit === "min" ? "m" : "h"}</span>
                  <span title="engagement">{engagement.toFixed(1)}%</span>
                </span>
              </div>
              {/* nested channels */}
              {channels.length > 0 && (
                <div className="border-t border-white/5">
                  {channels.map((c) => (
                    <div key={c.accountId} className="flex items-center gap-2 px-2 py-0.5 pl-3">
                      <span className="h-2.5 w-px shrink-0 bg-white/15" />
                      <span className="max-w-[80px] shrink-0 truncate text-[10px] font-semibold text-muted">{c.displayName}</span>
                      <span className="flex items-center gap-0.5 text-[10px] tabular-nums text-ink/80"><Eye size={9} className="text-muted opacity-60" /> {compact(c.viewers)}</span>
                      <Sparkline data={c.history} width={36} height={12} />
                      <span className="ml-auto flex items-center gap-2 text-[9px] tabular-nums text-muted opacity-80">
                        <span title="unique chatters">{compact(c.uniqueChatters)}</span>
                        {c.donated > 0 && <span className="text-emerald-400" title="raised">${compact(c.donated)}</span>}
                        {c.subs > 0 && <span title="subs">{compact(c.subs)}s</span>}
                      </span>
                    </div>
                  ))}
                </div>
              )}
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
