import { motion } from "framer-motion";
import { Eye, Users, Clock, TrendingUp, Zap } from "lucide-react";
import { useStatsStore } from "@/store/statsStore";
import { platformColor, platformLabel } from "../SourceBadge";
import { Sparkline } from "../Sparkline";
import { useActivePlatforms } from "@/hooks/useActivePlatforms";
import { compact, watchTime, elapsed } from "@/lib/format";

/**
 * The headline live-stats panel, built for a wide tile. A prominent combined
 * total up top, then a column-aligned breakdown: each platform total with a
 * viewer-trend sparkline and, nested beneath, every channel (Ansem / Banks /
 * Market Bubble) — viewers, trend and the main engagement KPIs (no money).
 *
 * Columns are a shared grid so every sparkline + KPI lines up across all rows.
 */
const COLS = "grid grid-cols-[minmax(120px,1.4fr)_84px_70px_1fr_58px_64px_58px] items-center gap-x-2";

export function StatsWidget() {
  const snap = useStatsStore((s) => s.snapshot);
  const ALL = useActivePlatforms();
  const t = snap.totals;
  const wtTotal = watchTime(t.watchTimeMinutes);

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden p-4">
      {/* prominent combined total */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted">
          <Clock size={11} /> {elapsed(snap.elapsedMs)}
        </div>
        <div className="flex items-baseline gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Combined Viewers</span>
            <motion.span
              key={Math.round(t.viewers / 5)}
              initial={{ opacity: 0.5, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl font-black leading-none text-accent"
              style={{ textShadow: "0 0 22px color-mix(in srgb, var(--vc-accent) 55%, transparent)" }}
            >
              {compact(t.viewers)}
            </motion.span>
          </div>
          <span className="flex items-center gap-1 text-sm font-bold text-emerald-400">
            <TrendingUp size={14} /> peak {compact(t.peakViewers)}
          </span>
          <Sparkline data={t.history} width={120} height={34} strokeWidth={2} />
        </div>

        {/* main KPI chips */}
        <div className="ml-auto flex items-center gap-2">
          <Kpi icon={<Users size={15} />} value={compact(t.uniqueChatters)} label="chatters" sub={`${compact(t.activeChatters)} active`} />
          <Kpi icon={<Clock size={15} />} value={wtTotal.value} label={wtTotal.unit} />
          <Kpi icon={<Zap size={15} />} value={String(t.messagesPerMin)} label="msg/min" />
        </div>
      </div>

      {/* column headers */}
      <div className={`${COLS} px-2 text-[9px] font-bold uppercase tracking-wider text-muted/70`}>
        <span>Channel</span>
        <span className="pl-3">Viewers</span>
        <span>Trend</span>
        <span />
        <span className="text-right">Chat</span>
        <span className="text-right">Watch</span>
        <span className="text-right">Eng</span>
      </div>

      {/* hierarchical breakdown */}
      <div className="vc-scroll flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
        {ALL.map((p) => {
          const s = snap.perPlatform[p];
          const wt = watchTime(s.watchTimeMinutes);
          const engagement = s.viewers > 0 ? (s.activeChatters / s.viewers) * 100 : 0;
          const channels = snap.accounts.filter((a) => a.platform === p);
          return (
            <div key={p} className="rounded-lg border border-white/8 bg-white/[0.02]">
              {/* platform total */}
              <div className={`${COLS} px-2 py-1.5`}>
                <span className="truncate text-[15px] font-extrabold" style={{ color: platformColor(p) }}>{platformLabel(p)}</span>
                <span className="flex items-center justify-end gap-1 text-[15px] font-bold tabular-nums text-ink"><Eye size={12} className="text-muted" /> {compact(s.viewers)}</span>
                <Sparkline data={s.history} color={platformColor(p)} width={64} height={22} strokeWidth={2} />
                <span />
                <span className="text-right text-[12px] font-semibold tabular-nums text-muted">{compact(s.uniqueChatters)}</span>
                <span className="text-right text-[12px] font-semibold tabular-nums text-muted">{wt.value}{wt.unit === "min" ? "m" : "h"}</span>
                <span className="text-right text-[12px] font-bold tabular-nums text-emerald-400/90">{engagement.toFixed(1)}%</span>
              </div>
              {/* nested channels */}
              {channels.length > 0 && (
                <div className="border-t border-white/5 py-0.5">
                  {channels.map((c) => {
                    const cwt = watchTime(c.watchTimeMinutes);
                    const share = s.viewers > 0 ? (c.viewers / s.viewers) * 100 : 0;
                    return (
                      <div key={c.accountId} className={`${COLS} px-2 py-0.5`}>
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="h-3 w-0.5 shrink-0 rounded" style={{ background: `color-mix(in srgb, ${platformColor(p)} 60%, transparent)` }} />
                          <span className="truncate text-[13px] font-bold text-ink/85">{c.displayName}</span>
                        </span>
                        <span className="flex items-center justify-end gap-1 text-[13px] font-semibold tabular-nums text-ink/80"><Eye size={10} className="text-muted opacity-60" /> {compact(c.viewers)}</span>
                        <Sparkline data={c.history} color={`color-mix(in srgb, ${platformColor(p)} 75%, white)`} width={64} height={16} />
                        <span />
                        <span className="text-right text-[11px] font-semibold tabular-nums text-muted">{compact(c.uniqueChatters)}</span>
                        <span className="text-right text-[11px] font-semibold tabular-nums text-muted">{cwt.value}{cwt.unit === "min" ? "m" : "h"}</span>
                        <span className="text-right text-[11px] font-semibold tabular-nums text-muted/80">{share.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Kpi({ icon, value, label, sub }: { icon: React.ReactNode; value: string; label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-1.5">
      <span className="text-accent">{icon}</span>
      <div className="leading-tight">
        <div className="text-lg font-extrabold text-ink">{value}</div>
        <div className="text-[9px] uppercase tracking-wider text-muted">{sub ? `${label} · ${sub}` : label}</div>
      </div>
    </div>
  );
}
