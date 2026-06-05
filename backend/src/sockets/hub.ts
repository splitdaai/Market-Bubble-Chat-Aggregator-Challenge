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
  const registry = new Map<string, Connector>(connectors.map((c) => [c.platform, c]));
  const moderate = makeModerationRouter(registry);
  const statuses = new Map<string, ConnectionStatus>();

  const broadcastStatus = () => io.emit("status", [...statuses.values()]);

  for (const connector of connectors) {
    statuses.set(connector.platform, connector.status());
    connector.onMessage((m: ChatMessage) => {
      aggregator.ingest(m);
      io.emit("message", m);
    });
    connector.onStatusChange((s: ConnectionStatus) => {
      statuses.set(s.platform, s);
      broadcastStatus();
    });
  }

  // Broadcast the real stats snapshot every 2s.
  const statsTimer = setInterval(() => io.emit("stats", aggregator.snapshot()), 2000);

  io.on("connection", (socket) => {
    // Joining client gets the current health + stats + past streams immediately.
    socket.emit("status", [...statuses.values()]);
    socket.emit("stats", aggregator.snapshot());
    socket.emit("history", history.all());

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
    stop: () => clearInterval(statsTimer),
  };
}
