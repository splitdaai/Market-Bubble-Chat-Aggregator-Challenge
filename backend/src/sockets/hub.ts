import type { Server } from "socket.io";
import type { Connector } from "../platforms/types.ts";
import type {
  ChatMessage,
  ConnectionStatus,
  ServerToClientEvents,
  ClientToServerEvents,
  Clip,
} from "../../../shared/types.ts";
import { makeModerationRouter } from "../moderation.ts";
import { StatsAggregator } from "../stats/aggregator.ts";
import { HistoryStore } from "../history/store.ts";
import { createClip } from "../clips.ts";

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
