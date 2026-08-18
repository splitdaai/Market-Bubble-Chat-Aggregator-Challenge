import { useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { useModeStore } from "@/store/modeStore";
import { useConnectionsStore } from "@/store/connectionsStore";
import type { Badge, ChatEvent } from "@shared/types";

/**
 * REAL live YouTube chat with NO server of our own — $0, no API key, no quota.
 *
 * YouTube's own web chat rides an internal endpoint the browser can't call
 * cross-origin, so a tiny stateless Vercel function (`/api/yt-chat`) proxies two
 * things: "@handle → the live video + first chat cursor" and "cursor → new
 * messages + next cursor". The browser owns the cursor and polls at the pace
 * YouTube asks for. One loop per connected YouTube channel; off-air channels
 * re-check every minute so chat starts flowing the moment you go live.
 *
 * LIVE mode only; demo keeps the mock firehose.
 */
interface Resolve { live: boolean; videoId?: string; title?: string; channelName?: string; continuation?: string; apiKey?: string; clientVersion?: string; retryMs?: number }
interface YtMsg { id: string; author: string; avatar?: string; text: string; t: number; badges: Badge[]; amount?: string; kind: "text" | "superchat" | "supersticker" | "member" }
interface Poll { messages: YtMsg[]; continuation?: string; timeoutMs: number; live: boolean }

const MIN_POLL_MS = 2_500;
const OFFAIR_RECHECK_MS = 60_000;
const ERROR_BACKOFF_MS = 15_000;

/** "$5.00" / "€2,00" / "¥500" → rough USD number for the donor leaderboard. */
function usdOf(label?: string): number {
  if (!label) return 0;
  const n = Number(label.replace(/[^\d.,]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  if (/^\s*(¥|JP¥|JPY)/.test(label)) return n / 150;
  if (/^\s*(₩|KRW)/.test(label)) return n / 1350;
  if (/^\s*(₹|INR)/.test(label)) return n / 84;
  return n; // $, €, £ etc. — close enough to USD for ranking
}

function eventOf(m: YtMsg): ChatEvent | undefined {
  if (m.kind === "superchat" || m.kind === "supersticker") {
    return { kind: "donation", amount: usdOf(m.amount), label: m.amount ?? "Super Chat" };
  }
  if (m.kind === "member") return { kind: "subscription", amount: 4.99, count: 1, label: "Member" };
  return undefined;
}

export function useYouTubeLiveChat() {
  const addMessage = useChatStore((s) => s.addMessage);
  const demo = useModeStore((s) => s.demo);
  const accounts = useConnectionsStore((s) => s.accounts);
  // Stable key so the effect only restarts when the YouTube channel set changes.
  const channelsKey = accounts
    .filter((a) => a.platform === "youtube" && a.connected)
    .map((a) => `${a.id}|${a.handle}|${a.displayName}`)
    .join(",");

  useEffect(() => {
    if (demo || !channelsKey) return;
    let alive = true;
    const timers = new Set<number>();
    const seen = new Set<string>();
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(() => { timers.delete(t); resolve(); }, ms);
        timers.add(t);
      });

    const run = async (accountId: string, handle: string, displayName: string) => {
      while (alive) {
        let res: Resolve | null = null;
        try {
          const r = await fetch(`/api/yt-chat?target=${encodeURIComponent(handle)}`);
          if (r.ok) res = (await r.json()) as Resolve;
        } catch { /* transient */ }
        if (!alive) return;
        if (!res) { await sleep(ERROR_BACKOFF_MS); continue; }
        if (!res.live || !res.continuation) { await sleep(res.retryMs ?? OFFAIR_RECHECK_MS); continue; }

        const channel = res.channelName || displayName;
        let cont: string | undefined = res.continuation;
        const q = `&key=${encodeURIComponent(res.apiKey ?? "")}&cv=${encodeURIComponent(res.clientVersion ?? "")}`;
        while (alive && cont) {
          let p: Poll | null = null;
          try {
            const r = await fetch(`/api/yt-chat?continuation=${encodeURIComponent(cont)}${q}`);
            if (r.ok) p = (await r.json()) as Poll;
          } catch { /* transient */ }
          if (!alive) return;
          if (!p) { await sleep(ERROR_BACKOFF_MS); break; } // re-resolve
          for (const m of p.messages) {
            if (seen.has(m.id)) continue;
            seen.add(m.id);
            addMessage({
              id: `youtube:${m.id}`,
              nativeId: m.id,
              platform: "youtube",
              accountId,
              username: m.author,
              channel,
              message: m.text,
              timestamp: m.t || Date.now(),
              avatar: m.avatar,
              badges: m.badges,
              hype: m.kind !== "text",
              event: eventOf(m),
            });
          }
          if (!p.live) { cont = undefined; break; }
          cont = p.continuation;
          await sleep(Math.max(MIN_POLL_MS, p.timeoutMs));
        }
        // Chat ended / errored → back to "is it live?" after a short pause.
        await sleep(ERROR_BACKOFF_MS);
      }
    };

    for (const spec of channelsKey.split(",")) {
      const [id, handle, displayName] = spec.split("|");
      void run(id, handle, displayName || handle);
    }

    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [channelsKey, addMessage, demo]);
}
