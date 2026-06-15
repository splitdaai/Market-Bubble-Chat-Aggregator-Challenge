/**
 * Auto-detect a connected X account's LIVE broadcast and stream its chat into the
 * unified feed — no manual link, no setup. The moment you connect your X account
 * and go live, your broadcast chat shows up in the aggregator.
 *
 * Discovery (uses the account's own OAuth token, the same one the mentions poller
 * uses): when you start an X broadcast, X auto-posts a tweet linking to it
 * (`x.com/i/broadcasts/<id>`). We scan the account's recent tweets for that link,
 * verify the broadcast is actually RUNNING via the guest flow, then spin up the
 * existing XBroadcastChatConnector. When the broadcast ends, we tear it down.
 *
 * Only the guest (anonymous) Periscope flow touches the broadcast itself — zero
 * ban risk — and the OAuth token is read-only here (list-tweets), same as mentions.
 */
import { normalizeBroadcastId, resolveBroadcastChat, XBroadcastChatConnector } from "./xBroadcastChat.ts";
import type { Connector } from "./platforms/types.ts";

const API = "https://api.twitter.com/2";
const POLL_MS = 45_000; // tweet scan / live-state check cadence — rate-limit friendly
const FIRST_TICK_MS = 3_000;

interface TweetUrl { url?: string; expanded_url?: string }
interface Tweet { id: string; text?: string; created_at?: string; entities?: { urls?: TweetUrl[] } }

export class XLiveBroadcastWatcher {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private userId: string | null = null;
  private activeId: string | null = null;
  private activeConnector: XBroadcastChatConnector | null = null;

  constructor(
    private opts: {
      oauthToken: string;
      label: string;
      refresh?: () => Promise<string | null>;
      addConnector: (c: Connector) => Promise<void>;
    },
  ) {}

  async start() {
    this.stopped = false;
    this.userId = await this.resolveUserId();
    if (!this.userId) {
      console.warn(`x-live-watch: could not resolve user id for ${this.opts.label} — broadcast auto-detect disabled`);
      return;
    }
    console.log(`✓ x-live-watch: armed for @${this.opts.label} (auto-detects your live X broadcast chat)`);
    this.schedule(FIRST_TICK_MS);
  }

  private schedule(delay: number) {
    if (this.stopped) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.tick(), delay);
  }

  private async tick() {
    if (this.stopped) return;
    try {
      // If we're already streaming a broadcast, just confirm it's still live.
      if (this.activeId) {
        const acc = await resolveBroadcastChat(this.activeId);
        const ended = !acc || acc.replay || (acc.state || "").toUpperCase() === "ENDED";
        if (ended) await this.stopActive("broadcast ended");
        else return; // still live — no need to scan tweets
      } else {
        // Not streaming anything — look for a fresh live broadcast.
        const id = await this.discoverLiveBroadcastId();
        if (id) {
          const acc = await resolveBroadcastChat(id);
          if (acc && !acc.replay && (acc.state || "").toUpperCase() !== "ENDED") {
            await this.startBroadcast(id, acc.title);
          }
        }
      }
    } catch (e) {
      console.warn(`x-live-watch: tick failed for ${this.opts.label}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      this.schedule(POLL_MS);
    }
  }

  /** Scan recent tweets for a broadcast link → broadcast id (or null). */
  private async discoverLiveBroadcastId(): Promise<string | null> {
    if (!this.userId) {
      this.userId = await this.resolveUserId();
      if (!this.userId) return null;
    }
    const url = new URL(`${API}/users/${this.userId}/tweets`);
    url.searchParams.set("max_results", "10");
    url.searchParams.set("tweet.fields", "entities,created_at");
    url.searchParams.set("exclude", "retweets,replies");
    const d = await this.getJson<{ data?: Tweet[] }>(url.toString());
    if (!d?.data) return null;
    for (const t of d.data) {
      const candidates = [t.text ?? "", ...((t.entities?.urls ?? []).map((u) => u.expanded_url || u.url || ""))];
      for (const c of candidates) {
        const id = normalizeBroadcastId(c);
        if (id) return id; // verified live-or-not by the caller via resolveBroadcastChat
      }
    }
    return null;
  }

  private async startBroadcast(id: string, title: string) {
    const label = title || `@${this.opts.label} live`;
    const conn = new XBroadcastChatConnector(id, label);
    this.activeId = id;
    this.activeConnector = conn;
    await this.opts.addConnector(conn);
    console.log(`✓ x-live-watch: auto-started live broadcast chat ${id} ("${label}") for @${this.opts.label}`);
  }

  private async stopActive(reason: string) {
    const id = this.activeId;
    if (this.activeConnector) {
      try { await this.activeConnector.stop(); } catch { /* best-effort */ }
    }
    this.activeConnector = null;
    this.activeId = null;
    console.log(`x-live-watch: stopped broadcast ${id} for @${this.opts.label} (${reason})`);
  }

  private async resolveUserId(): Promise<string | null> {
    const d = await this.getJson<{ data?: { id?: string } }>(`${API}/users/me`);
    return d?.data?.id ?? null;
  }

  /** Authorized GET with a one-shot token refresh on 401. */
  private async getJson<T>(u: string): Promise<T | null> {
    try {
      let r = await fetch(u, { headers: { Authorization: `Bearer ${this.opts.oauthToken}` } });
      if (r.status === 401 && this.opts.refresh) {
        const fresh = await this.opts.refresh();
        if (!fresh) return null;
        this.opts.oauthToken = fresh;
        r = await fetch(u, { headers: { Authorization: `Bearer ${this.opts.oauthToken}` } });
      }
      if (!r.ok) return null;
      return (await r.json()) as T;
    } catch {
      return null;
    }
  }

  async stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.stopActive("watcher stopped");
  }
}
