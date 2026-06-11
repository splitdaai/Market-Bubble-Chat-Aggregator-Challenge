import type { Platform } from "@shared/types";

/**
 * Net revenue to the creator per subscription/membership, USD — accurate to
 * each platform's payout split (Kick keeps the least, Twitch/YouTube ~70%).
 *   Twitch Tier-1 $4.99 @ ~70%  → 3.50
 *   Kick    $4.99 @ ~95%        → 4.75
 *   YouTube $4.99 @ ~70%        → 3.50
 *   X       creator sub ~$4.99  → 4.50
 */
export const SUB_VALUE: Record<Platform, number> = {
  twitch: 3.5,
  kick: 4.75,
  youtube: 3.5,
  x: 4.5,
};

/** Dollar value of `count` subs on a platform. */
export function subRevenue(platform: Platform, count: number): number {
  return count * (SUB_VALUE[platform] ?? 0);
}

/**
 * Net-to-creator ad CPM (USD per 1,000 ad impressions). No platform exposes a
 * realtime ad-revenue API, so revenue is ESTIMATED from tracked ad breaks:
 * every break counts the live viewers at that moment as impressions.
 *   Twitch  ~$3.50 net CPM (the published Ads Incentive Program baseline)
 *   YouTube ~$6.00 net (creator's 55% of a ~$10–12 gross live CPM)
 *   Kick    $0 — no pre/mid-roll ad program (monetization is subs + Kicks)
 *   X       ~$2.50 net (video ad-share estimate)
 */
export const AD_CPM: Record<Platform, number> = {
  twitch: 3.5,
  youtube: 6.0,
  kick: 0,
  x: 2.5,
};

/** Estimated ad revenue ($) from an impression base on a platform. */
export function adRevenue(platform: Platform, impressions: number): number {
  return (impressions / 1000) * (AD_CPM[platform] ?? 0);
}
