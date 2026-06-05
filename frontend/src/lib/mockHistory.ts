import type { StreamSession, PlatformKPIs, Platform } from "@shared/types";

/**
 * Seed analytics with believable past streams — weekly ("Live every Thursday")
 * broadcasts trending up over a quarter, with realistic week-to-week noise
 * (including the occasional down week) so growth/loss comparisons are meaningful.
 * The backend (Codex) replaces this with real persisted sessions.
 */

const PLATFORMS: Platform[] = ["twitch", "kick", "x"];

const TITLES = [
  "Fed Decision Live",
  "Earnings Szn Kickoff",
  "Election Odds Special",
  "CPI Day Watchalong",
  "Crypto Bubble Check",
  "Polymarket Power Hour",
  "Jobs Report Live",
  "Rate Cut Roulette",
  "Memecoin Mania Night",
  "Q3 Outlook AMA",
  "Black Swan Drill",
  "All-Time-High Party",
  "Macro Monday… on Thursday",
  "Options Expiry Chaos",
];

const WEEK_MS = 7 * 24 * 3600 * 1000;

function jitter(spread = 0.18): number {
  return 1 - spread + Math.random() * spread * 2;
}

function buildPerPlatform(
  totals: { avgViewers: number; peakViewers: number; uniqueChatters: number; messages: number; watchTimeMinutes: number; donated: number; subs: number; followersGained: number },
  shares: Record<Platform, number>,
): PlatformKPIs[] {
  return PLATFORMS.map((p) => {
    const s = shares[p];
    return {
      platform: p,
      avgViewers: Math.round(totals.avgViewers * s),
      peakViewers: Math.round(totals.peakViewers * s),
      uniqueChatters: Math.round(totals.uniqueChatters * s),
      messages: Math.round(totals.messages * s),
      watchTimeMinutes: Math.round(totals.watchTimeMinutes * s),
      donated: Math.round(totals.donated * s),
      subs: Math.round(totals.subs * s),
      followersGained: Math.round(totals.followersGained * s),
    };
  });
}

export function generateHistory(count = 12): StreamSession[] {
  const now = Date.now();
  const sessions: StreamSession[] = [];

  for (let i = 0; i < count; i++) {
    const g = i / (count - 1); // 0 (oldest) → 1 (most recent)
    // Started N weeks ago, ~8pm Thursday-ish.
    const startedAt = now - (count - i) * WEEK_MS + 4 * 3600 * 1000;

    const avgViewers = Math.round((300 + g * 1950) * jitter());
    const peakViewers = Math.round(avgViewers * (1.3 + Math.random() * 0.35));
    const durationMinutes = Math.round(105 + Math.random() * 80);
    const watchTimeMinutes = Math.round(avgViewers * durationMinutes);
    const uniqueChatters = Math.round((130 + g * 1150) * jitter());
    const messages = Math.round(uniqueChatters * (1.6 + Math.random() * 1.4));
    // Monetization scaled to the lively multi-platform chat rate so the live
    // "on pace" projection compares believably.
    const donated = Math.round((250 + g * 4200) * jitter(0.3));
    const subs = Math.round((25 + g * 380) * jitter(0.3));
    const followersGained = Math.round((25 + g * 300) * jitter(0.25));
    const clipMoments = Math.round((3 + g * 14) * jitter(0.4));

    // Platform mix: Twitch leads, X is the fastest-growing share, Kick steady-ish.
    const xShare = 0.15 + g * 0.17;
    const kickShare = 0.2 - g * 0.05;
    const twitchShare = 1 - xShare - kickShare;
    const shares: Record<Platform, number> = { twitch: twitchShare, kick: kickShare, x: xShare };

    sessions.push({
      id: `s-${i}`,
      title: TITLES[i % TITLES.length],
      startedAt,
      durationMinutes,
      avgViewers,
      peakViewers,
      uniqueChatters,
      messages,
      watchTimeMinutes,
      donated,
      subs,
      followersGained,
      clipMoments,
      perPlatform: buildPerPlatform(
        { avgViewers, peakViewers, uniqueChatters, messages, watchTimeMinutes, donated, subs, followersGained },
        shares,
      ),
    });
  }

  return sessions;
}
