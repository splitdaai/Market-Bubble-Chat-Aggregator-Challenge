import type { Platform } from "@shared/types";

/**
 * Net revenue to the creator per subscription/membership, USD — accurate to
 * each platform's payout split (Kick keeps the least, Twitch/YouTube ~70%).
 *   Twitch Tier-1 $4.99 @ ~70%  → 3.50
 *   Kick    $4.99 @ ~95%        → 4.75
 *   YouTube $4.99 @ ~70%        → 3.50
 *   X       creator sub ~$4.99  → 4.50
 *   pump.fun has no subs        → 0
 */
export const SUB_VALUE: Record<Platform, number> = {
  twitch: 3.5,
  kick: 4.75,
  youtube: 3.5,
  x: 4.5,
  pumpfun: 0,
};

/** Dollar value of `count` subs on a platform. */
export function subRevenue(platform: Platform, count: number): number {
  return count * (SUB_VALUE[platform] ?? 0);
}
