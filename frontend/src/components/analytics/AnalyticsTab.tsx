import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {Users, Eye, Clock, MessageSquare, DollarSign, Gift, TrendingUp, Radio, ArrowRight, RotateCcw, UserPlus, MonitorPlay, Megaphone } from "lucide-react";
import type { StreamSession, Platform, KpiKey } from "@shared/types";
import { useAnalyticsStore } from "@/store/analyticsStore";
import { useStatsStore } from "@/store/statsStore";
import { useConnectionsStore } from "@/store/connectionsStore";
import {
  buildLiveSession, METRICS, fmtViewers, fmtMoney, fmtHours, fmtInt, fmtDate, pctDelta,
} from "@/lib/analytics";
import { TrendChart, Sparkline, DeltaBadge } from "./charts";
import { SourceBadge, platformColor, platformLabel } from "../SourceBadge";
import { BubbleBucksAnalytics } from "./BubbleBucksAnalytics";
import { useActivePlatforms } from "@/hooks/useActivePlatforms";
import { elapsed } from "@/lib/format";
import { subRevenue, adRevenue } from "@/lib/revenue";

const pk = (s: StreamSession, p: Platform) => s.perPlatform.find((x) => x.platform === p)!;

type Plat = "all" | Platform;
type Range = "all" | "hour" | "day" | "week" | "month" | "year";

const DAY = 86_400_000;
const RANGE_MS: Record<Exclude<Range, "all">, number> = {
  hour: 3_600_000, day: DAY, week: 7 * DAY, month: 30 * DAY, year: 365 * DAY,
};
const RANGE_LABEL: Record<Range, string> = {
  all: "All time", hour: "Past hour", day: "Past day", week: "Past week", month: "Past month", year: "Past year",
};

/** Read a KPI field — aggregate, scoped to a platform, or scoped to an account. */
function fv(s: StreamSession, field: KpiKey, plat: Plat, accountId?: string | null): number {
  if (accountId) {
    const a = s.perAccount?.find((x) => x.accountId === accountId);
    return (a ? a[field] : 0) ?? 0;
  }
  if (plat === "all") return s[field] ?? 0; // old sessions may predate newer KPI fields
  const pp = s.perPlatform.find((x) => x.platform === plat);
  return (pp ? pp[field] : 0) ?? 0;
}

/** Sub revenue ($) — per-platform sub counts × each platform's payout rate. */
function subRev(s: StreamSession, plat: Plat, accountId?: string | null): number {
  if (accountId) {
    const a = s.perAccount?.find((x) => x.accountId === accountId);
    return a ? subRevenue(a.platform, a.subs) : 0;
  }
  if (plat === "all") return s.perPlatform.reduce((sum, pp) => sum + subRevenue(pp.platform, pp.subs), 0);
  const pp = s.perPlatform.find((x) => x.platform === plat);
  return pp ? subRevenue(pp.platform, pp.subs) : 0;
}

/** Estimated ad revenue ($) — per-platform ad impressions × that platform's net CPM. */
function adRev(s: StreamSession, plat: Plat, accountId?: string | null): number {
  if (accountId) {
    const a = s.perAccount?.find((x) => x.accountId === accountId);
    return a ? adRevenue(a.platform, a.adImpressions ?? 0) : 0;
  }
  if (plat === "all") return s.perPlatform.reduce((sum, pp) => sum + adRevenue(pp.platform, pp.adImpressions ?? 0), 0);
  const pp = s.perPlatform.find((x) => x.platform === plat);
  return pp ? adRevenue(pp.platform, pp.adImpressions ?? 0) : 0;
}

/** Value accessor that returns $ sub-revenue for the "subs" field, raw otherwise. */
function valOf(s: StreamSession, field: KpiKey, plat: Plat, accountId?: string | null): number {
  if (field === "subs") return subRev(s, plat, accountId);
  if (field === "adImpressions") return adRev(s, plat, accountId); // "Ad Revenue" rides this field
  return fv(s, field, plat, accountId);
}
/** Money formatter for the "subs" field, the given formatter otherwise. */
function fmtOf(field: KpiKey, base: (n: number) => string): (n: number) => string {
  return field === "subs" || field === "adImpressions" ? fmtMoney : base;
}

/** The analytics tab: historical KPIs, trends, and current-vs-past growth. */
export function AnalyticsTab() {
  const sessions = useAnalyticsStore((s) => s.sessions);
  const ensureSeeded = useAnalyticsStore((s) => s.ensureSeeded);
  const reseed = useAnalyticsStore((s) => s.reseed);
  const snap = useStatsStore((s) => s.snapshot);

  useEffect(() => { ensureSeeded(); }, [ensureSeeded]);

  const [pace, setPace] = useState(true); // true = "on pace" projection, false = "so far"
  const [view, setView] = useState<"overview" | "bucks">("overview"); // analytics sub-tab
  const [range, setRange] = useState<Range>("all"); // time window
  const live = useMemo(() => buildLiveSession(snap, pace), [snap, pace]);
  const past = useMemo(() => [...sessions].sort((a, b) => a.startedAt - b.startedAt), [sessions]);
  const pastInRange = useMemo(() => {
    if (range === "all") return past;
    const cutoff = Date.now() - RANGE_MS[range];
    return past.filter((s) => s.startedAt >= cutoff);
  }, [past, range]);
  const all = useMemo(() => [...pastInRange, live], [pastInRange, live]);
  const prev = pastInRange[pastInRange.length - 1] ?? live; // last stream in range (else compare to self)

  const [metricKey, setMetricKey] = useState<KpiKey>("avgViewers");
  const [focusId, setFocusId] = useState("live"); // the "B" of the comparison
  const [plat, setPlat] = useState<Plat>("all"); // platform filter
  const [account, setAccount] = useState<string | null>(null); // account filter (overrides platform)
  const accountsList = useConnectionsStore((s) => s.accounts);
  const activePlats = useActivePlatforms();
  const metric = METRICS.find((m) => m.key === metricKey)!;
  const accountMeta = account ? accountsList.find((a) => a.id === account) : null;
  const scopeLabel = accountMeta ? `${accountMeta.displayName} · ${platformLabel(accountMeta.platform)}` : plat === "all" ? "All platforms" : platformLabel(plat);

  // Only a genuine cold-start (no past streams AND no live session) shows the
  // loader — otherwise we always have at least the current stream to render.
  if (all.length === 0) {
    return <div className="grid h-64 place-items-center text-muted">Loading analytics…</div>;
  }

  const trendPoints = all.map((s) => ({ label: s.live ? "LIVE" : fmtDate(s.startedAt), value: valOf(s, metric.key, plat, account), live: s.live }));

  // Mean of a KPI across the past streams in range (the "average per stream").
  const avgVal = (field: KpiKey) => {
    if (!pastInRange.length) return 0;
    return pastInRange.reduce((sum, s) => sum + valOf(s, field, plat, account), 0) / pastInRange.length;
  };

  const KPIS: { label: string; icon: React.ReactNode; field: KpiKey; fmt: (n: number) => string }[] = [
    { label: "Avg Viewers", icon: <Users size={14} />, field: "avgViewers", fmt: fmtViewers },
    { label: "Peak Viewers", icon: <Eye size={14} />, field: "peakViewers", fmt: fmtViewers },
    { label: "Watch Time", icon: <Clock size={14} />, field: "watchTimeMinutes", fmt: fmtHours },
    { label: "Unique Chatters", icon: <MessageSquare size={14} />, field: "uniqueChatters", fmt: fmtInt },
    { label: "Donations", icon: <DollarSign size={14} />, field: "donated", fmt: fmtMoney },
    { label: "Sub Revenue", icon: <Gift size={14} />, field: "subs", fmt: fmtMoney },
    { label: "New Followers", icon: <UserPlus size={14} />, field: "followersGained", fmt: fmtInt },
    { label: "Ad Revenue (est)", icon: <MonitorPlay size={14} />, field: "adImpressions", fmt: fmtMoney },
    { label: "Ads Shown", icon: <Megaphone size={14} />, field: "adsShown", fmt: fmtInt },
  ];

  return (
    <div className="relative z-10 mx-auto max-w-[1400px] px-1 pb-24">
      {/* header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="serif flex items-center gap-2 text-2xl font-extrabold tracking-tight">
            <TrendingUp className="text-accent" /> Stream Analytics
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {pastInRange.length} stream{pastInRange.length === 1 ? "" : "s"} · {RANGE_LABEL[range]} ·{" "}
            <span className="font-semibold text-ink">{scopeLabel}</span> ·{" "}
            current{pace ? " (on pace)" : " (so far)"} vs last
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* platform filter */}
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {(["all", ...activePlats] as Plat[]).map((p) => (
              <button
                key={p}
                onClick={() => { setPlat(p); setAccount(null); }}
                className={`rounded-md px-2.5 py-1 text-[11px] font-bold capitalize transition ${
                  !account && plat === p ? "bg-accent/20 text-accent" : "text-muted hover:text-ink"
                }`}
                style={!account && plat === p && p !== "all" ? { color: platformColor(p) } : undefined}
              >
                {p === "all" ? "All" : platformLabel(p)}
              </button>
            ))}
          </div>
          {/* per-account filter */}
          <select
            value={account ?? ""}
            onChange={(e) => setAccount(e.target.value || null)}
            className={`rounded-lg border bg-black/40 px-2 py-1.5 text-[11px] font-semibold outline-none focus:border-accent ${account ? "border-accent text-accent" : "border-white/10 text-muted"}`}
            title="Filter by account"
          >
            <option value="">All accounts</option>
            {activePlats.map((p) => {
              const onP = accountsList.filter((a) => a.platform === p);
              if (!onP.length) return null;
              return (
                <optgroup key={p} label={platformLabel(p)}>
                  {onP.map((a) => <option key={a.id} value={a.id}>{a.displayName} · {platformLabel(p)}</option>)}
                </optgroup>
              );
            })}
          </select>
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
          {/* time range */}
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
            className={`rounded-lg border bg-black/40 px-2 py-1.5 text-[11px] font-bold outline-none focus:border-accent ${range !== "all" ? "border-accent text-accent" : "border-white/10 text-muted"}`}
            title="Time range"
          >
            {(["all", "year", "month", "week", "day", "hour"] as Range[]).map((r) => (
              <option key={r} value={r}>{RANGE_LABEL[r]}</option>
            ))}
          </select>
          <button
            onClick={reseed}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-ink"
            title="Re-roll demo history"
          >
            <RotateCcw size={13} /> Demo data
          </button>
        </div>
      </div>

      {/* sub-tabs: Overview vs Bubble Bucks (each gets its own page so the BB
          leaderboards never sit on top of the stream metrics) */}
      <div className="mb-4 inline-flex gap-1 rounded-xl border border-accent/25 bg-accent/[0.06] p-1">
        {([["overview", "Overview"], ["bucks", "Bubble Bucks"]] as const).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-bold transition ${
              view === id ? "bg-accent/25 text-accent shadow-neon" : "text-muted hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "bucks" && <BubbleBucksAnalytics />}

      {view === "overview" && (
      <>
      {/* current / in-progress stream — live snapshot */}
      <CurrentStreamCard live={live} prev={prev} snap={snap} plat={plat} account={account} pace={pace} />

      {/* per-stream AVERAGE across history (NOT a copy of the current stream) —
          the delta shows how the live stream compares to your norm. */}
      <div className="mb-2 mt-5 flex items-baseline gap-2">
        <h3 className="text-sm font-bold uppercase tracking-widest text-muted">Per-stream average</h3>
        <span className="text-[11px] text-faint">{pastInRange.length} past stream{pastInRange.length === 1 ? "" : "s"} · Δ = current vs average</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {KPIS.map((k) => {
          const avg = avgVal(k.field);
          return (
            <KpiCard
              key={k.label}
              label={k.label}
              icon={k.icon}
              value={k.fmt(avg)}
              curr={valOf(live, k.field, plat, account)}
              prev={avg}
              spark={pastInRange.map((s) => valOf(s, k.field, plat, account))}
            />
          );
        })}
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
          <span className="text-3xl font-extrabold text-accent">{fmtOf(metric.key, metric.fmt)(valOf(live, metric.key, plat, account))}</span>
          <span className="text-xs text-muted">current · {accountMeta ? `${accountMeta.displayName} · ` : plat === "all" ? "" : `${platformLabel(plat)} · `}{metric.label}</span>
          <DeltaBadge curr={valOf(live, metric.key, plat, account)} prev={valOf(prev, metric.key, plat, account)} size="lg" />
        </div>
        <TrendChart points={trendPoints} formatY={fmtOf(metric.key, metric.fmt)} />
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <PlatformGrowth past={pastInRange} live={live} prev={prev} />
        <ComparePanel all={all} focusId={focusId} setFocusId={setFocusId} plat={plat} account={account} />
      </div>

      {/* streams table */}
      <StreamsTable all={all} focusId={focusId} setFocusId={setFocusId} plat={plat} account={account} />
      </>
      )}
    </div>
  );
}

/* ----------------------------- current stream card --------------------------- */

function CurrentStreamCard({
  live, prev, snap, plat, account, pace,
}: {
  live: StreamSession; prev: StreamSession; snap: ReturnType<typeof useStatsStore.getState>["snapshot"];
  plat: Plat; account: string | null; pace: boolean;
}) {
  const STATS: { label: string; field: KpiKey; fmt: (n: number) => string }[] = [
    { label: "Avg Viewers", field: "avgViewers", fmt: fmtViewers },
    { label: "Peak", field: "peakViewers", fmt: fmtViewers },
    { label: "Ad Rev (est)", field: "adImpressions", fmt: fmtMoney },
    { label: "Ads Shown", field: "adsShown", fmt: fmtInt },
    { label: "Chatters", field: "uniqueChatters", fmt: fmtInt },
    { label: "Watch", field: "watchTimeMinutes", fmt: fmtHours },
    { label: "Revenue", field: "donated", fmt: fmtMoney },
    { label: "Sub Rev", field: "subs", fmt: fmtMoney },
  ];
  return (
    <section
      className="vc-glass mb-3 overflow-hidden p-4"
      style={{ borderColor: "color-mix(in srgb, var(--vc-accent) 35%, transparent)" }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-red-400">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-red-500" /> Live
          </span>
          <h3 className="text-sm font-bold uppercase tracking-widest text-ink">Current Stream</h3>
          <span className="text-[11px] text-muted">· {elapsed(snap.elapsedMs)} elapsed · counting {pace ? "on pace" : "so far"}</span>
        </div>
        <Sparkline data={snap.totals.history} width={120} height={28} />
      </div>
      <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
        {STATS.map((s) => (
          <div key={s.label} className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">{s.label}</div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-xl font-extrabold leading-none text-ink">{s.fmt(valOf(live, s.field, plat, account))}</span>
              <DeltaBadge curr={valOf(live, s.field, plat, account)} prev={valOf(prev, s.field, plat, account)} />
            </div>
          </div>
        ))}
      </div>
    </section>
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
  const plats = useActivePlatforms();
  const totalNow = Math.max(1, plats.reduce((s, p) => s + pk(live, p).avgViewers, 0));
  return (
    <section className="vc-glass p-4">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-widest text-muted">Platform Growth</h3>
      <div className="space-y-2.5">
        {plats.map((p) => {
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

const COMPARE_ROWS: { label: string; field: KpiKey; fmt: (n: number) => string }[] = [
  { label: "Avg Viewers", field: "avgViewers", fmt: fmtViewers },
  { label: "Peak Viewers", field: "peakViewers", fmt: fmtViewers },
  { label: "Watch Time", field: "watchTimeMinutes", fmt: fmtHours },
  { label: "Unique Chatters", field: "uniqueChatters", fmt: fmtInt },
  { label: "Messages", field: "messages", fmt: fmtInt },
  { label: "Donations", field: "donated", fmt: fmtMoney },
  { label: "Sub Revenue", field: "subs", fmt: fmtMoney },
  { label: "Followers", field: "followersGained", fmt: fmtInt },
];

function ComparePanel({ all, focusId, setFocusId, plat, account }: { all: StreamSession[]; focusId: string; setFocusId: (id: string) => void; plat: Plat; account: string | null }) {
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
          const av = valOf(a, row.field, plat, account), bv = valOf(b, row.field, plat, account);
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

function StreamsTable({ all, focusId, setFocusId, plat, account }: { all: StreamSession[]; focusId: string; setFocusId: (id: string) => void; plat: Plat; account: string | null }) {
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
              <Th>Avg</Th><Th>Peak</Th><Th>Chatters</Th><Th>Watch</Th><Th>Revenue</Th><Th>Sub $</Th>
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
                  <Td className="font-semibold">{fmtViewers(fv(s, "avgViewers", plat, account))}</Td>
                  <Td>{fmtViewers(fv(s, "peakViewers", plat, account))}</Td>
                  <Td>{fmtInt(fv(s, "uniqueChatters", plat, account))}</Td>
                  <Td>{fmtHours(fv(s, "watchTimeMinutes", plat, account))}</Td>
                  <Td className="text-emerald-400">{fmtMoney(fv(s, "donated", plat, account))}</Td>
                  <Td className="text-emerald-400/90">{fmtMoney(subRev(s, plat, account))}</Td>
                  <Td>{prevS ? <DeltaBadge curr={fv(s, "avgViewers", plat, account)} prev={fv(prevS, "avgViewers", plat, account)} /> : <span className="text-muted">—</span>}</Td>
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
