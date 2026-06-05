import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type { ServerToClientEvents, ClientToServerEvents } from "../../shared/types.ts";
import type { Connector } from "./platforms/types.ts";
import { TwitchConnector } from "./platforms/twitch.ts";
import { KickConnector } from "./platforms/kick.ts";
import { XConnector } from "./platforms/x.ts";
import { bindHub } from "./sockets/hub.ts";
import { StatsAggregator } from "./stats/aggregator.ts";
import { HistoryStore } from "./history/store.ts";
import { twitchViewers, kickViewers, youtubeViewers } from "./stats/viewers.ts";
import { mountAuth, getAccounts } from "./auth.ts";

const PORT = Number(process.env.PORT ?? 4000);
// Non-wildcard CORS allowlist in production (comma-separated origins); "*" only
// as a local-dev default. e.g. CORS_ORIGIN="https://app.example,http://localhost:5184"
const ORIGIN = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()) : "*";
// The externally-reachable backend URL (used to build OAuth redirect URIs).
// Auto-detected on Render (RENDER_EXTERNAL_URL); set PUBLIC_URL explicitly elsewhere.
const PUBLIC_URL = process.env.PUBLIC_URL ?? process.env.RENDER_EXTERNAL_URL ?? `http://localhost:${PORT}`;

const app = express();
app.use(cors({ origin: ORIGIN }));
app.use(express.json());
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: { origin: ORIGIN },
});

const aggregator = new StatsAggregator();
const history = new HistoryStore();
history.load();

function buildConnectors(): Connector[] {
  const connectors: Connector[] = [];
  if (process.env.TWITCH_CHANNEL) {
    connectors.push(new TwitchConnector(process.env.TWITCH_CHANNEL, process.env.TWITCH_USERNAME, process.env.TWITCH_OAUTH));
  }
  if (process.env.KICK_CHANNEL) {
    connectors.push(new KickConnector(process.env.KICK_CHANNEL, process.env.KICK_BEARER));
  }
  if (process.env.X_BEARER_TOKEN) {
    const rules = (process.env.X_STREAM_RULES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    connectors.push(new XConnector(process.env.X_BEARER_TOKEN, rules));
  }
  return connectors;
}

/** Poll the real platform APIs for live viewer counts into the aggregator. */
function startViewerPollers() {
  const tick = async () => {
    const { TWITCH_CHANNEL, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, KICK_CHANNEL, YOUTUBE_VIDEO_ID, YOUTUBE_API_KEY } = process.env;

    if (TWITCH_CHANNEL && TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET) {
      const v = await twitchViewers(TWITCH_CHANNEL, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);
      if (v != null) aggregator.setViewers("twitch", v);
    }
    if (KICK_CHANNEL) {
      const v = await kickViewers(KICK_CHANNEL);
      if (v != null) aggregator.setViewers("kick", v);
    }
    // YouTube viewers map onto the "x" slot only if you aren't also running X;
    // otherwise expose via a dedicated platform once youtube is a chat source.
    if (YOUTUBE_VIDEO_ID && YOUTUBE_API_KEY && !process.env.X_BEARER_TOKEN) {
      const v = await youtubeViewers(YOUTUBE_VIDEO_ID, YOUTUBE_API_KEY);
      if (v != null) aggregator.setViewers("x", v);
    }
  };
  tick();
  return setInterval(tick, 15_000); // platform APIs are rate-limited; 15s is plenty
}

async function main() {
  const connectors = buildConnectors();
  const hub = bindHub(io, connectors, aggregator, history);

  // Auto-start a live chat reader for each connected Twitch/Kick account, so
  // connecting via OAuth makes that channel's chat flow with no extra config.
  // (Read is anonymous — just the channel name. X is a tweet-stream and YouTube
  // has no chat connector, so those remain env-driven.)
  const linked = new Map<string, string>(); // platform -> channel currently linked
  const syncAccountConnectors = () => {
    for (const a of getAccounts()) {
      if (!a.connected || (a.platform !== "twitch" && a.platform !== "kick")) continue;
      const channel = a.handle.replace(/^@/, "").toLowerCase();
      if (linked.get(a.platform) === channel) continue;
      linked.set(a.platform, channel);
      const connector = a.platform === "twitch" ? new TwitchConnector(channel) : new KickConnector(channel);
      void hub.addConnector(connector);
    }
  };

  // OAuth connect flow — pushes the authed account list to all clients on change
  // and wires up a chat reader for any newly-connected Twitch/Kick channel.
  mountAuth(app, PUBLIC_URL, () => {
    io.emit("accounts", getAccounts());
    syncAccountConnectors();
  });
  io.on("connection", (socket) => socket.emit("accounts", getAccounts()));

  // Save the current session into history (call when a stream ends).
  app.post("/api/session/save", (req, res) => {
    const title = (req.body?.title as string) ?? `Stream ${new Date().toISOString().slice(0, 10)}`;
    const session = aggregator.toSession(title);
    history.add(session);
    io.emit("history", history.all());
    res.json({ ok: true, session });
  });

  await Promise.allSettled(
    connectors.map(async (c) => {
      try {
        await c.start();
        console.log(`✓ ${c.platform} connector started`);
      } catch (e) {
        console.error(`✗ ${c.platform} connector failed:`, e);
      }
    }),
  );

  const pollers = process.env.TWITCH_CLIENT_ID || process.env.KICK_CHANNEL || process.env.YOUTUBE_API_KEY ? startViewerPollers() : null;

  if (connectors.length === 0) {
    console.warn("⚠  No platform credentials configured — backend is idle. See .env.example.");
  }

  httpServer.listen(PORT, () => {
    console.log(`\n🎛  Market Bubble backend on http://localhost:${PORT}`);
    console.log(`   Chat connectors: ${connectors.map((c) => c.platform).join(", ") || "none"}`);
    console.log(`   Viewer pollers:  ${pollers ? "on" : "off (no API keys)"}\n`);
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
