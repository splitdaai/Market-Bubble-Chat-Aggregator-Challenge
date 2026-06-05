import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Users, Eye, Clock, MessageSquare, DollarSign, Gift, TrendingUp, Radio, ArrowRight, RotateCcw,
} from "lucide-react";
import type { StreamSession, Platform } from "@shared/types";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useStatsStore } from "@/store/statsStore";
import {
  buildLiveSession, METRICS, fmtViewers, fmtMoney, fmtHours, fmtInt, fmtDate, pctDelta,
} from "@/lib/analytics";
import { TrendChart, Sparkline, DeltaBadge } from "./charts";
import { SourceBadge, platformColor, platformLabel } from "../SourceBadge";

const PLATFORMS: Platform[] = ["twitch", "kick", "x"];
const pk = (s: StreamSession, p: Platform) => s.perPlatform.find((x) => x.platform === p)!;

type Plat = "all" | Platform;

/** Read a KPI field from a session, aggregate or scoped to one platform. */
function fv(s: StreamSession, field: string, plat: Plat): number {
  if (plat === "all") return (s as unknown as Record<string, number>)[field] ?? 0;
  const pp = s.perPlatform.find((x) => x.platform === plat);
  return pp ? (pp as unknown as Record<string, number>)[field] ?? 0 : 0;
}

/** The analytics tab: historical KPIs, trends, and current-vs-past growth. */
export function AnalyticsTab() {
  const sessions = useAnalyticsStore((s) => s.sessions);
  const ensureSeeded = useAnalyticsStore((s) => s.ensureSeeded);
  const reseed = useAnalyticsStore((s) => s.reseed);
  const snap = useStatsStore((s) => s.snapshot);

  useEffect(() => { ensureSeeded(); }, [ensureSeeded]);

  const [pace, setPace] = useState(true); // true = "on pace" projection, false = "so far"
  const live = useMemo(() => buildLiveSession(snap, pace), [snap, pace]);
  const past = useMemo(() => [...sessions].sort((a, b) => a.startedAt - b.startedAt), [sessions]);
  const all = useMemo(() => [...past, live], [past, live]);
  const prev = past[past.length - 1]; // last completed stream

  const [metricKey, setMetricKey] = useState("avgViewers");
  const [focusId, setFocusId] = useState("live"); // the "B" of the comparison
  const [plat, setPlat] = useState<Plat>("all"); // platform filter
  const metric = METRICS.find((m) => m.key === metricKey)!;

  if (!prev) {
    return <div className="grid h-64 place-items-center text-muted">Loading analytics…</div>;
  }

  const trendPoints = all.map((s) => ({ label: s.live ? "LIVE" : fmtDate(s.startedAt), value: fv(s, metric.key, plat), live: s.live }));

  const KPIS = [
    { label: "Avg Viewers", icon: <Users size={14} />, field: "avgViewers", fmt: fmtViewers },
    { label: "Peak Viewers", icon: <Eye size={14} />, field: "peakViewers", fmt: fmtViewers },
    { label: "Watch Time", icon: <Clock size={14} />, field: "watchTimeMinutes", fmt: fmtHours },
    { label: "Unique Chatters", icon: <MessageSquare size={14} />, field: "uniqueChatters", fmt: fmtInt },
    { label: "Donations", icon: <DollarSign size={14} />, field: "donated", fmt: fmtMoney },
    { label: "Subs", icon: <Gift size={14} />, field: "subs", fmt: fmtInt },
  ];

  return (
    <div className="relative z-10 mx-auto max-w-[1400px] px-1 pb-24">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <TrendingUp className="text-accent" /> Stream Analytics
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {past.length} past streams · since {fmtDate(past[0].startedAt)} ·{" "}
            <span className="font-semibold text-ink">{plat === "all" ? "All platforms" : platformLabel(plat)}</span> ·{" "}
            current{pace ? " (on pace)" : " (so far)"} vs last
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* platform filter */}
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {(["all", ...PLATFORMS] as Plat[]).map((p) => (
              <button
                key={p}
                onClick={() => setPlat(p)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold capitalize transition ${
                  plat === p ? "bg-accent/20 text-accent" : "text-muted hover:text-ink"
                }`}
                style={plat === p && p !== "all" ? { color: platformColor(p) } : undefined}
              >
                {p === "all" ? "All" : platformLabel(p)}
              </button>
            ))}
          </div>
          {/* current-stream comparison mode */}
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1" title="How to count the in-progress stream">
            <button
              onClick={() => setPace(true)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${pace ? "bg-accent/20 text-accent" : "text-muted hover:text-ink"}`}
            >
              On pace
            </button>
            <button
              onClick={() => setPace(false)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${!pace ? "bg-accent/20 text-accent" : "text-muted hover:text-ink"}`}
            >
              So far
            </button>
          </div>
          <button
            onClick={reseed}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
            title="Re-roll demo history"
          >
            <RotateCcw size={13} /> Demo data
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            icon={k.icon}
            value={k.fmt(fv(live, k.field, plat))}
            curr={fv(live, k.field, plat)}
            prev={fv(prev, k.field, plat)}
            spark={all.map((s) => fv(s, k.field, plat))}
          />
        ))}
      </div>

      {/* trend chart */}
      <section className="vc-glass mt-4 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted">Trend</h3>
          <div className="flex flex-wrap gap-1">
            {METRICS.map((m) => (
              <button
                key={m.key}
                onClick={() => setMetricKey(m.key)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition ${
                  metricKey === m.key ? "bg-accent/20 text-accent shadow-neon" : "text-muted hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-accent">{metric.fmt(fv(live, metric.key, plat))}</span>
          <span className="text-xs text-muted">current · {plat === "all" ? "" : `${platformLabel(plat)} · `}{metric.label}</span>
          <DeltaBadge curr={fv(live, metric.key, plat)} prev={fv(prev, metric.key, plat)} size="lg" />
        </div>
        <TrendChart points={trendPoints} formatY={metric.fmt} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PlatformGrowth past={past} live={live} prev={prev} />
        <ComparePanel all={all} focusId={focusId} setFocusId={setFocusId} plat={plat} />
      </div>

      {/* streams table */}
      <StreamsTable all={all} focusId={focusId} setFocusId={setFocusId} plat={plat} />
    </div>
  );
}

/* --------------------------------- KPI card ---------------------------------- */

function KpiCard({ label, icon, value, curr, prev, spark }: {
  label: string; icon: React.ReactNode; value: string; curr: number; prev: number; spark: number[];
}) {
  return (
    <div className="vc-glass flex flex-col p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        {icon} {label}
      </div>
      <div className="mt-1 text-2xl font-extrabold leading-none text-ink">{value}</div>
      <div className="mt-1.5 flex items-end justify-between">
        <DeltaBadge curr={curr} prev={prev} />
        <Sparkline data={spark} />
      </div>
    </div>
  );
}

/* ------------------------------ platform growth ------------------------------ */

function PlatformGrowth({ past, live, prev }: { past: StreamSession[]; live: StreamSession; prev: StreamSession }) {
  const totalNow = Math.max(1, PLATFORMS.reduce((s, p) => s + pk(live, p).avgViewers, 0));
  return (
    <section className="vc-glass p-4">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted">Platform Growth</h3>
      <div className="space-y-2.5">
        {PLATFORMS.map((p) => {
          const curr = pk(live, p).avgViewers;
          const was = pk(prev, p).avgViewers;
          const spark = [...past, live].map((s) => pk(s, p).avgViewers);
          const share = (curr / totalNow) * 100;
          return (
            <div key={p} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SourceBadge platform={p} />
                  <span className="text-sm font-bold tabular-nums text-ink">{fmtViewers(curr)}</span>
                  <span className="text-[10px] text-muted">avg · {share.toFixed(0)}% share</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkline data={spark} width={70} height={24} color={platformColor(p)} />
                  <DeltaBadge curr={curr} prev={was} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------- compare panel ------------------------------ */

const COMPARE_ROWS: { label: string; field: string; fmt: (n: number) => string }[] = [
  { label: "Avg Viewers", field: "avgViewers", fmt: fmtViewers },
  { label: "Peak Viewers", field: "peakViewers", fmt: fmtViewers },
  { label: "Watch Time", field: "watchTimeMinutes", fmt: fmtHours },
  { label: "Unique Chatters", field: "uniqueChatters", fmt: fmtInt },
  { label: "Messages", field: "messages", fmt: fmtInt },
  { label: "Donations", field: "donated", fmt: fmtMoney },
  { label: "Subs", field: "subs", fmt: fmtInt },
  { label: "Followers", field: "followersGained", fmt: fmtInt },
];

function ComparePanel({ all, focusId, setFocusId, plat }: { all: StreamSession[]; focusId: string; setFocusId: (id: string) => void; plat: Plat }) {
  // B = focused stream; A = the one immediately before it chronologically.
  const bIdx = Math.max(0, all.findIndex((s) => s.id === focusId));
  const b = all[bIdx];
  const aIdx = Math.max(0, bIdx - 1);
  const a = all[aIdx];

  const sessionLabel = (s: StreamSession) => (s.live ? "Current Stream" : `${s.title}`);

  return (
    <section className="vc-glass p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted">Compare</h3>
        <select
          value={focusId}
          onChange={(e) => setFocusId(e.target.value)}
          className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-ink outline-none focus:border-accent"
        >
          {[...all].reverse().map((s) => (
            <option key={s.id} value={s.id}>{s.live ? "Current Stream" : `${fmtDate(s.startedAt)} · ${s.title}`}</option>
          ))}
        </select>
      </div>

      <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-[11px] font-semibold">
        <span className="truncate text-muted">{sessionLabel(a)}</span>
        <ArrowRight size={13} className="mx-auto text-muted" />
        <span className="flex items-center justify-center gap-1 truncate text-accent">
          {b.live && <Radio size={11} className="animate-pulse-glow" />} {sessionLabel(b)}
        </span>
      </div>

      <div className="space-y-1">
        {COMPARE_ROWS.map((row) => {
          const av = fv(a, row.field, plat), bv = fv(b, row.field, plat);
          return (
            <div key={row.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-md px-2 py-1 odd:bg-white/[0.02]">
              <span className="text-right text-xs tabular-nums text-muted">{row.fmt(av)}</span>
              <span className="text-center text-[10px] uppercase tracking-wider text-muted">{row.label}</span>
              <span className="flex items-center justify-start gap-1.5">
                <span className="text-sm font-bold tabular-nums text-ink">{row.fmt(bv)}</span>
                <DeltaBadge curr={bv} prev={av} />
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------- streams table ------------------------------ */

function StreamsTable({ all, focusId, setFocusId, plat }: { all: StreamSession[]; focusId: string; setFocusId: (id: string) => void; plat: Plat }) {
  const rows = [...all].reverse(); // newest first

  return (
    <section className="vc-glass mt-4 overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted">All Streams</h3>
        <span className="text-[10px] text-muted">click a row to compare · Δ vs previous stream</span>
      </div>
      <div className="vc-scroll max-h-[440px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--vc-bg)]/80 backdrop-blur">
            <tr className="text-[10px] uppercase tracking-wider text-muted">
              <Th className="text-left">Date</Th>
              <Th className="text-left">Stream</Th>
              <Th>Avg</Th><Th>Peak</Th><Th>Chatters</Th><Th>Watch</Th><Th>Raised</Th><Th>Subs</Th>
              <Th>Avg Δ</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const prevS = rows[i + 1]; // chronologically previous
              const focused = s.id === focusId;
              return (
                <tr
                  key={s.id}
                  onClick={() => setFocusId(s.id)}
                  className={`cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04] ${focused ? "bg-accent/10" : ""}`}
                >
                  <Td className="text-left text-xs text-muted">{s.live ? "now" : fmtDate(s.startedAt)}</Td>
                  <Td className="text-left">
                    <span className="flex items-center gap-1.5 font-semibold text-ink">
                      {s.live && (
                        <span className="flex items-center gap-1 rounded bg-red-500/15 px-1 text-[9px] font-black uppercase text-red-400">
                          <span className="h-1 w-1 animate-ping rounded-full bg-red-500" />live
                        </span>
                      )}
                      {s.title}
                    </span>
                  </Td>
                  <Td className="font-semibold">{fmtViewers(fv(s, "avgViewers", plat))}</Td>
                  <Td>{fmtViewers(fv(s, "peakViewers", plat))}</Td>
                  <Td>{fmtInt(fv(s, "uniqueChatters", plat))}</Td>
                  <Td>{fmtHours(fv(s, "watchTimeMinutes", plat))}</Td>
                  <Td className="text-emerald-400">{fmtMoney(fv(s, "donated", plat))}</Td>
                  <Td>{fmtInt(fv(s, "subs", plat))}</Td>
                  <Td>{prevS ? <DeltaBadge curr={fv(s, "avgViewers", plat)} prev={fv(prevS, "avgViewers", plat)} /> : <span className="text-muted">—</span>}</Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-3 py-2 text-right font-semibold ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink ${className}`}>{children}</td>;
}
