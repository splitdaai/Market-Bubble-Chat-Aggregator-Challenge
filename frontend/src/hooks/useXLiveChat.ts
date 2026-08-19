import { useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { useModeStore } from "@/store/modeStore";
import { useLiveSourcesStore } from "@/store/liveSourcesStore";

/**
 * REAL live X broadcast chat — $0/mo, via a stateless Vercel long-poll relay.
 *
 * Chatman (X's chat backend) refuses WebSocket upgrades from third-party
 * browser Origins, and its /history endpoint only exists for REPLAYS — so the
 * browser can't read a live room directly (the old browser-WS path died when
 * X tightened Origin checks). Instead:
 *  1. /api/x-chat-access/:id (Vercel fn) resolves guest chat credentials.
 *  2. If the broadcast is RUNNING, the browser long-polls /api/x-chat-live —
 *     the function holds the chatman WS server-side (Origin: x.com) for up to
 *     ~10s and returns the moment messages arrive, so latency stays sub-second
 *     while a quiet chat costs one cheap call every ~10s.
 * If the broadcast is a replay/ended (show not on air), the feed stays quiet —
 * live mode never drips replayed chat.
 */
interface Access { endpoint: string; accessToken: string; roomId: string; replay: boolean; title: string; state: string }
interface Msg { username: string; displayName: string; text: string; t: number }

const RECHECK_MS = 20_000;
const ERROR_BACKOFF_MS = 4_000;

export function useXLiveChat(override?: string) {
  const addMessage = useChatStore((s) => s.addMessage);
  const demo = useModeStore((s) => s.demo);
  // The broadcast to follow = whatever the operator pasted in Connections.
  const stored = useLiveSourcesStore((s) => s.xBroadcastId);
  const broadcastId = override ?? stored;

  useEffect(() => {
    if (demo || !broadcastId) return;
    let alive = true;
    let access: Access | null = null;
    let polling = false;
    let recheckTimer: number | undefined;
    const seen = new Set<string>();

    const emit = (m: Msg) => {
      const key = `${m.username}:${m.text}:${m.t}`;
      if (seen.has(key)) return;
      seen.add(key);
      addMessage({
        id: `x:live-${m.t}-${Math.floor(Math.random() * 1e6)}`,
        nativeId: `live-${m.t}`,
        platform: "x",
        username: m.displayName || m.username,
        channel: access?.title || "X Broadcast",
        message: m.text,
        timestamp: Date.now(),
        badges: [],
        hype: false,
      });
    };

    // One long-poll after another: each call rides the chatman WS server-side
    // and returns as soon as chat arrives (or after ~10s of quiet).
    const pollLive = async () => {
      if (polling) return;
      polling = true;
      while (alive && access && !access.replay) {
        try {
          const r = await fetch("/api/x-chat-live", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ endpoint: access.endpoint, accessToken: access.accessToken, roomId: access.roomId }),
          });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const d = (await r.json()) as { messages?: Msg[]; open?: boolean };
          (d.messages ?? []).forEach(emit);
          // A relay that couldn't keep the socket open = stale creds → re-resolve.
          if (d.open === false) break;
        } catch {
          await new Promise((x) => setTimeout(x, ERROR_BACKOFF_MS));
        }
      }
      polling = false;
    };

    const check = async () => {
      try {
        const r = await fetch(`/api/x-chat-access/${broadcastId}`);
        if (r.ok) {
          access = (await r.json()) as Access;
          if (!access.replay && alive) void pollLive();
        }
      } catch { /* transient */ }
      if (alive) recheckTimer = window.setTimeout(() => void check(), RECHECK_MS);
    };
    void check();

    return () => {
      alive = false;
      access = null;
      if (recheckTimer) window.clearTimeout(recheckTimer);
    };
  }, [broadcastId, addMessage, demo]);
}
