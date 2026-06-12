/**
 * Bubble Bucks — the show's chat-points currency (watch & earn).
 *
 * v1 derives balances live from the same per-chatter stats that power the
 * leaderboards, so it works in demo and live mode with zero extra plumbing:
 *
 *   · watching   — 1 BB per minute watched (first-seen → last-active; still
 *                  accruing while the viewer has been active in the last 10 min)
 *   · commenting — 1 BB per message
 *   · subbing    — 100 BB per sub (own or gifted)
 *   · supporting — 5 BB per $1 (tips / bits / sub value)
 *
 * Chat can only see watch time for people who've chatted at least once —
 * true lurker accrual is the backend's job (it knows viewer presence). When
 * the backend lands it should emit a per-user `bucks` field that REPLACES
 * this client-side estimate.
 */

export const BUCKS = {
  perMinute: 1,
  perMessage: 1,
  perSub: 100,
  perDollar: 5,
} as const;

/** A viewer counts as "still watching" this long after their last activity. */
const ACTIVE_WINDOW_MS = 10 * 60_000;

export interface BucksSource {
  /** Message count (UserRow.count / ChatterRow.count). */
  count: number;
  donated: number;
  subs: number;
  /** First/last seen timestamps — enable watch-time accrual when present. */
  first?: number;
  last?: number;
}

/** Minutes watched: first-seen → last-active, extended to now while active. */
export function watchMinutes(u: BucksSource, now = Date.now()): number {
  if (!u.first || !u.last) return 0;
  const end = now - u.last < ACTIVE_WINDOW_MS ? now : u.last;
  return Math.max(0, (end - u.first) / 60_000);
}

/** A user's Bubble Bucks balance, derived from their chat activity. */
export function bucksFor(u: BucksSource, now = Date.now()): number {
  return Math.round(
    watchMinutes(u, now) * BUCKS.perMinute +
    u.count * BUCKS.perMessage +
    u.subs * BUCKS.perSub +
    u.donated * BUCKS.perDollar,
  );
}

/** A user's available Bubble Bucks balance — earned minus spent. */
export function balanceFor(u: BucksSource & { spent?: number }, now = Date.now()): number {
  return Math.max(0, bucksFor(u, now) - (u.spent ?? 0));
}

/**
 * Compute the 1–N rank for each user by lifetime Bubble Bucks earned.
 * Returns a Map keyed by `platform:username.toLowerCase()`.
 *
 * Tied scores share the higher rank ("standard competition" / "1224" ranking),
 * so two viewers tied for the top slot are both #1 and the next is #3.
 */
export function computeRanks(
  rows: { platform: string; name: string; key?: string; bucks: number }[],
  limit = 20,
): Map<string, number> {
  const sorted = rows.slice().sort((a, b) => b.bucks - a.bucks).slice(0, limit);
  const out = new Map<string, number>();
  let lastBucks = -1;
  let lastRank = 0;
  sorted.forEach((row, i) => {
    const rank = row.bucks === lastBucks ? lastRank : i + 1;
    lastBucks = row.bucks;
    lastRank = rank;
    const key = row.key ?? `${row.platform}:${row.name.toLowerCase()}`;
    out.set(key, rank);
  });
  return out;
}
