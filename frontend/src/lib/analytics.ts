import type { StreamSession, PlatformKPIs, AccountKPIs, Platform, KpiKey } from "@shared/types";
import type { StatsSnapshot } from "@/store/statsStore";
import { useConnectionsStore } from "@/store/connectionsStore";
import { compact } from "./format";

const PLATFORMS: Platform[] = ["twitch", "kick", "x", "youtube"];

/** Typical full broadcast length (min), used to project "on pace" totals. */
const TARGET_MIN = 140;

/**
 * Build a synthetic "live" StreamSession from the in-progress stats snapshot.
 *
 * Rate metrics (avg/peak viewers) are always full-stream-representative. When
 * `projected` is true, CUMULATIVE metrics (watch time, chatters, messages,
 * donations, subs, followers) are scaled to an "on pace to finish at" estimate
 * so they compare fairly against completed streams; otherwise they're the raw
 * "so far" totals.
 */
export function buildLiveSession(snap: StatsSnapshot, projected = true): StreamSession {
  const elapsedMin = Math.max(1, snap.elapsedMs / 60000);
  const avg = (watchMin: number) => Math.round(watchMin / elapsedMin);
  // Projection factor, capped so the first few minutes don't explode.
  const f = projected ? Math.min(15, Math.max(1, TARGET_MIN / elapsedMin)) : 1;

  const totalV = Math.max(1, PLATFORMS.reduce((s, p) => s + snap.perPlatform[p].viewers, 0));
  const perPlatform: PlatformKPIs[] = PLATFORMS.map((p) => {
    const v = snap.perPlatform[p];
    const share = v.viewers / totalV;
    return {
      platform: p,
      avgViewers: avg(v.watchTimeMinutes),
      peakViewers: v.peakViewers,
      uniqueChatters: Math.round(v.uniqueChatters * f),
      messages: Math.round(v.messages * f),
      watchTimeMinutes: Math.round(v.watchTimeMinutes * f),
      donated: Math.round(snap.totalDonated * share * f),
      subs: Math.round(v.subs * f), // real per-platform sub count from the live dashboard
      followersGained: Math.round(v.followsGained * f),
    };
  });

  // Per-account breakdown: cumulative metrics from the per-account accumulators,
  // viewers/watch-time split from the platform total by each account's msg share.
  const accountsList = useConnectionsStore.getState().accounts;
  const platMsgTotal: Record<string, number> = {};
  for (const a of snap.accounts) platMsgTotal[a.platform] = (platMsgTotal[a.platform] ?? 0) + a.messages;
  const perAccount: AccountKPIs[] = snap.accounts.map((a) => {
    const meta = accountsList.find((x) => x.id === a.accountId);
    const pp = perPlatform.find((x) => x.platform === a.platform)!;
    const share = (platMsgTotal[a.platform] || 0) > 0 ? a.messages / platMsgTotal[a.platform] : 0;
    return {
      accountId: a.accountId,
      displayName: meta?.displayName ?? a.accountId,
      platform: a.platform,
      avgViewers: Math.round(pp.avgViewers * share),
      peakViewers: Math.round(pp.peakViewers * share),
      uniqueChatters: Math.round(a.uniqueChatters * f),
      messages: Math.round(a.messages * f),
      watchTimeMinutes: Math.round(pp.watchTimeMinutes * share),
      donated: Math.round(a.donated * f),
      subs: Math.round(a.subs * f),
      followersGained: Math.round(pp.followersGained * share),
    };
  });

  return {
    id: "live",
    title: "Current Stream",
    startedAt: snap.sessionStart,
    durationMinutes: Math.round(projected ? TARGET_MIN : elapsedMin),
    live: true,
    avgViewers: avg(snap.totals.watchTimeMinutes),
    peakViewers: snap.totals.peakViewers,
    uniqueChatters: Math.round(snap.totals.uniqueChatters * f),
    messages: Math.round(snap.totals.messages * f),
    watchTimeMinutes: Math.round(snap.totals.watchTimeMinutes * f),
    donated: Math.round(snap.totalDonated * f),
    subs: Math.round(snap.totalSubs * f),
    followersGained: Math.round(PLATFORMS.reduce((s, p) => s + snap.perPlatform[p].followsGained, 0) * f),
    clipMoments: snap.clipMoments.length,
    perPlatform,
    perAccount,
  };
}

/** Percent change curr vs prev. Returns null when prev is 0 (no baseline). */
export function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return curr === 0 ? 0 : null;
  return ((curr - prev) / prev) * 100;
}

/* ----------------------------------- format ---------------------------------- */

export const fmtViewers = (n: number) => compact(Math.round(n));
export const fmtMoney = (n: number) => `$${compact(Math.round(n))}`;
export const fmtHours = (minutes: number) => `${compact(Math.round(minutes / 60))}h`;
export const fmtInt = (n: number) => compact(Math.round(n));

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Metric selector definitions for the trend chart — the chart reads values via
 *  `valOf(session, key)` in AnalyticsTab, so only key/label/fmt are needed. */
export interface MetricDef {
  key: KpiKey;
  label: string;
  fmt: (n: number) => string;
}

export const METRICS: MetricDef[] = [
  { key: "avgViewers", label: "Avg Viewers", fmt: fmtViewers },
  { key: "peakViewers", label: "Peak Viewers", fmt: fmtViewers },
  { key: "watchTimeMinutes", label: "Watch Hours", fmt: fmtHours },
  { key: "uniqueChatters", label: "Chatters", fmt: fmtInt },
  { key: "messages", label: "Messages", fmt: fmtInt },
  { key: "donated", label: "Donations", fmt: fmtMoney },
  { key: "subs", label: "Sub Revenue", fmt: fmtMoney },
  { key: "followersGained", label: "Followers", fmt: fmtInt },
];
