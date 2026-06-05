import type { AccountStat } from "@/store/statsStore";
import type { Platform } from "@shared/types";

/** A streamer's metrics aggregated across all of their platform channels. */
export interface StreamerStat {
  name: string;
  viewers: number;
  watchTimeMinutes: number;
  uniqueChatters: number;
  messages: number;
  donated: number;
  subs: number;
  platforms: Platform[];
}

/** Group per-account stats by channel owner (e.g. Ansem, Banks, Market Bubble). */
export function byStreamer(accounts: AccountStat[]): StreamerStat[] {
  const map = new Map<string, StreamerStat>();
  for (const a of accounts) {
    const s = map.get(a.displayName) ?? {
      name: a.displayName, viewers: 0, watchTimeMinutes: 0, uniqueChatters: 0, messages: 0, donated: 0, subs: 0, platforms: [],
    };
    s.viewers += a.viewers;
    s.watchTimeMinutes += a.watchTimeMinutes;
    s.uniqueChatters += a.uniqueChatters;
    s.messages += a.messages;
    s.donated += a.donated;
    s.subs += a.subs;
    if (!s.platforms.includes(a.platform)) s.platforms.push(a.platform);
    map.set(a.displayName, s);
  }
  return [...map.values()].sort((x, y) => y.viewers - x.viewers);
}
