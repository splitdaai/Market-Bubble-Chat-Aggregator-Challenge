import { useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { useModeStore } from "@/store/modeStore";
import { LATEST_EPISODE_BID } from "@/lib/broadcastConstants";

const BACKEND = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "https://3-213-104-77.nip.io";

interface XMsg { username: string; displayName: string; text: string; t: number }

/**
 * Always shows REAL X broadcast chat in the unified feed. Pulls the actual
 * public chat from the Market Bubble X broadcast via the guest endpoint (no
 * login, no account, zero ban risk) and drips it in at a human cadence so the X
 * column is never empty — in both demo and live mode. Loops the batch so it
 * keeps flowing during a long demo.
 */
export function useXBroadcastChat(broadcastId: string = LATEST_EPISODE_BID) {
  const addMessage = useChatStore((s) => s.addMessage);
  const demo = useModeStore((s) => s.demo);

  useEffect(() => {
    // Replay-drip is a DEMO showcase (real X messages from the last broadcast).
    // In LIVE mode the feed shows only genuine live chat — the real-time X
    // broadcast chat then comes from the backend connector when the show is
    // actually on air, never a dripped replay.
    if (!demo) return;
    let alive = true;
    let timer: number | undefined;
    let cancelIdleLoad = () => {};

    const drip = (msgs: XMsg[]) => {
      if (!msgs.length) return;
      let i = 0;
      const tick = () => {
        if (!alive) return;
        const m = msgs[i % msgs.length];
        i++;
        addMessage({
          id: `x:bc-${broadcastId}-${i}-${Math.floor(Math.random() * 1e6)}`,
          nativeId: `bc-${i}`,
          platform: "x",
          username: m.displayName || m.username,
          channel: "Market Bubble",
          message: m.text,
          timestamp: Date.now(),
          badges: [],
          hype: false,
        });
        timer = window.setTimeout(tick, 3500 + Math.random() * 4000);
      };
      tick();
    };

    const load = () => {
      fetch(`${BACKEND}/api/x-broadcast-chat/${broadcastId}`)
        .then((r) => r.json())
        .then((d: { messages?: XMsg[] }) => {
          // Keep only standalone live X chat — drop @-reply pings to the host.
          // (The filter lives HERE, not in the central store, so it never touches
          // a host's or viewer's own composer message.)
          const clean = (d.messages ?? []).filter((m) => !/^\s*@[A-Za-z0-9_]/.test(m.text));
          if (alive && clean.length) drip(clean);
        })
        .catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(load, { timeout: 3000 });
      cancelIdleLoad = () => window.cancelIdleCallback(idleId);
    } else {
      const timeoutId = globalThis.setTimeout(load, 1200);
      cancelIdleLoad = () => globalThis.clearTimeout(timeoutId);
    }

    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      cancelIdleLoad();
    };
  }, [broadcastId, addMessage, demo]);
}
