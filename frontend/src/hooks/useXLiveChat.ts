import { useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { useModeStore } from "@/store/modeStore";
import { useLiveSourcesStore } from "@/store/liveSourcesStore";

/**
 * REAL live X broadcast chat with NO backend server. In LIVE mode:
 *  1. /api/x-chat-access/:id (Vercel fn) hands us the guest chat credentials.
 *  2. If the broadcast is RUNNING we open the pscp chat WebSocket DIRECTLY from
 *     the browser (WS has no CORS) and stream messages into the unified feed.
 *  3. A slow history poll through /api/x-chat-history (CORS-safe proxy) backfills
 *     anything the socket drops. Everything dedups on username:text:t.
 * If the broadcast is a replay/ended (show not on air), the feed stays quiet —
 * live mode never drips replayed chat.
 */
interface Access { endpoint: string; accessToken: string; roomId: string; replay: boolean; title: string; state: string }
interface Msg { username: string; displayName: string; text: string; t: number }

const RECHECK_MS = 20_000;
const HISTORY_POLL_MS = 4_000;

export function useXLiveChat(override?: string) {
  const addMessage = useChatStore((s) => s.addMessage);
  const demo = useModeStore((s) => s.demo);
  // The broadcast to follow = whatever the operator pasted in Connections
  // (defaults to the latest show episode).
  const stored = useLiveSourcesStore((s) => s.xBroadcastId);
  const broadcastId = override ?? stored;

  useEffect(() => {
    if (demo || !broadcastId) return;
    let alive = true;
    let ws: WebSocket | null = null;
    let access: Access | null = null;
    let cursor = "";
    let historyTimer: number | undefined;
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
        channel: access?.title || "Market Bubble",
        message: m.text,
        timestamp: Date.now(),
        badges: [],
        hype: false,
      });
    };

    const parse = (raw: string): Msg | null => {
      try {
        const env = JSON.parse(raw) as { payload?: string };
        const p = JSON.parse(env.payload ?? "{}") as { body?: string };
        const b = JSON.parse(p.body ?? "{}") as { type?: number; body?: string; username?: string; displayName?: string; timestamp?: number };
        if (b.type !== 1 || !b.body || !b.username) return null;
        return { username: b.username, displayName: b.displayName ?? b.username, text: b.body, t: b.timestamp ?? Date.now() };
      } catch {
        return null;
      }
    };

    const connectWs = () => {
      if (!alive || !access || access.replay) return;
      try { ws?.close(); } catch { /* ignore */ }
      const sock = new WebSocket(`${access.endpoint.replace(/^http/, "ws")}/chatapi/v1/chatnow`);
      ws = sock;
      sock.onopen = () => sock.send(JSON.stringify({ payload: JSON.stringify({ access_token: access?.accessToken, room_id: access?.roomId }), kind: 1 }));
      sock.onmessage = (e) => {
        const m = parse(String(e.data));
        if (m) emit(m);
      };
      // On close we do nothing — the recheck loop re-attaches with fresh creds,
      // and the history poll keeps messages flowing meanwhile.
    };

    const pollHistory = async () => {
      if (!alive || !access || access.replay) return;
      try {
        const r = await fetch("/api/x-chat-history", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: access.endpoint, accessToken: access.accessToken, cursor }),
        });
        const d = (await r.json()) as { messages?: Msg[]; cursor?: string };
        (d.messages ?? []).forEach(emit);
        if (d.cursor) cursor = d.cursor;
      } catch { /* transient */ }
      if (alive) historyTimer = window.setTimeout(() => void pollHistory(), HISTORY_POLL_MS);
    };

    const check = async () => {
      try {
        const r = await fetch(`/api/x-chat-access/${broadcastId}`);
        if (r.ok) {
          const fresh = (await r.json()) as Access;
          const stale = !access || access.endpoint !== fresh.endpoint || access.accessToken !== fresh.accessToken;
          access = fresh;
          if (!fresh.replay && alive) {
            if (stale || !ws || ws.readyState !== WebSocket.OPEN) connectWs();
            if (historyTimer === undefined) void pollHistory();
          }
        }
      } catch { /* transient */ }
      if (alive) recheckTimer = window.setTimeout(() => void check(), RECHECK_MS);
    };
    void check();

    return () => {
      alive = false;
      try { ws?.close(); } catch { /* ignore */ }
      if (historyTimer) window.clearTimeout(historyTimer);
      if (recheckTimer) window.clearTimeout(recheckTimer);
    };
  }, [broadcastId, addMessage, demo]);
}
