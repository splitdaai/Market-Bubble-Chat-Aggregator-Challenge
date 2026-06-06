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
import { YouTubeConnector } from "./platforms/youtube.ts";
import { bindHub } from "./sockets/hub.ts";
import { StatsAggregator } from "./stats/aggregator.ts";
import { HistoryStore } from "./history/store.ts";
import { twitchViewers, kickViewers, youtubeViewers } from "./stats/viewers.ts";
import { mountAuth, getAccounts, getToken, refreshToken } from "./auth.ts";

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

// Visitor tracking lives entirely on the AWS edge (Caddy access logs → an
// EC2-only parser → /visits dashboard). No application code, no data in git.

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
    connectors.push(new XConnector({ bearer: process.env.X_BEARER_TOKEN, rules }));
  }
  if (process.env.YOUTUBE_VIDEO_ID && process.env.YOUTUBE_API_KEY) {
    connectors.push(new YouTubeConnector({ videoId: process.env.YOUTUBE_VIDEO_ID, apiKey: process.env.YOUTUBE_API_KEY }));
  }
  return connectors;
}

/** Poll the real platform APIs for live viewer counts into the aggregator.
 *  Channels come from the CONNECTED accounts (any account, summed per platform),
 *  with env channels as an optional fallback — nothing is hard-coded. */
function startViewerPollers() {
  const tick = async () => {
    const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, TWITCH_CHANNEL, KICK_CHANNEL, YOUTUBE_VIDEO_ID, YOUTUBE_API_KEY } = process.env;
    const connected = getAccounts().filter((a) => a.connected);
    const channelsFor = (p: string) => {
      const set = new Set(connected.filter((a) => a.platform === p).map((a) => a.handle.replace(/^@/, "").toLowerCase()));
      return [...set];
    };

    // Twitch: sum viewers across every connected Twitch channel (+ env fallback).
    const tw = channelsFor("twitch");
    if (TWITCH_CHANNEL && !tw.includes(TWITCH_CHANNEL.toLowerCase())) tw.push(TWITCH_CHANNEL.toLowerCase());
    if (tw.length && TWITCH_CLIENT_ID && TWITCH_CLIENT_SECRET) {
      let total = 0;
      for (const ch of tw) { const v = await twitchViewers(ch, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET); if (v != null) total += v; }
      aggregator.setViewers("twitch", total);
    }
    // Kick: sum across every connected Kick channel (+ env fallback).
    const kk = channelsFor("kick");
    if (KICK_CHANNEL && !kk.includes(KICK_CHANNEL.toLowerCase())) kk.push(KICK_CHANNEL.toLowerCase());
    if (kk.length) {
      let total = 0;
      for (const ch of kk) { const v = await kickViewers(ch); if (v != null) total += v; }
      aggregator.setViewers("kick", total);
    }
    // YouTube viewer count from an env video id (legacy "x" slot mapping).
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

  // Auto-start a live chat reader for EACH connected account (any account — not
  // a hard-coded list): Twitch/Kick read by channel name (anonymous), YouTube
  // uses the account's OAuth token to find its own active live broadcast. X is a
  // tweet filtered-stream (app-level), so it stays env-configured.
  const linked = new Set<string>(); // account ids that already have a live chat reader
  const syncAccountConnectors = () => {
    for (const a of getAccounts()) {
      if (!a.connected || linked.has(a.id)) continue;
      const channel = a.handle.replace(/^@/, "").toLowerCase();
      let connector: Connector | null = null;
      if (a.platform === "twitch") connector = new TwitchConnector(channel);
      else if (a.platform === "kick") connector = new KickConnector(channel);
      else if (a.platform === "youtube") {
        const tok = getToken(a.id)?.access;
        if (tok) connector = new YouTubeConnector({ oauthToken: tok, label: channel, refresh: () => refreshToken(a.id) });
      } else if (a.platform === "x") {
        const tok = getToken(a.id)?.access;
        if (tok) connector = new XConnector({ oauthToken: tok, label: channel, refresh: () => refreshToken(a.id) }); // poll this account's mentions
      }
      if (!connector) continue;
      linked.add(a.id); // each connected account gets its own reader
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

  // Accounts restored from the 30-day auth store: start their chat readers now.
  syncAccountConnectors();

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

  // Always poll — channels come from connected accounts at tick time (each tick
  // re-reads getAccounts()), so viewer counts work as accounts connect.
  const pollers = startViewerPollers();

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
