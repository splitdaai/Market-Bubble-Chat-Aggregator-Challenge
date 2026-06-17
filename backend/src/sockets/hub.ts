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
  OverlayCustomAsset,
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
  // Room-level pressure control keeps one OBS browser source smooth even when
  // many phones scan the same QR code at once.
  const overlayRoomRate = new Map<string, number[]>();
  const overlayActionLast = new Map<string, number>();
  const overlayVoteBuckets = new Map<string, { bull: number; bear: number; timer: ReturnType<typeof setTimeout> | null }>();

  const broadcastStatus = () => io.emit("status", [...statuses.values()]);
  const removeBufferedMessage = (messageId: unknown): string | null => {
    if (typeof messageId !== "string" || !messageId) return null;
    const index = messageBuffer.findIndex((m) => m.id === messageId);
    if (index >= 0) messageBuffer.splice(index, 1);
    io.emit("message:deleted", messageId);
    return messageId;
  };

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

  /**
   * Stop + remove a connector for a given platform/channel — used when an account
   * is disconnected (or a watched channel removed) so its chat STOPS appearing in
   * the unified feed. Also purges that channel's messages from the rolling buffer
   * and tells every connected client to drop them, so the feed reflects exactly
   * what is currently connected — never a ghost channel that lingers after removal.
   * Returns true if a connector was found and removed.
   */
  const removeConnector = async (platform: string, channel: string): Promise<boolean> => {
    const norm = (channel ?? "").replace(/^[#@]/, "").toLowerCase();
    const key = `${platform}:${norm}`;
    const c = registry.get(key);
    if (c) {
      try { await c.stop(); } catch { /* best-effort */ }
      registry.delete(key);
    }
    // Purge this channel's backlog so a refresh/late-join can't replay it, and
    // tell live clients to remove any already-rendered messages from it.
    for (let i = messageBuffer.length - 1; i >= 0; i--) {
      const m = messageBuffer[i];
      if (m.platform === platform && (m.channel ?? "").replace(/^[#@]/, "").toLowerCase() === norm) {
        messageBuffer.splice(i, 1);
        io.emit("message:deleted", m.id);
      }
    }
    // If no connector remains for this platform, clear its status entry so the
    // health row doesn't show a stale "connected" badge for a dead platform.
    if (![...registry.values()].some((r) => r.platform === platform)) {
      statuses.delete(platform);
    }
    broadcastStatus();
    return Boolean(c);
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
  const overlayKinds = new Set<OverlayActionKind>(["vote", "emote", "ticker", "color", "clip", "soundwave", "spotlight", "clear"]);
  const overlayHeroActions = new Set(["charging-bull", "bear-slash", "chart-pump", "chart-dump"]);
  const overlayKindCooldownMs: Partial<Record<OverlayActionKind, number>> = {
    clear: 150,
    clip: 800,
    color: 650,
    emote: 350,
    soundwave: 700,
    spotlight: 900,
    ticker: 100,
  };
  const cleanText = (value: unknown, fallback: string, max = 80) =>
    String(value ?? fallback)
      .replace(/[\x00-\x1f\x7f]/g, "")
      .trim()
      .slice(0, max) || fallback;
  // Cap on a relayed custom PNG so a giant base64 blob can't flood the room.
  const MAX_ASSET_SRC = 512 * 1024; // 512 KB
  const ASSET_ANIMATIONS = new Set(["float", "orbit", "impact", "scan", "rain", "pulse", "glitch"]);
  const ASSET_EFFECTS = new Set(["none", "neon", "hologram", "ember", "frost", "gold"]);
  const num = (v: unknown, def: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def;
  /**
   * Sanitize a viewer-supplied custom overlay asset for relay. Validates the
   * image source (inline data-URI or http(s) only), caps its size, clamps all
   * numeric knobs, and DROPS the unbounded `originalSrc` (the overlay renders
   * from `src` alone). Returns undefined for anything missing/oversized/bogus.
   */
  const cleanCustomAsset = (raw: unknown): OverlayCustomAsset | undefined => {
    if (!raw || typeof raw !== "object") return undefined;
    const a = raw as Record<string, unknown>;
    const src = typeof a.src === "string" ? a.src : "";
    const okSrc = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(src) || /^https:\/\//.test(src);
    if (!okSrc || src.length > MAX_ASSET_SRC) return undefined;
    const animation = ASSET_ANIMATIONS.has(String(a.animation)) ? (a.animation as OverlayCustomAsset["animation"]) : "float";
    const effect = ASSET_EFFECTS.has(String(a.effect)) ? (a.effect as OverlayCustomAsset["effect"]) : "none";
    const accent = typeof a.accent === "string" && /^#[0-9a-fA-F]{6}$/.test(a.accent) ? a.accent : "#d9a547";
    return {
      id: cleanText(a.id, `asset-${Date.now()}`, 64),
      name: cleanText(a.name, "Custom", 40),
      src,
      animation,
      effect,
      accent,
      opacity: num(a.opacity, 1, 0, 1),
      intensity: num(a.intensity, 1, 0, 4),
      speed: num(a.speed, 1, 0, 8),
      size: num(a.size, 1, 0.05, 8),
      feather: num(a.feather, 0, 0, 1),
      threshold: num(a.threshold, 0, 0, 1),
      createdAt: num(a.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
    };
  };
  const cleanOverlayAction = (event: OverlayEngagementEvent): OverlayEngagementEvent | null => {
    if (!event || !overlayKinds.has(event.kind)) return null;
    const room = overlayRoom(event.room);
    const cost = Number.isFinite(event.cost) ? Math.max(0, Math.min(10_000, Math.round(event.cost))) : 0;
    const countValue = event.payload?.count;
    const count = typeof countValue === "number" && Number.isFinite(countValue) ? Math.max(1, Math.min(10_000, Math.round(countValue))) : undefined;
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
        count,
        customAsset: cleanCustomAsset(event.payload?.customAsset),
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
  const allowOverlayBroadcast = (event: OverlayEngagementEvent) => {
    const now = Date.now();
    const hist = (overlayRoomRate.get(event.room) ?? []).filter((t) => now - t < 1000);
    if (hist.length >= 30) {
      overlayRoomRate.set(event.room, hist);
      return false;
    }

    const isHero = overlayHeroActions.has(event.actionId);
    const cooldown = isHero ? 2400 : overlayKindCooldownMs[event.kind] ?? 150;
    const key = `${event.room}:${isHero ? "hero" : event.kind}:${isHero ? "animal" : event.actionId}`;
    const last = overlayActionLast.get(key) ?? 0;
    if (now - last < cooldown) return false;

    hist.push(now);
    overlayRoomRate.set(event.room, hist);
    overlayActionLast.set(key, now);
    return true;
  };
  const emitVoteAggregate = (room: string, side: "bull" | "bear", count: number) => {
    if (count <= 0) return;
    const now = Date.now();
    io.to(overlayTopic(room)).emit("overlay:action", {
      id: `vote:${room}:${side}:${now}`,
      room,
      actionId: `crowd-${side}-pressure`,
      kind: "vote",
      label: side === "bull" ? "Bull Pressure" : "Bear Pressure",
      user: "crowd",
      cost: 0,
      at: now,
      payload: { side, count },
    });
  };
  const queueOverlayVote = (room: string, side: "bull" | "bear") => {
    let bucket = overlayVoteBuckets.get(room);
    if (!bucket) {
      bucket = { bull: 0, bear: 0, timer: null };
      overlayVoteBuckets.set(room, bucket);
    }
    bucket[side] += 1;
    if (bucket.timer) return;
    bucket.timer = setTimeout(() => {
      const next = overlayVoteBuckets.get(room);
      if (!next) return;
      emitVoteAggregate(room, "bull", next.bull);
      emitVoteAggregate(room, "bear", next.bear);
      overlayVoteBuckets.delete(room);
    }, 120);
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
      if (req.action?.kind === "delete") {
        removeBufferedMessage(req.localMessageId ?? req.messageId);
      }
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
      const side = clean.payload?.side;
      if (side === "bull" || side === "bear") {
        queueOverlayVote(clean.room, side);
      }
      if (clean.kind === "vote" && !overlayHeroActions.has(clean.actionId)) return;
      const visual = overlayHeroActions.has(clean.actionId)
        ? { ...clean, payload: { ...clean.payload, side: undefined } }
        : clean;
      if (!allowOverlayBroadcast(visual)) return;
      io.to(overlayTopic(visual.room)).emit("overlay:action", visual);
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
    removeConnector,
    stop: () => {
      clearInterval(statsTimer);
      for (const bucket of overlayVoteBuckets.values()) {
        if (bucket.timer) clearTimeout(bucket.timer);
      }
      overlayVoteBuckets.clear();
    },
  };
}
