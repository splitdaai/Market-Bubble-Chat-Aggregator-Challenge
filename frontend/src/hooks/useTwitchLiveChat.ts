import { useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { useModeStore } from "@/store/modeStore";

/**
 * REAL live Twitch chat with NO backend and NO Lambda — $0.
 *
 * Twitch exposes anonymous chat over a plain WebSocket (`irc-ws.twitch.tv`),
 * and WebSockets aren't CORS-restricted, so the browser connects directly with
 * a throwaway `justinfan` nick (read-only, no login, no ban risk) and JOINs the
 * show's channels. Messages flow into the same unified feed as X chat. Runs in
 * LIVE mode only; demo mode keeps the mock firehose.
 *
 * (Twitch chat is reachable even when a channel is offline, so the feed fills
 * as soon as anyone talks — no dependency on the stream being live.)
 */
const TWITCH_CHANNELS = ["ansem", "banks", "marketbubble"];
const WS_URL = "wss://irc-ws.chat.twitch.tv:443";
const RECONNECT_MS = 5_000;

export function useTwitchLiveChat(channels: string[] = TWITCH_CHANNELS) {
  const addMessage = useChatStore((s) => s.addMessage);
  const demo = useModeStore((s) => s.demo);

  useEffect(() => {
    if (demo) return;
    let alive = true;
    let ws: WebSocket | null = null;
    let reconnectTimer: number | undefined;
    const seen = new Set<string>();

    const parseTags = (raw: string): Record<string, string> => {
      const tags: Record<string, string> = {};
      if (!raw.startsWith("@")) return tags;
      for (const kv of raw.slice(1).split(";")) {
        const eq = kv.indexOf("=");
        if (eq > 0) tags[kv.slice(0, eq)] = kv.slice(eq + 1);
      }
      return tags;
    };

    // A single IRC line → a chat message (or null for non-PRIVMSG frames).
    const handleLine = (line: string) => {
      if (line.startsWith("PING")) {
        ws?.send("PONG :tmi.twitch.tv");
        return;
      }
      // Optional leading @tags, then `:nick!nick@nick.tmi.twitch.tv PRIVMSG #chan :text`
      let rest = line;
      let tags: Record<string, string> = {};
      if (rest.startsWith("@")) {
        const sp = rest.indexOf(" ");
        tags = parseTags(rest.slice(0, sp));
        rest = rest.slice(sp + 1);
      }
      const priv = rest.indexOf(" PRIVMSG #");
      if (priv < 0) return;
      const prefix = rest.slice(0, priv); // :nick!...
      const nick = prefix.startsWith(":") ? prefix.slice(1, prefix.indexOf("!")) : prefix;
      const afterCmd = rest.slice(priv + " PRIVMSG #".length);
      const sp2 = afterCmd.indexOf(" :");
      if (sp2 < 0) return;
      const channel = afterCmd.slice(0, sp2);
      const text = afterCmd.slice(sp2 + 2).replace(/\r?\n$/, "");
      if (!text) return;

      const id = tags["id"] || `${nick}:${text}:${Date.now()}`;
      if (seen.has(id)) return;
      seen.add(id);
      addMessage({
        id: `twitch:${id}`,
        nativeId: id,
        platform: "twitch",
        username: tags["display-name"] || nick,
        channel,
        message: text,
        timestamp: tags["tmi-sent-ts"] ? Number(tags["tmi-sent-ts"]) : Date.now(),
        color: tags["color"] || undefined,
        badges: [],
        hype: false,
      });
    };

    const connect = () => {
      if (!alive) return;
      const sock = new WebSocket(WS_URL);
      ws = sock;
      sock.onopen = () => {
        sock.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
        sock.send(`NICK justinfan${Math.floor(1e4 + Math.random() * 8e4)}`);
        sock.send(`JOIN ${channels.map((c) => `#${c.toLowerCase()}`).join(",")}`);
      };
      sock.onmessage = (e) => {
        for (const line of String(e.data).split("\r\n")) {
          if (line) handleLine(line);
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
  }, [channels, addMessage, demo]);
}
