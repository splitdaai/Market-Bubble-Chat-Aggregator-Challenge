import { useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { useModeStore } from "@/store/modeStore";

/**
 * REAL live Kick chat with NO server and NO Lambda — $0.
 *
 * Kick's channel REST API is Cloudflare-walled (403 to any non-browser client),
 * but a Kick channel's chatroom id is PERMANENT, and Kick's chat itself rides
 * Pusher, whose WebSocket is NOT walled and needs no auth for public chatrooms.
 * So we ship the show's chatroom ids (resolved once via a TLS-impersonating
 * request) and the browser connects straight to Pusher — read-only, no login.
 *
 * Adding a new Kick channel = resolve its chatroom id once
 * (`GET kick.com/api/v2/channels/<slug>` via curl_cffi / curl-impersonate) and
 * add it to KICK_CHATROOMS below. Ids never change for an existing channel.
 *
 * LIVE mode only; demo keeps the mock firehose.
 */
const KICK_CHATROOMS: Record<string, { channel: string; room: string }> = {
  ansem: { channel: "Ansem", room: "108796898" },
  banks: { channel: "Banks", room: "86037190" },
};
// Kick's public Pusher app (key + cluster). Public chatrooms need no auth token.
const PUSHER_KEY = "32cbd69e4b950bf97679";
const PUSHER_URL = `wss://ws-us2.pusher.com/app/${PUSHER_KEY}?protocol=7&client=js&version=8.4.0&flash=false`;
const RECONNECT_MS = 5_000;

export function useKickLiveChat(rooms: typeof KICK_CHATROOMS = KICK_CHATROOMS) {
  const addMessage = useChatStore((s) => s.addMessage);
  const demo = useModeStore((s) => s.demo);

  useEffect(() => {
    if (demo) return;
    let alive = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    const seen = new Set<string>();
    // room id -> friendly channel label
    const label = new Map(Object.values(rooms).map((r) => [r.room, r.channel]));

    const handleChat = (roomId: string, dataStr: string) => {
      let d: { id?: string; content?: string; sender?: { username?: string; identity?: { color?: string } } };
      try { d = JSON.parse(dataStr); } catch { return; }
      const text = d.content ?? "";
      const user = d.sender?.username ?? "";
      if (!text || !user) return;
      const id = d.id || `${user}:${text}:${Date.now()}`;
      if (seen.has(id)) return;
      seen.add(id);
      addMessage({
        id: `kick:${id}`,
        nativeId: id,
        platform: "kick",
        username: user,
        channel: label.get(roomId) ?? "Kick",
        message: text,
        timestamp: Date.now(),
        color: d.sender?.identity?.color || undefined,
        badges: [],
        hype: false,
      });
    };

    const connect = () => {
      if (!alive) return;
      const sock = new WebSocket(PUSHER_URL);
      ws = sock;
      sock.onmessage = (e) => {
        let m: { event?: string; channel?: string; data?: string };
        try { m = JSON.parse(String(e.data)); } catch { return; }
        if (m.event === "pusher:connection_established") {
          for (const { room } of Object.values(rooms)) {
            sock.send(JSON.stringify({ event: "pusher:subscribe", data: { auth: "", channel: `chatrooms.${room}.v2` } }));
          }
          return;
        }
        if (m.event === "pusher:ping") { sock.send(JSON.stringify({ event: "pusher:pong", data: "{}" })); return; }
        if (typeof m.event === "string" && m.event.includes("ChatMessage") && m.channel && m.data) {
          const roomId = m.channel.replace(/^chatrooms\./, "").replace(/\.v2$/, "");
          handleChat(roomId, m.data);
        }
      };
      sock.onclose = () => {
        if (!alive || ws !== sock) return;
        reconnectTimer = window.setTimeout(connect, RECONNECT_MS);
      };
      sock.onerror = () => { try { sock.close(); } catch { /* ignore */ } };
    };
    connect();

    return () => {
      alive = false;
      try { ws?.close(); } catch { /* ignore */ }
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
    };
  }, [rooms, addMessage, demo]);
}
