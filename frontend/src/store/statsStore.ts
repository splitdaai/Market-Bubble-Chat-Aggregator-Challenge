import { create } from "zustand";
import type { ChatMessage, Platform, AggregateStats } from "@shared/types";
import { scoreMessage } from "@/lib/sentiment";

/**
 * The stats brain.
 *
 * `ingest(msg)` runs per message and only touches cheap accumulators.
 * `tick()` runs ~every 1.5s and recomputes the read-model `snapshot` the UI
 * consumes — so component re-renders are bounded to the tick rate no matter how
 * fast chat scrolls. In demo mode it also simulates viewer counts + watch time;
 * in live mode `applyBackendStats()` overrides those with real platform numbers.
 */

const PLATFORMS: Platform[] = ["twitch", "kick", "x"];
const ACTIVE_WINDOW = 5 * 60_000; // "active chatter" = chatted in last 5 min
const VELOCITY_WINDOW = 60_000; // messages/min lookback
const SENTIMENT_WINDOW = 90_000;
const VELOCITY_SAMPLES = 90; // ~3 min of sparkline at 2s
const CLIP_COOLDOWN = 14_000;

/** Demo-mode viewer baselines per platform (random-walk anchors). */
const MOCK_BASE: Record<Platform, number> = { twitch: 1240, kick: 360, x: 910 };

interface ChatterInfo {
  name: string;
  platform: Platform;
  count: number;
  last: number;
  /** Cumulative USD-equivalent donated (tips + bits + sub value). */
  donated: number;
  /** Cumulative subs contributed (own subs + gifted). */
  subs: number;
}

interface Accum {
  messages: number;
  msgTimes: number[]; // recent timestamps for velocity (trimmed each tick)
  viewers: number;
  peakViewers: number;
  watchTimeMinutes: number;
  followsGained: number;
  backed: boolean; // true once real backend numbers have arrived
}

export interface ChatterRow {
  name: string;
  platform: Platform;
  count: number;
}

/** A full chatter record for the user-list panel. */
export interface UserRow {
  name: string;
  platform: Platform;
  count: number;
  last: number;
  donated: number;
  subs: number;
}

export interface DonorRow {
  name: string;
  platform: Platform;
  amount: number;
}

export interface SubRow {
  name: string;
  platform: Platform;
  subs: number;
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
}

export interface StatsSnapshot {
  sessionStart: number;
  elapsedMs: number;
  perPlatform: Record<Platform, PlatformLive>;
  totals: PlatformLive;
  sentiment: number; // -1..1
  topChatters: ChatterRow[];
  topDonors: DonorRow[];
  topSubs: SubRow[];
  /** Total raised this session (USD-equivalent) across all platforms. */
  totalDonated: number;
  totalSubs: number;
  velocity: number[]; // combined mpm samples, oldest→newest
  clipMoments: { t: number; intensity: number }[];
  hot: boolean; // currently inside a clip-worthy spike
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
  /** Snapshot of every chatter this session (for the user-list panel). */
  listUsers: () => UserRow[];
}

/* --------------------------- internal mutable state -------------------------- */
let start = Date.now();
const accum: Record<Platform, Accum> = {
  twitch: blankAccum(),
  kick: blankAccum(),
  x: blankAccum(),
};
const chatters = new Map<string, ChatterInfo>();
let sentimentBuf: { t: number; s: number }[] = [];
let velocityHist: number[] = [];
let clipMoments: { t: number; intensity: number }[] = [];
let lastTick = start;
let lastClip = 0;
let warmed = false;

function blankAccum(): Accum {
  return {
    messages: 0,
    msgTimes: [],
    viewers: 0,
    peakViewers: 0,
    watchTimeMinutes: 0,
    followsGained: 0,
    backed: false,
  };
}

function blankLive(): PlatformLive {
  return {
    viewers: 0, peakViewers: 0, watchTimeMinutes: 0, followsGained: 0,
    uniqueChatters: 0, activeChatters: 0, messages: 0, messagesPerMin: 0,
  };
}

function emptySnapshot(): StatsSnapshot {
  return {
    sessionStart: start,
    elapsedMs: 0,
    perPlatform: { twitch: blankLive(), kick: blankLive(), x: blankLive() },
    totals: blankLive(),
    sentiment: 0,
    topChatters: [],
    topDonors: [],
    topSubs: [],
    totalDonated: 0,
    totalSubs: 0,
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
    const c = chatters.get(key) ?? { name: m.username, platform: m.platform, count: 0, last: now, donated: 0, subs: 0 };
    c.count += 1;
    c.last = now;
    if (m.event) {
      // Tips + bits + the dollar value of subs all count toward "donated".
      c.donated += m.event.amount;
      if (m.event.kind === "subscription" || m.event.kind === "gift") c.subs += m.event.count ?? 1;
    }
    chatters.set(key, c);

    sentimentBuf.push({ t: now, s: scoreMessage(m.message) });
  },

  applyBackendStats: (s) => {
    for (const p of s.perPlatform) {
      const a = accum[p.platform];
      a.viewers = p.viewers;
      a.peakViewers = Math.max(a.peakViewers, p.peakViewers, p.viewers);
      a.watchTimeMinutes = p.watchTimeMinutes;
      a.followsGained = p.followsGained ?? a.followsGained;
      a.backed = true;
    }
    set({ isMock: false });
  },

  setMock: (v) => set({ isMock: v }),

  listUsers: () => [...chatters.values()],

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
    const seedCounts: Record<Platform, number> = { twitch: 360, kick: 110, x: 250 };
    let seq = 0;

    for (const p of PLATFORMS) {
      const a = accum[p];
      const base = MOCK_BASE[p];
      a.viewers = base;
      a.peakViewers = Math.round(base * 1.35);
      a.watchTimeMinutes = base * elapsedMin * 0.96; // avg ≈ base
      a.messages = Math.round(base * 1.4);
      a.followsGained = Math.round(base * 0.05);

      // Synthetic chatters so unique-chatter + donor + sub leaderboards are
      // populated (with believable handles) from the first frame.
      for (let i = 0; i < seedCounts[p]; i++) {
        seq += 1;
        const donated = Math.random() < 0.14 ? pick([5, 10, 20, 25, 50, 100]) : 0;
        const subs = Math.random() < 0.18 ? pick([1, 1, 1, 3, 5]) : 0;
        const name = `${p === "x" ? "@" : ""}${pick(HANDLES)}${10 + Math.floor(Math.random() * 89)}`;
        chatters.set(`${p}:seed-${seq}`, {
          name,
          platform: p,
          // Skewed so most viewers chat a little and a few are very active.
          count: 1 + Math.floor(Math.random() * Math.random() * 18),
          last: Date.now() - Math.random() * 240_000,
          donated,
          subs,
        });
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
      twitch: blankLive(), kick: blankLive(), x: blankLive(),
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
        const base = MOCK_BASE[p];
        if (a.viewers === 0) a.viewers = base;
        // drift: gentle random walk + pull toward base, biased up by chat heat
        const heat = Math.min(1.5, mpm / 25);
        const drift = (Math.random() - 0.48) * base * 0.012 + (base - a.viewers) * 0.04 + heat * base * 0.006;
        a.viewers = Math.max(Math.round(base * 0.25), Math.round(a.viewers + drift));
        a.peakViewers = Math.max(a.peakViewers, a.viewers);
        // occasional follow bump
        if (Math.random() < 0.12) a.followsGained += Math.floor(Math.random() * 3);
      }

      // accrue watch time (viewer-minutes) regardless of source
      a.watchTimeMinutes += (a.viewers * dt) / 60_000;

      // chatter counts for this platform
      let unique = 0;
      let active = 0;
      for (const c of chatters.values()) {
        if (c.platform !== p) continue;
        unique += 1;
        if (now - c.last < ACTIVE_WINDOW) active += 1;
      }

      perPlatform[p] = {
        viewers: a.viewers,
        peakViewers: a.peakViewers,
        watchTimeMinutes: a.watchTimeMinutes,
        followsGained: a.followsGained,
        uniqueChatters: unique,
        activeChatters: active,
        messages: a.messages,
        messagesPerMin: mpm,
      };
    }

    // ---- velocity history + clip detection ----
    velocityHist.push(combinedMpm);
    if (velocityHist.length > VELOCITY_SAMPLES) velocityHist = velocityHist.slice(-VELOCITY_SAMPLES);
    const baseline =
      velocityHist.length > 4
        ? velocityHist.slice(0, -1).reduce((s, v) => s + v, 0) / (velocityHist.length - 1)
        : combinedMpm;
    const ratio = baseline > 0 ? combinedMpm / baseline : 1;
    const hot = combinedMpm >= 35 && ratio >= 1.7;
    if (hot && now - lastClip > CLIP_COOLDOWN) {
      lastClip = now;
      clipMoments = [{ t: now, intensity: ratio }, ...clipMoments].slice(0, 6);
    }

    // ---- sentiment ----
    sentimentBuf = sentimentBuf.filter((x) => now - x.t < SENTIMENT_WINDOW);
    const sentiment = sentimentBuf.length
      ? Math.max(-1, Math.min(1, sentimentBuf.reduce((s, x) => s + x.s, 0) / sentimentBuf.length / 1.5))
      : 0;

    // ---- leaderboards: chatters / donors / subs ----
    const all = [...chatters.values()];
    const topChatters = all
      .sort((x, y) => y.count - x.count)
      .slice(0, 8)
      .map((c) => ({ name: c.name, platform: c.platform, count: c.count }));
    const topDonors = all
      .filter((c) => c.donated > 0)
      .sort((x, y) => y.donated - x.donated)
      .slice(0, 8)
      .map((c) => ({ name: c.name, platform: c.platform, amount: c.donated }));
    const topSubs = all
      .filter((c) => c.subs > 0)
      .sort((x, y) => y.subs - x.subs)
      .slice(0, 8)
      .map((c) => ({ name: c.name, platform: c.platform, subs: c.subs }));
    const totalDonated = all.reduce((s, c) => s + c.donated, 0);
    const totalSubs = all.reduce((s, c) => s + c.subs, 0);

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
      return acc;
    }, blankLive());

    set({
      snapshot: {
        sessionStart: start,
        elapsedMs: now - start,
        perPlatform,
        totals,
        sentiment,
        topChatters,
        topDonors,
        topSubs,
        totalDonated,
        totalSubs,
        velocity: [...velocityHist],
        clipMoments: [...clipMoments],
        hot,
      },
    });
  },
}));
