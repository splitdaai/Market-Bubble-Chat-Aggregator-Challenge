import { create } from "zustand";
import type { ChatMessage, Platform, AggregateStats } from "@shared/types";
import { scoreMessage } from "@/lib/sentiment";
import { useConnectionsStore, connectedAccounts } from "@/store/connectionsStore";
import { accountShare } from "@/lib/accounts";
import { subRevenue } from "@/lib/revenue";
import { useBucksLedger } from "@/store/bucksLedgerStore";

/**
 * The stats brain.
 *
 * `ingest(msg)` runs per message and only touches cheap accumulators.
 * `tick()` runs ~every 1.5s and recomputes the read-model `snapshot` the UI
 * consumes — so component re-renders are bounded to the tick rate no matter how
 * fast chat scrolls. In demo mode it also simulates viewer counts + watch time;
 * in live mode `applyBackendStats()` overrides those with real platform numbers.
 */

const PLATFORMS: Platform[] = ["twitch", "kick", "x", "youtube"];
const ACTIVE_WINDOW = 5 * 60_000; // "active chatter" = chatted in last 5 min
const VELOCITY_WINDOW = 60_000; // messages/min lookback
const SENTIMENT_WINDOW = 90_000;
const VELOCITY_SAMPLES = 90; // ~3 min of sparkline at 2s
const CLIP_COOLDOWN = 14_000;

/** Demo-mode viewer baseline PER ACCOUNT (scaled by # of connected channels). */
const MOCK_BASE: Record<Platform, number> = { twitch: 520, kick: 240, x: 640, youtube: 380 };

/** Connected channels on a platform (0 = inactive) so viewers scale with multi-account. */
function accountCount(p: Platform): number {
  return connectedAccounts(useConnectionsStore.getState().accounts).filter((a) => a.platform === p).length;
}

interface ChatterInfo {
  name: string;
  platform: Platform;
  count: number;
  /** First time we saw this viewer — start of their watch session. */
  first: number;
  last: number;
  /** Cumulative USD-equivalent donated (tips + bits + sub value). */
  donated: number;
  /** Cumulative subs contributed (own subs + gifted). */
  subs: number;
  /** Source channel this viewer is watching (Ansem / Banks / Market Bubble). */
  channel?: string;
}

interface Accum {
  messages: number;
  msgTimes: number[]; // recent timestamps for velocity (trimmed each tick)
  viewers: number;
  peakViewers: number;
  watchTimeMinutes: number;
  followsGained: number;
  adsShown: number;
  adImpressions: number;
  /** Demo only: when the next simulated ad break fires. */
  nextAdAt: number;
  backed: boolean; // true once real backend numbers have arrived
}

export interface ChatterRow {
  name: string;
  platform: Platform;
  count: number;
  channel?: string;
}

/** A full chatter record for the user-list panel. */
export interface UserRow {
  name: string;
  platform: Platform;
  count: number;
  /** First seen — start of the viewer's watch session (Bubble Bits accrual). */
  first: number;
  last: number;
  donated: number;
  subs: number;
  /** Lifetime Bubble Bits spent on engagement actions / perks. */
  spent: number;
  channel?: string;
}


export interface SubRow {
  name: string;
  platform: Platform;
  subs: number;
  channel?: string;
}

/** Raw per-account accumulators surfaced for the analytics account filter. */
export interface AccountStat {
  accountId: string;
  displayName: string;
  platform: Platform;
  viewers: number;
  watchTimeMinutes: number;
  messages: number;
  uniqueChatters: number;
  donated: number;
  subs: number;
  /** Rolling viewer samples for the per-channel sparkline (oldest→newest). */
  history: number[];
}

export interface PlatformLive {
  viewers: number;
  peakViewers: number;
  watchTimeMinutes: number;
  followsGained: number;
  uniqueChatters: number;
  activeChatters: number;
  messages: number;
  messagesPerMin: number;
  /** Subs contributed on this platform this session (count). */
  subs: number;
  /** Ad breaks run this session. */
  adsShown: number;
  /** Σ viewers at each ad break — basis for estimated ad revenue. */
  adImpressions: number;
  /** Rolling viewer samples for the per-platform sparkline (oldest→newest). */
  history: number[];
}

export interface StatsSnapshot {
  sessionStart: number;
  elapsedMs: number;
  perPlatform: Record<Platform, PlatformLive>;
  totals: PlatformLive;
  sentiment: number; // -1..1
  topChatters: ChatterRow[];
  topSubs: SubRow[];
  /** Total revenue this session (USD-equivalent) across all platforms. */
  totalDonated: number;
  totalSubs: number;
  /** Dollar value of subs this session, summed with each platform's payout rate. */
  totalSubRevenue: number;
  /** Per-account raw stats (for the analytics account filter). */
  accounts: AccountStat[];
  velocity: number[]; // combined mpm samples, oldest→newest
  clipMoments: ClipMoment[];
  hot: boolean; // currently inside a clip-worthy spike
}

/** A detected clip-worthy moment with the signals + verdict that surfaced it. */
export type ClipKind = "HYPE" | "ROAST" | "DROP" | "DONO-RAIN" | "TICKER" | "SPIKE";
export type ClipVerdict = "auto-clip" | "alert" | "watch";
export interface ClipMoment {
  t: number;
  /** Chat-velocity multiple over baseline (legacy). */
  intensity: number;
  /** 0–100 — how confident the detector is that this is worth a clip. */
  score: number;
  kind: ClipKind;
  verdict: ClipVerdict;
  /** Short, human-readable reason ("3.2× chat · $250 dono rain"). */
  why: string;
}

interface StatsState {
  sessionStart: number;
  isMock: boolean;
  snapshot: StatsSnapshot;

  ingest: (m: ChatMessage) => void;
  applyBackendStats: (s: AggregateStats) => void;
  tick: () => void;
  setMock: (v: boolean) => void;
  /** Demo only: pretend the stream has already been running for a while. */
  warmStart: () => void;
  /** Wipe all accumulators (used when toggling demo/live). */
  reset: () => void;
  /** Snapshot of every chatter this session (for the user-list panel). */
  listUsers: () => UserRow[];
}

/* --------------------------- internal mutable state -------------------------- */
let start = Date.now();
const accum: Record<Platform, Accum> = {
  twitch: blankAccum(),
  kick: blankAccum(),
  x: blankAccum(),
  youtube: blankAccum(),
};
const chatters = new Map<string, ChatterInfo>();
/** Per-account accumulators (accountId → stats) for the analytics filter. */
const byAccount = new Map<string, { platform: Platform; messages: number; chatters: Set<string>; donated: number; subs: number }>();
let sentimentBuf: { t: number; s: number }[] = [];
let velocityHist: number[] = [];
let clipMoments: ClipMoment[] = [];
// rolling event/$ counters for the smart auto-clip detector
let recentEvents: { t: number; kind: "sub" | "tip"; amount: number }[] = [];
let recentSentiment: { t: number; s: number }[] = [];
let recentTickers: { t: number }[] = [];
let lastTick = start;
let lastClip = 0;
let warmed = false;

/** Rolling viewer samples that drive the per-platform + per-channel sparklines. */
const SPARK_SAMPLES = 32;
let viewersHist: Record<Platform, number[]> = { twitch: [], kick: [], x: [], youtube: [] };
const accountHist = new Map<string, number[]>();

function blankAccum(): Accum {
  return {
    messages: 0,
    msgTimes: [],
    viewers: 0,
    peakViewers: 0,
    watchTimeMinutes: 0,
    followsGained: 0,
    adsShown: 0,
    adImpressions: 0,
    nextAdAt: 0,
    backed: false,
  };
}

function blankLive(): PlatformLive {
  return {
    viewers: 0, peakViewers: 0, watchTimeMinutes: 0, followsGained: 0,
    uniqueChatters: 0, activeChatters: 0, messages: 0, messagesPerMin: 0, subs: 0, adsShown: 0, adImpressions: 0, history: [],
  };
}

function emptySnapshot(): StatsSnapshot {
  return {
    sessionStart: start,
    elapsedMs: 0,
    perPlatform: { twitch: blankLive(), kick: blankLive(), x: blankLive(), youtube: blankLive() },
    totals: blankLive(),
    sentiment: 0,
    topChatters: [],
    topSubs: [],
    totalDonated: 0,
    totalSubs: 0,
    totalSubRevenue: 0,
    accounts: [],
    velocity: [],
    clipMoments: [],
    hot: false,
  };
}

export const useStatsStore = create<StatsState>((set, get) => ({
  sessionStart: start,
  isMock: true,
  snapshot: emptySnapshot(),

  ingest: (m) => {
    const now = m.timestamp || Date.now();
    const a = accum[m.platform];
    a.messages += 1;
    a.msgTimes.push(now);

    const key = `${m.platform}:${m.username.toLowerCase()}`;
    const c = chatters.get(key) ?? { name: m.username, platform: m.platform, count: 0, first: now, last: now, donated: 0, subs: 0 };
    c.count += 1;
    c.last = now;
    if (m.channel) c.channel = m.channel;
    if (m.event) {
      // Tips + bits + the dollar value of subs all count toward "donated".
      c.donated += m.event.amount;
      if (m.event.kind === "subscription" || m.event.kind === "gift") c.subs += m.event.count ?? 1;
      // Feed the smart auto-clip detector — recent dono/sub bursts are a
      // primary signal (DONO-RAIN).
      const kind: "sub" | "tip" = m.event.kind === "subscription" || m.event.kind === "gift" ? "sub" : "tip";
      recentEvents.push({ t: now, kind, amount: m.event.amount });
    }
    // Sentiment + ticker signal feed
    recentSentiment.push({ t: now, s: scoreMessage(m.message) });
    if (/\$[A-Z]{2,6}\b/.test(m.message)) recentTickers.push({ t: now });
    chatters.set(key, c);

    // per-account accumulation for the analytics filter
    if (m.accountId) {
      const acc = byAccount.get(m.accountId) ?? { platform: m.platform, messages: 0, chatters: new Set<string>(), donated: 0, subs: 0 };
      acc.messages += 1;
      acc.chatters.add(m.username.toLowerCase());
      if (m.event) {
        acc.donated += m.event.amount;
        if (m.event.kind === "subscription" || m.event.kind === "gift") acc.subs += m.event.count ?? 1;
      }
      byAccount.set(m.accountId, acc);
    }

    sentimentBuf.push({ t: now, s: scoreMessage(m.message) });
  },

  applyBackendStats: (s) => {
    for (const p of s.perPlatform) {
      const a = accum[p.platform];
      a.viewers = p.viewers;
      a.peakViewers = Math.max(a.peakViewers, p.peakViewers, p.viewers);
      a.watchTimeMinutes = p.watchTimeMinutes;
      a.followsGained = p.followsGained ?? a.followsGained;
      a.adsShown = p.adsShown ?? a.adsShown;
      a.adImpressions = p.adImpressions ?? a.adImpressions;
      a.backed = true;
    }
    set({ isMock: false });
  },

  setMock: (v) => set({ isMock: v }),

  reset: () => {
    start = Date.now();
    lastTick = start;
    warmed = false;
    lastClip = 0;
    chatters.clear();
    byAccount.clear();
    sentimentBuf = [];
    velocityHist = [];
    clipMoments = [];
    viewersHist = { twitch: [], kick: [], x: [], youtube: [] };
    accountHist.clear();
    for (const p of PLATFORMS) accum[p] = blankAccum();
    set({ snapshot: emptySnapshot() });
  },

  // listUsers merges the persisted Bubble Bits ledger into the current
  // session so each user's `first`, `count`, `donated`, `subs`, and `spent`
  // reflect their lifetime totals (not just what's happened since page load).
  listUsers: () => {
    const ledger = useBucksLedger.getState().entries;
    return [...chatters.values()].map((c) => {
      const key = `${c.platform}:${c.name.toLowerCase()}`;
      const l = ledger[key];
      // ChatterInfo lacks `spent` — it's a ledger-only field. Default to 0
      // and let the ledger override.
      const base: UserRow = { ...c, spent: 0 };
      if (!l) return base;
      return {
        ...base,
        first: Math.min(c.first, l.first),
        last: Math.max(c.last, l.last),
        count: Math.max(c.count, l.count),
        donated: Math.max(c.donated, l.donated),
        subs: Math.max(c.subs, l.subs),
        spent: l.spent ?? 0,
      };
    });
  },

  warmStart: () => {
    if (warmed) return;
    warmed = true;
    const elapsedMin = 78; // pretend we're ~1h18m into the broadcast
    start = Date.now() - elapsedMin * 60_000;
    lastTick = Date.now();

    const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
    const HANDLES = [
      "toxicAvenger", "greenScreenGuy", "kickflipKing", "ninjacat", "streamSniperz",
      "PogChampion", "xX_dogelord_Xx", "cryptochad", "vibesonly", "degenharry",
      "marketmaven", "bagholder", "moonboi", "paperhands", "diamondhands", "rektrider",
    ];
    const seedCounts: Record<Platform, number> = { twitch: 300, kick: 110, x: 250, youtube: 240 };
    const accountsList = connectedAccounts(useConnectionsStore.getState().accounts);
    let seq = 0;

    for (const p of PLATFORMS) {
      if (accountCount(p) === 0) continue; // inactive platform — no channels connected
      const a = accum[p];
      const base = MOCK_BASE[p] * accountCount(p); // aggregate across this platform's channels
      a.viewers = base;
      a.peakViewers = Math.round(base * 1.35);
      a.watchTimeMinutes = base * elapsedMin * 0.96; // avg ≈ base
      a.messages = Math.round(base * 1.4);
      a.followsGained = Math.round(base * 0.05);
      // Mid-broadcast ad history: ~1 break / 22 min, impressions ≈ viewers each.
      if (p !== "kick") {
        a.adsShown = Math.max(2, Math.round(elapsedMin / 22));
        a.adImpressions = Math.round(a.adsShown * base * 0.95);
        a.nextAdAt = Date.now() + (4 + Math.random() * 6) * 60_000;
      }

      // Seed a believable upward-drifting sparkline so trends read from frame one.
      viewersHist[p] = Array.from({ length: SPARK_SAMPLES }, (_, i) => {
        const t = i / (SPARK_SAMPLES - 1);
        return Math.round(base * (0.78 + 0.22 * t) + (Math.random() - 0.5) * base * 0.05);
      });

      const platAccounts = accountsList.filter((acc) => acc.platform === p);

      // Synthetic chatters so unique-chatter + donor + sub leaderboards (and the
      // per-account analytics) are populated from the first frame.
      for (let i = 0; i < seedCounts[p]; i++) {
        seq += 1;
        const donated = Math.random() < 0.14 ? pick([5, 10, 20, 25, 50, 100]) : 0;
        const subs = Math.random() < 0.18 ? pick([1, 1, 1, 3, 5]) : 0;
        const count = 1 + Math.floor(Math.random() * Math.random() * 18);
        const isX = p === "x" || p === "youtube";
        const name = `${isX ? "@" : ""}${pick(HANDLES)}${10 + Math.floor(Math.random() * 89)}`;
        // attribute the seeded chatter to one of this platform's channels
        const acc = platAccounts.length ? pick(platAccounts) : null;
        // joined at a random point in the session so watch-time bucks look real
        chatters.set(`${p}:seed-${seq}`, { name, platform: p, count, first: Date.now() - (3 + Math.random() * (elapsedMin - 3)) * 60_000, last: Date.now() - Math.random() * 240_000, donated, subs, channel: acc?.displayName });
        // Seed a believable Bubble Bits spend for some chatters — anchors the
        // analytics "Top Spenders" leaderboard without needing live spending.
        // Heavy chatters/supporters spend more, but never more than they've earned.
        if (Math.random() < 0.22) {
          const earned = count + subs * 100 + donated * 5; // mirrors bucksFor() w/o watch-time
          const spend = Math.floor(earned * (0.05 + Math.random() * 0.55));
          if (spend > 0) useBucksLedger.getState().upsert(p, name, { spent: spend });
        }

        if (acc) {
          const bucket = byAccount.get(acc.id) ?? { platform: p, messages: 0, chatters: new Set<string>(), donated: 0, subs: 0 };
          bucket.messages += count;
          bucket.chatters.add(`${name}-${seq}`);
          bucket.donated += donated;
          bucket.subs += subs;
          byAccount.set(acc.id, bucket);
        }
      }
    }
  },

  tick: () => {
    const now = Date.now();
    const dt = now - lastTick;
    lastTick = now;
    const isMock = get().isMock;

    // ---- per-platform recompute ----
    const perPlatform: Record<Platform, PlatformLive> = {
      twitch: blankLive(), kick: blankLive(), x: blankLive(), youtube: blankLive(),
    };
    let combinedMpm = 0;

    for (const p of PLATFORMS) {
      const a = accum[p];
      // trim + count velocity window
      a.msgTimes = a.msgTimes.filter((t) => now - t < VELOCITY_WINDOW);
      const mpm = a.msgTimes.length; // window is exactly 60s
      combinedMpm += mpm;

      // viewer simulation (demo mode only; backend overrides otherwise)
      if (isMock || !a.backed) {
        const base = MOCK_BASE[p] * accountCount(p);
        if (a.viewers === 0) a.viewers = base;
        // drift: gentle random walk + pull toward base, biased up by chat heat
        const heat = Math.min(1.5, mpm / 25);
        const drift = (Math.random() - 0.48) * base * 0.012 + (base - a.viewers) * 0.04 + heat * base * 0.006;
        a.viewers = Math.max(Math.round(base * 0.25), Math.round(a.viewers + drift));
        a.peakViewers = Math.max(a.peakViewers, a.viewers);
        // occasional follow bump
        if (Math.random() < 0.12) a.followsGained += Math.floor(Math.random() * 3);
        // ad breaks every ~6–10 min per platform (none on Kick — no ad program);
        // each break books the current live viewers as impressions.
        if (p !== "kick") {
          if (!a.nextAdAt) a.nextAdAt = now + (2 + Math.random() * 5) * 60_000; // first break 2–7 min in
          if (now >= a.nextAdAt) {
            a.adsShown += 1;
            a.adImpressions += a.viewers;
            a.nextAdAt = now + (6 + Math.random() * 4) * 60_000;
          }
        }
      }

      // accrue watch time (viewer-minutes) regardless of source
      a.watchTimeMinutes += (a.viewers * dt) / 60_000;

      // chatter counts for this platform
      let unique = 0;
      let active = 0;
      let subsCount = 0;
      for (const c of chatters.values()) {
        if (c.platform !== p) continue;
        unique += 1;
        subsCount += c.subs;
        if (now - c.last < ACTIVE_WINDOW) active += 1;
      }

      // roll the per-platform viewer sparkline
      const ph = viewersHist[p];
      ph.push(a.viewers);
      if (ph.length > SPARK_SAMPLES) viewersHist[p] = ph.slice(-SPARK_SAMPLES);

      perPlatform[p] = {
        viewers: a.viewers,
        peakViewers: a.peakViewers,
        watchTimeMinutes: a.watchTimeMinutes,
        followsGained: a.followsGained,
        uniqueChatters: unique,
        activeChatters: active,
        messages: a.messages,
        messagesPerMin: mpm,
        subs: subsCount,
        adsShown: a.adsShown,
        adImpressions: a.adImpressions,
        history: [...viewersHist[p]],
      };
    }

    // ---- velocity history + smart clip detection ----
    velocityHist.push(combinedMpm);
    if (velocityHist.length > VELOCITY_SAMPLES) velocityHist = velocityHist.slice(-VELOCITY_SAMPLES);
    const baseline =
      velocityHist.length > 4
        ? velocityHist.slice(0, -1).reduce((s, v) => s + v, 0) / (velocityHist.length - 1)
        : combinedMpm;
    const ratio = baseline > 0 ? combinedMpm / baseline : 1;

    // Trim 30-second rolling windows for the auxiliary signals
    const WIN = 30_000;
    recentEvents = recentEvents.filter((e) => now - e.t < WIN);
    recentSentiment = recentSentiment.filter((e) => now - e.t < WIN);
    recentTickers = recentTickers.filter((e) => now - e.t < WIN);
    const donoSum = recentEvents.filter((e) => e.kind === "tip").reduce((s, e) => s + e.amount, 0);
    const subBurst = recentEvents.filter((e) => e.kind === "sub").length;
    const avgSent = recentSentiment.length ? recentSentiment.reduce((s, e) => s + e.s, 0) / recentSentiment.length : 0;
    const tickerHits = recentTickers.length;

    // Score each signal 0–25 then sum to 0–100. Picks the dominant lens to
    // classify the moment (hype / roast / dono-rain / ticker / drop).
    const velScore = Math.max(0, Math.min(25, (ratio - 1.2) * 35));
    const sentScore = Math.max(0, Math.min(25, Math.abs(avgSent) * 35));
    const donoScore = Math.max(0, Math.min(25, donoSum / 4 + subBurst * 4));
    const tickerScore = Math.max(0, Math.min(15, tickerHits * 1.4));
    const dropScore = combinedMpm > 0 && ratio < 0.45 && velocityHist.length > 8 ? 18 : 0;
    const score = Math.round(velScore + sentScore + donoScore + tickerScore + dropScore);
    const hot = score >= 40;
    let kind: ClipKind = "SPIKE";
    if (donoScore >= 15) kind = "DONO-RAIN";
    else if (dropScore > 0) kind = "DROP";
    else if (sentScore >= 15 && avgSent < -0.15) kind = "ROAST";
    else if (sentScore >= 15 && avgSent > 0.15) kind = "HYPE";
    else if (tickerScore >= 10) kind = "TICKER";
    const verdict: ClipVerdict = score >= 70 ? "auto-clip" : score >= 50 ? "alert" : "watch";
    const why = [
      ratio >= 1.4 ? `${ratio.toFixed(1)}× chat` : null,
      donoSum >= 25 ? `$${Math.round(donoSum)} tips` : null,
      subBurst >= 3 ? `${subBurst} subs` : null,
      Math.abs(avgSent) >= 0.2 ? `${avgSent > 0 ? "+" : ""}${avgSent.toFixed(2)} mood` : null,
      tickerHits >= 6 ? `${tickerHits} tickers` : null,
      dropScore > 0 ? "chat went silent" : null,
    ].filter(Boolean).join(" · ") || "rising signal";

    if (hot && now - lastClip > CLIP_COOLDOWN) {
      lastClip = now;
      clipMoments = [{ t: now, intensity: ratio, score, kind, verdict, why }, ...clipMoments].slice(0, 8);
    }

    // ---- sentiment ----
    sentimentBuf = sentimentBuf.filter((x) => now - x.t < SENTIMENT_WINDOW);
    const sentiment = sentimentBuf.length
      ? Math.max(-1, Math.min(1, sentimentBuf.reduce((s, x) => s + x.s, 0) / sentimentBuf.length / 1.5))
      : 0;

    // ---- persist watch-time + messages so balances survive reloads ----
    // The ledger holds lifetime totals keyed by platform:username; every tick
    // we upsert each known chatter so refreshing the page never zeroes a
    // viewer's Bubble Bits. When the backend lands this is the swap point.
    const ledger = useBucksLedger.getState();
    for (const c of chatters.values()) {
      ledger.upsert(c.platform, c.name, {
        first: c.first,
        last: c.last,
        count: c.count,
        donated: c.donated,
        subs: c.subs,
      });
    }

    // ---- leaderboards: chatters / donors / subs ----
    const all = [...chatters.values()];
    const topChatters = all
      .sort((x, y) => y.count - x.count)
      .slice(0, 25)
      .map((c) => ({ name: c.name, platform: c.platform, count: c.count, channel: c.channel }));
    const topSubs = all
      .filter((c) => c.subs > 0)
      .sort((x, y) => y.subs - x.subs)
      .slice(0, 25)
      .map((c) => ({ name: c.name, platform: c.platform, subs: c.subs, channel: c.channel }));
    const totalDonated = all.reduce((s, c) => s + c.donated, 0);
    const totalSubs = all.reduce((s, c) => s + c.subs, 0);
    const totalSubRevenue = all.reduce((s, c) => s + subRevenue(c.platform, c.subs), 0);

    // ---- per-account stats (analytics filter + per-channel breakdowns) ----
    // Built from every connected account so each channel shows even at 0 msgs;
    // viewers/watch-time are the platform total split by the account's weight.
    const conns = connectedAccounts(useConnectionsStore.getState().accounts);
    const accounts: AccountStat[] = conns.map((acc) => {
      const b = byAccount.get(acc.id);
      const pv = perPlatform[acc.platform];
      const share = accountShare(acc, conns);
      const viewers = Math.round(pv.viewers * share);
      // roll this channel's viewer sparkline
      const ah = accountHist.get(acc.id) ?? [];
      ah.push(viewers);
      if (ah.length > SPARK_SAMPLES) ah.splice(0, ah.length - SPARK_SAMPLES);
      accountHist.set(acc.id, ah);
      return {
        accountId: acc.id,
        displayName: acc.displayName,
        platform: acc.platform,
        viewers,
        watchTimeMinutes: Math.round(pv.watchTimeMinutes * share),
        messages: b?.messages ?? 0,
        uniqueChatters: b?.chatters.size ?? 0,
        donated: b?.donated ?? 0,
        subs: b?.subs ?? 0,
        history: [...ah],
      };
    });

    // ---- totals ----
    const totals = PLATFORMS.reduce((acc, p) => {
      const v = perPlatform[p];
      acc.viewers += v.viewers;
      acc.peakViewers += v.peakViewers;
      acc.watchTimeMinutes += v.watchTimeMinutes;
      acc.followsGained += v.followsGained;
      acc.uniqueChatters += v.uniqueChatters;
      acc.activeChatters += v.activeChatters;
      acc.messages += v.messages;
      acc.messagesPerMin += v.messagesPerMin;
      acc.subs += v.subs;
      acc.adsShown += v.adsShown;
      acc.adImpressions += v.adImpressions;
      return acc;
    }, blankLive());

    // combined viewer sparkline = sum of the aligned per-platform histories
    const histLen = Math.max(0, ...PLATFORMS.map((p) => viewersHist[p].length));
    totals.history = Array.from({ length: histLen }, (_, i) =>
      PLATFORMS.reduce((s, p) => {
        const h = viewersHist[p];
        const v = h[h.length - histLen + i];
        return s + (typeof v === "number" ? v : 0);
      }, 0),
    );

    set({
      snapshot: {
        sessionStart: start,
        elapsedMs: now - start,
        perPlatform,
        totals,
        sentiment,
        topChatters,
        topSubs,
        totalDonated,
        totalSubs,
        totalSubRevenue,
        accounts,
        velocity: [...velocityHist],
        clipMoments: [...clipMoments],
        hot,
      },
    });
  },
}));
