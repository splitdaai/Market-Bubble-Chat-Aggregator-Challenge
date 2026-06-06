import type { AggregateStats, ChatMessage, Platform, PlatformStats, StreamSession } from "../../../shared/types.ts";

const PLATFORMS: Platform[] = ["twitch", "kick", "x", "youtube"];
const ACTIVE_WINDOW = 5 * 60_000;
const VELOCITY_WINDOW = 60_000;

interface PState {
  viewers: number;
  peakViewers: number;
  watchTimeMinutes: number; // viewer-minutes
  followsGained: number;
  chatters: Map<string, number>; // username → last-seen ms
  messages: number;
  msgTimes: number[];
  donated: number;
  subs: number;
}

function blank(): PState {
  return { viewers: 0, peakViewers: 0, watchTimeMinutes: 0, followsGained: 0, chatters: new Map(), messages: 0, msgTimes: [], donated: 0, subs: 0 };
}

/**
 * Server-authoritative stats. Chat-derived numbers (chatters, messages,
 * donations, subs) come from the live message stream; viewer counts + watch
 * time come from the platform-API pollers feeding `setViewers`. Emitted to
 * clients as `AggregateStats` on a fixed cadence.
 */
export class StatsAggregator {
  private start = Date.now();
  private last = Date.now();
  private state: Record<Platform, PState> = { twitch: blank(), kick: blank(), x: blank(), youtube: blank() };

  /** Feed every normalized chat message here. */
  ingest(m: ChatMessage) {
    const s = this.state[m.platform];
    if (!s) return;
    const now = Date.now();
    s.messages += 1;
    s.msgTimes.push(now);
    s.chatters.set(m.username.toLowerCase(), now);
    if (m.event) {
      s.donated += m.event.amount;
      if (m.event.kind === "subscription" || m.event.kind === "gift") s.subs += m.event.count ?? 1;
    }
  }

  /** Live viewer count from a platform API poller. */
  setViewers(p: Platform, viewers: number) {
    const s = this.state[p];
    s.viewers = viewers;
    s.peakViewers = Math.max(s.peakViewers, viewers);
  }

  addFollows(p: Platform, n: number) {
    this.state[p].followsGained += n;
  }

  private accrueWatchTime() {
    const now = Date.now();
    const dt = now - this.last;
    this.last = now;
    for (const p of PLATFORMS) this.state[p].watchTimeMinutes += (this.state[p].viewers * dt) / 60_000;
  }

  private kpis(): PlatformStats[] {
    const now = Date.now();
    return PLATFORMS.map((p) => {
      const s = this.state[p];
      s.msgTimes = s.msgTimes.filter((t) => now - t < VELOCITY_WINDOW);
      let active = 0;
      for (const last of s.chatters.values()) if (now - last < ACTIVE_WINDOW) active += 1;
      return {
        platform: p,
        viewers: Math.round(s.viewers),
        peakViewers: Math.round(s.peakViewers),
        watchTimeMinutes: Math.round(s.watchTimeMinutes),
        followsGained: s.followsGained,
        uniqueChatters: s.chatters.size,
        activeChatters: active,
        messages: s.messages,
        messagesPerMin: s.msgTimes.length,
      };
    });
  }

  snapshot(): AggregateStats {
    this.accrueWatchTime();
    return { sessionStart: this.start, updatedAt: Date.now(), perPlatform: this.kpis() };
  }

  /** Roll the current session up into a completed StreamSession for history. */
  toSession(title: string): StreamSession {
    const per = this.kpis();
    const durationMinutes = Math.max(1, Math.round((Date.now() - this.start) / 60_000));
    const sum = (f: (k: PlatformStats) => number) => per.reduce((a, k) => a + f(k), 0);
    return {
      id: `s-${this.start}`,
      title,
      startedAt: this.start,
      durationMinutes,
      avgViewers: Math.round(sum((k) => k.watchTimeMinutes) / durationMinutes),
      peakViewers: sum((k) => k.peakViewers),
      uniqueChatters: sum((k) => k.uniqueChatters),
      messages: sum((k) => k.messages),
      watchTimeMinutes: sum((k) => k.watchTimeMinutes),
      donated: PLATFORMS.reduce((a, p) => a + this.state[p].donated, 0),
      subs: PLATFORMS.reduce((a, p) => a + this.state[p].subs, 0),
      followersGained: sum((k) => k.followsGained ?? 0),
      clipMoments: 0,
      perPlatform: per.map((k) => ({
        platform: k.platform,
        avgViewers: durationMinutes ? Math.round(k.watchTimeMinutes / durationMinutes) : 0,
        peakViewers: k.peakViewers,
        uniqueChatters: k.uniqueChatters,
        messages: k.messages,
        watchTimeMinutes: k.watchTimeMinutes,
        donated: this.state[k.platform].donated,
        subs: this.state[k.platform].subs,
        followersGained: k.followsGained ?? 0,
      })),
    };
  }
}
