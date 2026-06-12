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
import { twitchViewers, kickChannel, youtubeViewers, twitchFollowers } from "./stats/viewers.ts";
import { mountAuth, getAccounts, getToken, refreshToken, verifyChatToken } from "./auth.ts";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { getTwitchChannel } from "./twitchChannel.ts";
import { getMarketData, getPriceHistory, getLeaderboards, getHlWallet, getEvmWallet, getNews, getVaults } from "./marketData.ts";
import { resolveXVod, proxyHls } from "./xVod.ts";
import { broadcastChatBatch, normalizeBroadcastId, resolveBroadcastChat, XBroadcastChatConnector } from "./xBroadcastChat.ts";

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

// Real Twitch channel feed (live status + VODs + clips) for the embeds.
app.get("/api/twitch/channel/:login", async (req, res) => {
  try {
    const data = await getTwitchChannel(req.params.login);
    if (!data) return res.status(404).json({ error: "unavailable" });
    res.set("Cache-Control", "public, max-age=60");
    res.json(data);
  } catch {
    res.status(502).json({ error: "twitch fetch failed" });
  }
});

// X broadcast replay (VOD) — resolve a broadcast id to a proxied HLS master URL.
// Guest-only (no login, no ban risk); full episode video plays in our own player.
app.get("/api/x-vod/:id", async (req, res) => {
  try {
    const v = await resolveXVod(req.params.id);
    if (!v) return res.status(404).json({ error: "unavailable" });
    res.set("Cache-Control", "public, max-age=300");
    res.json({ master: `/api/x-hls?u=${encodeURIComponent(v.master)}`, title: v.title, state: v.state });
  } catch {
    res.status(502).json({ error: "x vod failed" });
  }
});

// HLS proxy for the pscp.tv playlists + segments (adds the Referer the CDN needs).
app.get("/api/x-hls", async (req, res) => {
  try {
    const out = await proxyHls(String(req.query.u ?? ""));
    if (!out) return res.status(400).end();
    res.status(out.status);
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", out.contentType);
    res.set("Cache-Control", "public, max-age=60");
    res.send(out.body);
  } catch {
    res.status(502).end();
  }
});

// Real GUEST X broadcast chat (no login, zero ban risk) — returns real public
// chat messages from an X broadcast so the frontend can show real X chat in the
// unified feed even in demo mode.
app.get("/api/x-broadcast-chat/:id", async (req, res) => {
  try {
    const data = await broadcastChatBatch(req.params.id);
    res.set("Cache-Control", "public, max-age=300");
    res.json(data);
  } catch {
    res.status(502).json({ error: "x chat fetch failed" });
  }
});

// Real crypto headlines (CoinDesk/Cointelegraph/Decrypt/The Block RSS) — scored.
app.get("/api/news", async (_req, res) => {
  try {
    const data = await getNews();
    res.set("Cache-Control", "public, max-age=120");
    res.json(data);
  } catch {
    res.status(502).json({ error: "news fetch failed" });
  }
});

// Real Hyperliquid vaults (top TVL) — replaces the demo 13F portfolios.
app.get("/api/vaults", async (_req, res) => {
  try {
    const data = await getVaults();
    res.set("Cache-Control", "public, max-age=300");
    res.json(data);
  } catch {
    res.status(502).json({ error: "vaults fetch failed" });
  }
});

// Live market data (CoinGecko / Yahoo / alternative.me / Polymarket) for the Market tab.
app.get("/api/market", async (_req, res) => {
  try {
    const data = await getMarketData();
    res.set("Cache-Control", "public, max-age=120");
    res.json(data);
  } catch {
    res.status(502).json({ error: "market fetch failed" });
  }
});

app.get("/api/evm-wallet", async (req, res) => {
  try {
    const id = String(req.query.id ?? "");
    if (!id) return res.status(400).json({ error: "id (address or ENS) required" });
    res.set("Cache-Control", "public, max-age=300");
    res.json(await getEvmWallet(id));
  } catch {
    res.status(502).json({ error: "evm wallet fetch failed" });
  }
});

app.get("/api/hl-wallet", async (req, res) => {
  try {
    const addr = String(req.query.addr ?? "");
    if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return res.status(400).json({ error: "valid addr required" });
    res.set("Cache-Control", "public, max-age=120");
    res.json(await getHlWallet(addr));
  } catch {
    res.status(502).json({ error: "wallet fetch failed" });
  }
});

app.get("/api/leaderboards", async (_req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=600");
    res.json(await getLeaderboards());
  } catch {
    res.status(502).json({ error: "leaderboards fetch failed" });
  }
});

app.get("/api/price-history", async (req, res) => {
  try {
    const sym = String(req.query.sym ?? "");
    if (!sym) return res.status(400).json({ error: "sym required" });
    res.set("Cache-Control", "public, max-age=1800");
    res.json(await getPriceHistory(sym));
  } catch {
    res.status(502).json({ error: "history fetch failed" });
  }
});

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
  const xBroadcastId = normalizeBroadcastId(process.env.X_BROADCAST_ID);
  if (xBroadcastId) {
    connectors.push(new XBroadcastChatConnector(xBroadcastId, process.env.X_BROADCAST_LABEL || "X Broadcast"));
  }
  if (process.env.YOUTUBE_VIDEO_ID && process.env.YOUTUBE_API_KEY) {
    connectors.push(new YouTubeConnector({ videoId: process.env.YOUTUBE_VIDEO_ID, apiKey: process.env.YOUTUBE_API_KEY }));
  }
  return connectors;
}

/** Poll the real platform APIs for live viewer counts into the aggregator.
 *  Channels come from the CONNECTED accounts (any account, summed per platform),
 *  with env channels as an optional fallback — nothing is hard-coded. */
// Follower totals per platform from the previous poll — new follows are the
// positive delta between ticks (first tick just sets the baseline).
const lastFollowers: Partial<Record<string, number>> = {};
// Twitch ad-schedule polling state: account id → broadcaster id / last_ad_at.
const twitchIds = new Map<string, string>();
const lastAdAt = new Map<string, string>();
function bumpFollows(p: "twitch" | "kick" | "youtube" | "x", total: number) {
  const prev = lastFollowers[p];
  if (prev != null && total > prev) aggregator.addFollows(p, total - prev);
  lastFollowers[p] = total;
}

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
    // Twitch ad breaks: poll the Ad Schedule of each OAuth-connected broadcaster
    // (their user token; needs the channel:read:ads scope — accounts connected
    // before the scope was added just 401 silently). When last_ad_at advances,
    // record an ad break with the current live viewers as impressions.
    if (TWITCH_CLIENT_ID) {
      for (const acc of connected.filter((a) => a.platform === "twitch")) {
        const tok = getToken(acc.id);
        if (!tok) continue;
        try {
          let bid = twitchIds.get(acc.id);
          if (!bid) {
            const u = await fetch("https://api.twitch.tv/helix/users", { headers: { "Client-Id": TWITCH_CLIENT_ID, Authorization: `Bearer ${tok}` } });
            bid = ((await u.json()) as { data?: { id?: string }[] })?.data?.[0]?.id;
            if (bid) twitchIds.set(acc.id, bid);
          }
          if (!bid) continue;
          const r = await fetch(`https://api.twitch.tv/helix/channels/ads?broadcaster_id=${bid}`, { headers: { "Client-Id": TWITCH_CLIENT_ID, Authorization: `Bearer ${tok}` } });
          if (!r.ok) continue; // 401 = token lacks channel:read:ads
          const lastAd = ((await r.json()) as { data?: { last_ad_at?: string }[] })?.data?.[0]?.last_ad_at;
          const prev = lastAdAt.get(acc.id);
          if (lastAd && prev !== undefined && lastAd !== prev && lastAd !== "") aggregator.recordAdBreak("twitch");
          if (lastAd !== undefined) lastAdAt.set(acc.id, lastAd);
        } catch { /* best-effort */ }
      }
    }
    // Kick: one call per channel gets viewers AND follower totals (curl-first —
    // Cloudflare blocks Node fetch's TLS fingerprint on kick.com).
    const kk = channelsFor("kick");
    if (KICK_CHANNEL && !kk.includes(KICK_CHANNEL.toLowerCase())) kk.push(KICK_CHANNEL.toLowerCase());
    if (kk.length) {
      let total = 0; let fTotal = 0; let fOk = true;
      for (const ch of kk) {
        const d = await kickChannel(ch);
        if (d) { total += d.viewers; fTotal += d.followers; } else fOk = false;
      }
      aggregator.setViewers("kick", total);
      if (fOk) bumpFollows("kick", fTotal);
    }
    // YouTube concurrent viewers — now correctly attributed to the youtube slot.
    if (YOUTUBE_VIDEO_ID && YOUTUBE_API_KEY) {
      const v = await youtubeViewers(YOUTUBE_VIDEO_ID, YOUTUBE_API_KEY);
      if (v != null) aggregator.setViewers("youtube", v);
    }
    // Twitch follower totals (decapi.me, no auth) — diffed into followsGained.
    if (tw.length) {
      let fTotal = 0; let fOk = true;
      for (const ch of tw) {
        const f = await twitchFollowers(ch);
        if (f != null) fTotal += f; else fOk = false;
      }
      if (fOk) bumpFollows("twitch", fTotal);
    }
  };
  tick();
  return setInterval(tick, 15_000); // platform APIs are rate-limited; 15s is plenty
}

async function main() {
  const connectors = buildConnectors();
  const hub = bindHub(io, connectors, aggregator, history);

  app.post("/api/x-broadcast-chat/watch", async (req, res) => {
    const id = normalizeBroadcastId(req.body?.url ?? req.body?.id ?? req.body?.broadcastId);
    if (!id) return res.status(400).json({ error: "valid X broadcast URL or ID required" });

    try {
      const access = await resolveBroadcastChat(id);
      if (!access) return res.status(404).json({ error: "X broadcast chat is unavailable or the broadcast has ended without replay chat access" });
      const batch = await broadcastChatBatch(id);
      const label = access.title || batch.title || `X Broadcast ${id}`;
      await hub.addConnector(new XBroadcastChatConnector(id, label));
      res.json({ ok: true, id, title: label, messages: batch.messages.length });
    } catch (e) {
      res.status(502).json({ error: `x broadcast watch failed: ${e instanceof Error ? e.message : String(e)}` });
    }
  });

  // Auto-start a live chat reader for EACH connected account (any account — not
  // a hard-coded list): Twitch/Kick read by channel name (anonymous), YouTube
  // uses the account's OAuth token to find its own active live broadcast. X is a
  // tweet filtered-stream (app-level), so it stays env-configured.
  const linked = new Set<string>(); // account ids that already have a live chat reader
  // Channels already watched by an env-configured connector — so the OAuth
  // account flow never double-subscribes (which would show every message twice).
  const watched = new Set<string>();
  if (process.env.TWITCH_CHANNEL) watched.add(`twitch:${process.env.TWITCH_CHANNEL.toLowerCase()}`);
  if (process.env.KICK_CHANNEL) watched.add(`kick:${process.env.KICK_CHANNEL.toLowerCase()}`);
  const syncAccountConnectors = () => {
    for (const a of getAccounts()) {
      if (!a.connected || linked.has(a.id)) continue;
      const channel = a.handle.replace(/^@/, "").toLowerCase();
      if ((a.platform === "twitch" || a.platform === "kick") && watched.has(`${a.platform}:${channel}`)) {
        linked.add(a.id); // already covered by an env connector — don't duplicate
        continue;
      }
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
      if (a.platform === "twitch" || a.platform === "kick") watched.add(`${a.platform}:${channel}`);
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

  // ---- Tipping wallet registry ----------------------------------------------
  // A signed-in viewer (Login with X) registers the EVM address they connected,
  // authenticated by their HMAC chat token — so only the real @handle can set
  // its own tip address. The map is broadcast to every client, which is what
  // makes a name show the 💰 "tippable" icon in chat. Non-custodial: tips are
  // direct wallet→wallet transfers; the server only stores public addresses.
  const WALLETS_FILE = process.env.WALLETS_FILE ?? "data/wallets.json";
  let wallets: Record<string, string> = {};
  try { wallets = JSON.parse(readFileSync(WALLETS_FILE, "utf8")); } catch { /* first run */ }
  const persistWallets = () => { try { mkdirSync(dirname(WALLETS_FILE), { recursive: true }); writeFileSync(WALLETS_FILE, JSON.stringify(wallets, null, 2)); } catch { /* best-effort */ } };

  app.post("/api/wallet/register", (req, res) => {
    const id = verifyChatToken(String(req.body?.token ?? ""));
    if (!id) return res.status(401).json({ error: "sign in with X first" });
    const handle = id.handle.replace(/^@/, "").toLowerCase();
    const address = req.body?.address == null ? null : String(req.body.address);
    if (address === null) {
      delete wallets[handle]; // tips toggled off / wallet disconnected
    } else {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return res.status(400).json({ error: "invalid EVM address" });
      wallets[handle] = address;
    }
    persistWallets();
    io.emit("wallets", wallets);
    res.json({ ok: true, tippable: address !== null });
  });
  io.on("connection", (s) => s.emit("wallets", wallets));

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
