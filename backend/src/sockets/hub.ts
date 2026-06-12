import type { Server } from "socket.io";
import type { Connector } from "../platforms/types.ts";
import type {
  ChatMessage,
  ConnectionStatus,
  ServerToClientEvents,
  ClientToServerEvents,
  Clip,
  OverlayEngagementEvent,
  OverlayActionKind,
} from "../../../shared/types.ts";
import { makeModerationRouter } from "../moderation.ts";
import { StatsAggregator } from "../stats/aggregator.ts";
import { HistoryStore } from "../history/store.ts";
import { createClip } from "../clips.ts";
import { verifyChatToken } from "../auth.ts";

/**
 * The hub binds all connectors to the Socket.io server:
 *  - fans every normalized message out to all clients + into the aggregator
 *  - tracks per-platform status and broadcasts it
 *  - broadcasts real `stats` on a fixed cadence
 *  - sends `history` to each joining client
 *  - routes moderation + clip + custom-command requests back to platforms
 */
export function bindHub(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  connectors: Connector[],
  aggregator: StatsAggregator,
  history: HistoryStore,
) {
  // Connectors are keyed by platform:channel so MULTIPLE channels per platform
  // can run at once (multi-account aggregation); the same channel just replaces
  // itself (env connector vs the OAuth-linked one never double-read).
  const keyOf = (c: Connector) => `${c.platform}:${(c.status().channel ?? "").replace(/^#/, "").toLowerCase()}`;
  const registry = new Map<string, Connector>(connectors.map((c) => [keyOf(c), c]));
  const moderate = makeModerationRouter(registry);
  const statuses = new Map<string, ConnectionStatus>();

  // Rolling buffer of the stream's recent messages so a client that refreshes
  // (or joins late) gets the backlog replayed instead of an empty feed. Kept in
  // memory for the life of the backend process (i.e. the stream).
  const MESSAGE_BUFFER_CAP = 2000;
  const messageBuffer: ChatMessage[] = [];

  // Per-handle send timestamps for the shared-chat rate limiter (5 msgs / 10s).
  const chatRate = new Map<string, number[]>();
  // Per-socket timestamps for public overlay actions (12 effects / 10s).
  const overlayRate = new WeakMap<object, number[]>();

  const broadcastStatus = () => io.emit("status", [...statuses.values()]);

  // Subscribe a connector's message/status streams into the hub.
  const wire = (connector: Connector) => {
    statuses.set(connector.platform, connector.status());
    connector.onMessage((m: ChatMessage) => {
      aggregator.ingest(m);
      messageBuffer.push(m);
      if (messageBuffer.length > MESSAGE_BUFFER_CAP) messageBuffer.shift();
      io.emit("message", m);
    });
    connector.onStatusChange((s: ConnectionStatus) => {
      statuses.set(s.platform, s);
      broadcastStatus();
    });
  };

  for (const connector of connectors) wire(connector);

  /**
   * Add (or replace) a connector AFTER startup — used when an account connects
   * via OAuth so we spin up a live chat reader for its channel. Stops any
   * existing connector for the same platform first, then wires + starts it.
   */
  const addConnector = async (connector: Connector) => {
    const key = keyOf(connector);
    const prev = registry.get(key);
    if (prev && prev !== connector) { try { await prev.stop(); } catch { /* best-effort */ } }
    registry.set(key, connector);
    wire(connector);
    try {
      await connector.start();
      console.log(`✓ connector linked: ${key}`);
    } catch (e) {
      console.error(`✗ connector ${key} failed:`, e);
    }
    broadcastStatus();
  };

  // Broadcast the real stats snapshot every 2s.
  const statsTimer = setInterval(() => io.emit("stats", aggregator.snapshot()), 2000);

  const overlayRoom = (room: unknown) => {
    const clean = String(room ?? "")
      .replace(/[^\w:-]/g, "")
      .slice(0, 80);
    return clean || "market-bubble-live";
  };
  const overlayTopic = (room: string) => `overlay:${room}`;
  const overlayKinds = new Set<OverlayActionKind>(["vote", "emote", "ticker", "color", "clip", "soundwave", "spotlight", "boss"]);
  const cleanText = (value: unknown, fallback: string, max = 80) =>
    String(value ?? fallback)
      .replace(/[\x00-\x1f\x7f]/g, "")
      .trim()
      .slice(0, max) || fallback;
  const cleanOverlayAction = (event: OverlayEngagementEvent): OverlayEngagementEvent | null => {
    if (!event || !overlayKinds.has(event.kind)) return null;
    const room = overlayRoom(event.room);
    const cost = Number.isFinite(event.cost) ? Math.max(0, Math.min(10_000, Math.round(event.cost))) : 0;
    const damage = Number.isFinite(event.payload?.damage) ? Math.max(0, Math.min(100, Math.round(event.payload!.damage!))) : undefined;
    const color = typeof event.payload?.color === "string" && /^#[0-9a-fA-F]{6}$/.test(event.payload.color) ? event.payload.color : undefined;
    const side = event.payload?.side === "bull" || event.payload?.side === "bear" ? event.payload.side : undefined;

    return {
      id: cleanText(event.id, `${Date.now()}-${Math.random().toString(36).slice(2)}`, 96),
      room,
      actionId: cleanText(event.actionId, event.kind, 48),
      kind: event.kind,
      label: cleanText(event.label, "Overlay Action", 48),
      user: cleanText(event.user, "bubbleguest", 32),
      cost,
      at: Number.isFinite(event.at) ? event.at : Date.now(),
      payload: {
        side,
        ticker: cleanText(event.payload?.ticker, "BTC", 12).toUpperCase(),
        emote: cleanText(event.payload?.emote, "W", 16),
        message: cleanText(event.payload?.message, "", 72),
        color,
        damage,
      },
    };
  };
  const allowOverlayAction = (socketKey: object) => {
    const now = Date.now();
    const hist = (overlayRate.get(socketKey) ?? []).filter((t) => now - t < 10_000);
    if (hist.length >= 12) return false;
    hist.push(now);
    overlayRate.set(socketKey, hist);
    return true;
  };

  io.on("connection", (socket) => {
    // Joining client gets the current health + stats + past streams immediately,
    // plus the stream's recent chat backlog so a refresh doesn't blank the feed.
    socket.emit("status", [...statuses.values()]);
    socket.emit("stats", aggregator.snapshot());
    socket.emit("history", history.all());
    for (const m of messageBuffer) socket.emit("message", m);

    socket.on("moderate", async (req) => {
      const result = await moderate(req);
      socket.emit("moderation:result", result);
    });

    // Viewer QR controls: OBS browser source joins a room, phone page publishes
    // an effect, and the hosted backend relays it to every source in that room.
    socket.on("overlay:join", (room) => {
      void socket.join(overlayTopic(overlayRoom(room)));
    });

    socket.on("overlay:action", (event) => {
      if (!allowOverlayAction(socket)) return;
      const clean = cleanOverlayAction(event);
      if (!clean) return;
      io.to(overlayTopic(clean.room)).emit("overlay:action", clean);
    });

    // Login-with-X shared chat: a verified viewer posts into the unified feed.
    // The signed token proves their X identity (no spoofing); we rate-limit,
    // sanitize, then fan the message out to every connected client.
    socket.on("chat", (req) => {
      const id = verifyChatToken(req?.token ?? "");
      if (!id) return; // not signed in / tampered token — silently drop
      const text = String(req?.text ?? "").replace(/[\x00-\x1f\x7f]/g, "").trim().slice(0, 240);
      if (!text) return;
      const now = Date.now();
      const hist = (chatRate.get(id.handle) ?? []).filter((t) => now - t < 10_000);
      if (hist.length >= 5) return; // > 5 messages in 10s — throttle
      hist.push(now);
      chatRate.set(id.handle, hist);

      const m: ChatMessage = {
        id: `x:viewer:${id.handle}:${now}:${Math.random().toString(36).slice(2, 7)}`,
        platform: "x",
        channel: `@${id.handle}`,
        username: id.name || id.handle,
        message: text,
        timestamp: now,
        avatar: id.avatar,
        color: "#1d9bf0",
        badges: [{ type: "verified", label: "X" }],
      };
      aggregator.ingest(m);
      messageBuffer.push(m);
      if (messageBuffer.length > MESSAGE_BUFFER_CAP) messageBuffer.shift();
      io.emit("message", m);
    });

    socket.on("clip:create", async (clip: Clip) => {
      const url = await createClip(clip);
      if (url) io.emit("clip:created", clip.id, url);
    });

    socket.on("command:run", async (button, target) => {
      for (const platform of button.platforms) {
        await moderate({ platform, username: target, action: { kind: "slow", seconds: 0 } });
      }
    });
  });

  return {
    broadcastStatus,
    addConnector,
    stop: () => clearInterval(statsTimer),
  };
}
