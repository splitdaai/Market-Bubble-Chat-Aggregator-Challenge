import type { Account, Platform } from "@shared/types";

/**
 * Demo channels seeded so multi-account aggregation is visible out of the box —
 * Ansem, Banks and Market Bubble across several platforms. Shared by the
 * connections store (live) and the mock history generator (analytics).
 */
export const DEMO_ACCOUNTS: Account[] = [
  { id: "twitch:ansem", platform: "twitch", handle: "ansem", displayName: "Ansem", connected: true },
  { id: "kick:ansem", platform: "kick", handle: "ansem", displayName: "Ansem", connected: true },
  { id: "youtube:ansem", platform: "youtube", handle: "@ansem", displayName: "Ansem", connected: true },
  { id: "twitch:banks", platform: "twitch", handle: "banks", displayName: "Banks", connected: true },
  { id: "kick:banks", platform: "kick", handle: "banks", displayName: "Banks", connected: true },
  { id: "youtube:banks", platform: "youtube", handle: "@banks", displayName: "Banks", connected: true },
  { id: "x:ansem", platform: "x", handle: "@blknoiz06", displayName: "Ansem", connected: true },
  { id: "x:banks", platform: "x", handle: "@banks", displayName: "Banks", connected: true },
  { id: "twitch:marketbubble", platform: "twitch", handle: "marketbubble", displayName: "Market Bubble", connected: true },
  { id: "x:marketbubble", platform: "x", handle: "@MarketBubble", displayName: "Market Bubble", connected: true },
  { id: "youtube:marketbubble", platform: "youtube", handle: "@MarketBubble", displayName: "Market Bubble", connected: true },
];

/**
 * The operator's OWN channels — the LIVE-mode default. Demo keeps the show trio
 * above; Live starts from these (editable in Connections, remembered per browser).
 */
export const OWNER_ACCOUNTS: Account[] = [
  { id: "twitch:splitdawig", platform: "twitch", handle: "splitdawig", displayName: "SplitDaWig", connected: true },
  { id: "kick:splitdawig", platform: "kick", handle: "splitdawig", displayName: "SplitDaWig", connected: true },
  { id: "youtube:splitdawig", platform: "youtube", handle: "@SplitDaWig", displayName: "SplitDaWig", connected: true },
  { id: "x:splitdawig", platform: "x", handle: "@SplitDaWig", displayName: "SplitDaWig", connected: true },
];

const DEMO_IDS = new Set(DEMO_ACCOUNTS.map((a) => a.id));
/** Accounts that are NOT part of the demo trio — i.e. the operator's own additions. */
export const ownAccounts = (accounts: Account[]) => accounts.filter((a) => !DEMO_IDS.has(a.id));
/** True when every demo-trio account is present (a demo list, possibly with extras appended). */
export const containsDemoTrio = (accounts: Account[]) => DEMO_ACCOUNTS.every((d) => accounts.some((a) => a.id === d.id));
/** Union by id, keeping `base` order and appending new ones. */
export const unionAccounts = (base: Account[], extra: Account[]) => [...base, ...extra.filter((e) => !base.some((b) => b.id === e.id))];

/** True when `accounts` is exactly the demo trio (order-insensitive). */
export const isDemoTrio = (accounts: Account[]) =>
  accounts.length === DEMO_ACCOUNTS.length && accounts.every((a) => DEMO_ACCOUNTS.some((d) => d.id === a.id));

/** Rough channel-size weights for splitting platform totals across accounts. */
export const ACCOUNT_WEIGHT: Record<string, number> = { Ansem: 1, Banks: 0.7, "Market Bubble": 0.5 };

/** Normalized weight of an account within its platform (for KPI splits). */
export function accountShare(account: Account, accounts: Account[]): number {
  const onPlatform = accounts.filter((a) => a.platform === account.platform);
  const total = onPlatform.reduce((s, a) => s + (ACCOUNT_WEIGHT[a.displayName] ?? 0.6), 0) || 1;
  return (ACCOUNT_WEIGHT[account.displayName] ?? 0.6) / total;
}

export const PLATFORM_ORDER: Platform[] = ["twitch", "kick", "x", "youtube"];

/** Platforms that have at least one connected account (shown in the UI). */
export function activePlatforms(accounts: Account[]): Platform[] {
  return PLATFORM_ORDER.filter((p) => accounts.some((a) => a.platform === p && a.connected));
}
