<div align="center">

# 🫧 Market Bubble

**The real-time broadcast command center for crypto livestreams — every chat, every market, one screen.**

[**▶ Live App**](https://marketbubble-khaki.vercel.app)
&nbsp;·&nbsp;
[**⚡ 60-Second Judge Tour**](https://marketbubble-khaki.vercel.app/?tour)
&nbsp;·&nbsp;
[**Features**](#feature-guide)
&nbsp;·&nbsp;
[**Build it 1:1**](#how-its-built--subsystem-reference)
&nbsp;·&nbsp;
[**Run Locally**](#quick-start)

<p>
<img alt="Status" src="https://img.shields.io/badge/status-live-16e6a4?style=for-the-badge" />
<img alt="Frontend" src="https://img.shields.io/badge/frontend-React%2018%20·%20Vite%20·%20TS-34d6ff?style=for-the-badge" />
<img alt="Backend" src="https://img.shields.io/badge/backend-Node%20·%20Express%20·%20Socket.io-d9a547?style=for-the-badge" />
<img alt="License" src="https://img.shields.io/badge/license-proprietary-lightgrey?style=for-the-badge" />
</p>

Twitch · Kick · X · YouTube chat unified — with real emotes, cross-platform moderation, a
viewer-controlled **Interactive Overlay**, **Bubble Bucks** points economy, live Polymarket
odds, on-chain KOL tracking, full revenue analytics, X broadcast replays, OBS sources, and
non-custodial crypto tipping. Built for the **$10k Vibe Code Challenge**.

</div>

---

> **Try it in 30 seconds.** Open the [**Live App**](https://marketbubble-khaki.vercel.app) — it boots in
> **Demo mode** with a full simulated broadcast, no keys or login required. Hit the
> [**Judge Tour**](https://marketbubble-khaki.vercel.app/?tour) for a guided pass, or flip the
> **Demo → Live** toggle (top-right) to run against real APIs.

## What Market Bubble Does

One screen that answers the four questions a crypto show asks while live:

1. **What is chat saying?** Unified Twitch/Kick/X/YouTube feed — source badges, real emotes, auto-mod, search, sentiment, per-user profiles, cross-platform moderation.
2. **What's the market doing?** Live crypto/indices/commodities, Fear & Greed, Polymarket odds, a sentiment-scored headlines feed, and an on-chain KOL/smart-money tracker.
3. **What should the show do next?** Producer Brief, Clip Radar, topic/ticker spikes, host prompts.
4. **What goes on stream?** OBS chat source, transparent overlays, an operator dock, and a viewer-driven Interactive Overlay (Bubble Bucks).

Everything visible in **Demo** is the real UI on simulated data; **Live** runs the same surfaces on real APIs with graceful failover so the board never blanks.

## Live & OBS Routes

| Route | Purpose |
| --- | --- |
| `/` | Full dashboard (Simple stock layout → "Pro" reveals all tabs) |
| `/?tour` | Auto-starts the 60-second guided Judge Tour |
| `/?broadcast=1` | Clean **Chat Only** OBS browser source (chrome-free) |
| `/?broadcast=1&stage=1` | Staged Chat Only preview (show frame + Demo/Live toggle) |
| `/?overlay=1` | Transparent **Interactive Overlay** browser source (effects + QR) |
| `/?dock=1` | Compact operator **dock** for inside OBS |
| `/engage` | Viewer engagement page (scan QR → spend Bubble Bucks → fire effects) |

Chat-only query options: `&bg=transparent`, `&platform=twitch,kick`, `&fontsize=18`, `&messages=80`. Overlay/engage accept `&room=<name>` for multi-stream isolation.

---

## Feature Guide

| Feature | How it works | How to use it |
| --- | --- | --- |
| **Unified chat feed** | Twitch, Kick, X, YouTube messages normalized into one `ChatMessage` shape with platform badges, streamer attribution, timestamps, moderation state, and per-user history. | Use the feed filters (platform / hosts / mentions / tickers / search). Stay at bottom to pin to live; scroll up to read history. |
| **Real emotes** | 7TV + BTTV + FFZ (global **and** per-channel) + classic Twitch + Kick emotes resolve and render inline. Twitch from IRC tags; Kick from message metadata / numeric tokens. | Connect or watch a Twitch/Kick channel — emotes render automatically. |
| **Auto-mod** | A leetspeak-tolerant banned-word pass runs before render: hard slurs dropped, profanity masked. | Always on. No config needed. |
| **Cross-platform moderation** | Click a name → ban / timeout (stackable 1m–1d) / remove on every connected platform at once. Live enforcement uses backend OAuth scopes. | Click a viewer in chat or the user list, choose an action. |
| **Interactive Overlay** | Viewers scan a QR, spend **Bubble Bucks**, and fire real on-screen effects (charging bull, green/red candle, emote storms, bull/bear vote meter, spotlight, ticker tape, custom PNGs). Relayed phone → backend → OBS source with two-layer rate-limiting. | Add `/?overlay=1` in OBS; viewers open the QR to `/engage`. See [Interactive Overlay](#interactive-overlay--bubble-bucks). |
| **Bubble Bucks (User Points)** | Watch-&-earn economy: points per minute watched, per message, per sub, per dollar supported. Spent on overlay effects; ranked on leaderboards; shown in chat. | Earned automatically from activity; spend on the engage page. |
| **Live stats** | Cheap per-message ingest + a timed tick rebuild → combined viewers, active chatters, msg/min, engagement, per-platform → per-channel breakdowns, trend sparklines. | Watch the Live Stats panel and per-streamer cards. |
| **Revenue analytics** | Tracks bits, subs, Kicks, Super Chats, memberships, tips, and **estimated ad revenue** (tracked ad breaks × live impressions × net CPM) + new followers. Per-stream averages + A/B compare. | Open the Analytics tab. Demo seeds history; Live uses backend history. |
| **Polymarket panel** | Live markets from Polymarket's public API — trending / breaking / categories, Yes/No odds, 24h volume. | Browse, click to open the real market, or pin to the overlay. |
| **KOL smart-money tracker** | Real Hyperliquid leaderboard (filtered to live perp accounts), vaults by TVL, verified KOL wallets. Click a trader for a live account-value chart, open positions, and fills with realized PnL. | Open the KOL tab; click any trader. |
| **Intelligence feed** | Real headlines (CoinDesk, Cointelegraph, Decrypt, The Block) sentiment-scored with impact + ticker tags, refreshed every 5 min. | Use during prep/live to pick show topics. |
| **Producer Brief** | Live host rundown derived from the last few minutes of chat: topics, tickers in play, room mood, a suggested host question, the last clip-worthy spike, Polymarket chatter. | Keep visible for host direction / transitions. |
| **Stream preview + replays** | Center-stage player with source switching; plays full **X broadcast replays** via guest HLS (no login, zero account risk). Most recent autoplays when nothing is live. | Pick an episode from the Broadcasts list. |
| **Clip Radar** | Multi-signal chat-velocity spike detection (hype / roast / ticker drop / dono-rain) flags clip-worthy windows. | Watch for alerts; capture with chat context. |
| **Giveaway** | Pools eligible entries across platforms; animated winner draw with 60/120/180s or custom auto-draw timer. | Start a giveaway, set the keyword, run the draw. |
| **Crypto tipping** | Non-custodial **USDC/USDT** tips to wallet-linked viewers across Ethereum, Base, Arbitrum, Optimism, Polygon. Every transfer signed in the user's own wallet. | Connect a wallet, click a tippable viewer, approve. |
| **Visual editor + theme editor** | Drag/drop/resize/snap every panel (persists locally). CSS-variable theming with 9 presets (default: warm "On Air"). | Hit Edit to rearrange; open the Theme Editor to restyle. |
| **OBS integration** | Chat-only source, transparent overlay, operator dock, plus an OBS WebSocket v5 client that adds browser sources for you. | See [OBS Usage](#obs-usage). |

---

## Interactive Overlay & Bubble Bucks

A viewer-driven, on-stream effects system with a points economy. Three layers:

- **Engage page** (`/engage`) — viewers scan a QR, see their Bubble Bucks balance, and tap to fire effects.
- **OBS overlay** (`/?overlay=1`) — a transparent browser source that renders the effects on stream.
- **Relay** — events travel phone → backend → overlay over Socket.io rooms (`overlay:<room>`), with a BroadcastChannel + localStorage fallback for same-origin/no-socket cases.

**Effect catalog** (`lib/overlayEngagement.ts` — 24 built-ins + custom):
- **Hero** (vote-kind): `charging-bull`, `bear-slash`, `chart-pump`, `chart-dump` — full-screen cinematic animations (framer-motion + SVG + canvas + Web Audio), with impact rings, debris, lens streaks, vignettes.
- **Emote bursts**: branded (Ansem/Banks/NELK/Happy Dad/Polymarket) + meme text (WAGMI/NGMI/COPE/SEND IT/💎🙌/MOON/DOGE) + `whale-storm` premium shower.
- **Utility**: `ticker-boost` (scrolling tape), `mood-wave` (color wash), `spotlight` (viewer's message on screen), `clip-boost`, `soundwave`, `clear-overlay`.
- **Bull/Bear vote meter**: votes aggregate (120ms window) into a live sentiment bar.
- **Custom PNGs**: upload any image → an edge-detection cutout makes it transparent → becomes a tappable effect with animation (float/orbit/impact/scan/rain/pulse/glitch) and style (neon/hologram/ember/frost/gold). Configured in the **FX Lab** (`OverlayFxLab.tsx`), which also tunes every built-in (duration, intensity, density, scale, blur, audio, motion flavor, accent). Profiles persist to localStorage.

**Bubble Bucks economy** (`lib/bucks.ts`, `store/bucksLedgerStore.ts`): `perMinute:1, perMessage:1, perSub:100, perDollar:5`. Balance = earned − spent; a throttled lifetime ledger persists locally (flushes every 12s and on spend/unload). `computeRanks()` builds tie-aware leaderboards.

**Rate-limiting (two layers):** client gates before sending (12 events / 10s per room, per-action cooldowns); the backend re-validates (12/socket/10s, 30/room/sec, per-kind cooldowns, hero 2400ms) and silently drops abuse. Works the same in Demo (local balance) and Live (balance derived from real stats).

Key files: `lib/overlayEngagement.ts`, `lib/overlayFx.ts`, `lib/bucks.ts`, `store/{overlayStore,bucksLedgerStore}.ts`, `components/{OverlayEngagementLayer,EngagePage,OverlayFxLab,OverlayPage}.tsx`, backend `sockets/hub.ts` (`overlay:join` / `overlay:action`).

---

## Demo and Live Mode

The app is explicit about data mode — controlled by `VITE_BACKEND_URL` and the top-bar toggle.

- **Demo** (default, no backend): a self-contained mock firehose drives chat, viewers, analytics history, and demo accounts (the Ansem / Banks / Market Bubble trio). No keys needed — ideal for review.
- **Live** (`VITE_BACKEND_URL` set + backend running): the frontend consumes real `message` / `status` / `accounts` / `stats` / `history` / `wallets` socket events. Real platform connections, watched channels, server-side OAuth, moderation, and clips. **No demo chat leaks into Live.**

---

## Architecture

A small TypeScript monorepo with a shared contract:

```text
market-bubble/
├── shared/types.ts   # single source of truth: message · stats · layout · socket · overlay contracts
├── frontend/         # React 18 · Vite · Tailwind · Zustand · Framer Motion · Socket.io client
│   └── src/{components, store, lib, hooks, __tests__}
└── backend/          # Node · Express · Socket.io (tsx) — connectors, stats, OAuth, guest X, markets
```

**Chat → stats data flow:**
1. `useChatConnection` mounts the pipeline. Demo runs `startMockStream`; Live connects Socket.io (`lib/socket.ts`).
2. Incoming messages are **batched** (rAF/timeout flush) so fast chat never causes one render per message.
3. `chatStore.appendMessages()` dedups, runs auto-mod, registers emotes, appends per-user history (cap 160), merges the live feed (cap 300), and caches to localStorage (12h TTL).
4. `statsStore` does **cheap-per-message ingest** + a **~1.5s tick** that rebuilds the read-model `snapshot` (velocity, active chatters, sentiment, clip detection, per-platform sparklines, leaderboards). In Live, `applyBackendStats()` overrides demo sim with real viewer/watch/ad numbers (backend emits every ~2s).
5. Dashboard widgets, overlays, and OBS routes all consume the same normalized `snapshot`.

**Security model:** OAuth client secrets + platform tokens stay server-side; the browser only sees `VITE_BACKEND_URL`. Login-with-X issues an HMAC-signed chat token (30-day TTL) — no account storage. Tipping is non-custodial. X chat/video uses **anonymous guest endpoints only** (no login, no cookie → zero ban risk).

---

## How It's Built — Subsystem Reference

Enough detail to rebuild each piece 1:1.

### Platform connectors (`backend/src/platforms/*`)
- **Twitch** — anonymous tmi.js IRC for read; OAuth token for moderation. Emotes from IRC tags; monetization from sub/resub/subgift/bits events.
- **Kick** — public Pusher WS (`chatrooms.<id>.v2`). Cloudflare blocks Node's TLS fingerprint, so the chatroom id is resolved via a `curl` subprocess (browser UA) with a fetch fallback. Subs / gifted-subs / Kicks ride the same socket (~$4.74/sub, ~$0.01/Kick).
- **X** — two modes: per-account mentions polling (OAuth) or app-level filtered stream (`X_BEARER_TOKEN` + rules). Read-only.
- **YouTube** — `liveChat/messages` long-poll (honors `pollingIntervalMillis`); video id from API key or the account's active broadcast. Super Chats / Stickers / memberships parsed for revenue.

### Guest X broadcast chat + VOD (zero ban risk) — `xBroadcastChat.ts`, `xVod.ts`
Anonymous chain: `guest/activate.json` (public web bearer) → `broadcasts/show.json` → `live_video_stream/status/<media_key>` → Periscope `accessChatPublic` → `chatapi/v1/history` (replay) or `chatapi/v1/chatnow` WS (live). Video: the `.m3u8` master is proxied through `/api/x-hls` (SSRF-guarded to `*.pscp.tv`, adds the `Referer: https://x.com` the CDN requires, rewrites playlist URIs back through the proxy). No account, no cookie — read-only public data.

### Stats aggregator (`backend/src/stats/`)
In-memory per-platform state emitted as `AggregateStats` every ~2s. Viewer pollers (every 15s): Twitch Helix `streams` + ad-schedule (`channels/ads` → ad breaks), Kick channel API (curl-first), YouTube `liveStreamingDetails`. Followers diffed from `decapi.me` / Kick. Watch-time accrues `viewers × dt`.

### Markets (`backend/src/marketData.ts`)
CoinGecko → **Kraken fallback** → last-good cache (never blanks). Yahoo Finance for indices/commodities; alternative.me for Fear & Greed; Polymarket gamma + leaderboard APIs; Hyperliquid `info` + `stats-data` (leaderboard filtered to active perp accounts, vaults by TVL, per-wallet positions/fills/chart); ENS + Blockscout for EVM wallets; 4 RSS feeds for the scored news.

### Frontend libs (`frontend/src/lib/`)
`emotes.ts` (provider resolution + global map), `automod.ts` (BLOCK/MASK + leet normalization), `revenue.ts` (per-platform sub $ + ad CPM model), `sentiment.ts` (lexicon mood scoring), `analytics.ts` (`buildLiveSession` + on-pace projection capped 15×, per-stream average), `viewerWallets.ts` (tip registry, deterministic demo addresses), `marketFallback.ts` (offline market data), `theme.ts` (9 presets, CSS-var application), `accounts.ts` (the demo trio), `socket.ts` / `mockData.ts` (transport).

### Zustand stores (`frontend/src/store/` — 25)
`chat`, `stats`, `analytics`, `connections`, `mode`, `theme`, `viewer`, `wallet`, `giveaway`, `clips`, `bucksLedger`, `overlay`, `broadcast`, `moderation`, `watchlist`, `audio`, `ui`, `uiMode`, `view`, `preview`, `tour`, `userCard`, `twitch`, `toast`. Each owns one slice; most persist to namespaced localStorage.

### Backend HTTP API (`backend/src/index.ts`)

| Method · Path | Returns | Source · Cache |
| --- | --- | --- |
| `GET /health` | `{ ok, ts }` | — |
| `GET /api/market` | global · narratives · movers · gauges · polymarket | CoinGecko/Kraken/Yahoo/alt.me/Polymarket · 2m |
| `GET /api/price-history?sym=` | `{ points }` | CoinGecko/Yahoo · 30m |
| `GET /api/leaderboards` | hyperliquid · polymarket · linked | HL + Polymarket · 15m |
| `GET /api/vaults` | top vaults by TVL | HL stats-data · 10m |
| `GET /api/hl-wallet?addr=` | accountValue · positions · fills · chart · kpis | Hyperliquid · 2m |
| `GET /api/evm-wallet?id=` | holdings · totalUsd · ens | ENS + Blockscout · 5m |
| `GET /api/news` | scored headlines | 4× RSS · 5m |
| `GET /api/x-vod/:id` | `{ master, title, state }` | X guest · 10m |
| `GET /api/x-hls?u=` | HLS playlist/segment | pscp.tv proxy · 60s |
| `GET /api/x-broadcast-chat/:id` | real broadcast chat messages | X guest · 30m |
| `GET /api/twitch/channel/:login` | live · vods · clips | Helix · 60s |
| `POST /api/wallet/register` | `{ ok, tippable }` | HMAC chat-token auth |
| `POST /auth/watch` | `{ ok, id }` | watch a public Twitch/Kick channel |
| `GET /auth/:platform/start` · `/callback` | OAuth flow | Twitch/YouTube/X/Kick |
| `POST /api/session/save` | rolls up + persists a `StreamSession` | — |
| `GET/POST /api/visit` | `204` | origin-allowlisted analytics beacon |

**Socket events** — S→C: `message`, `message:deleted`, `status`, `stats`, `moderation:result`, `clip:created`, `history`, `accounts`, `wallets`, `overlay:action`. C→S: `moderate`, `chat`, `clip:create`, `overlay:join`, `overlay:action`. Rate-limited via `rateLimit.ts` (IP token buckets) + per-room/socket overlay gates.

---

## Quick Start

**Prerequisites:** Node.js 18+, npm. Optional: OBS Studio (WebSocket enabled), platform developer apps for OAuth.

**Frontend (Demo — no backend or keys):**
```bash
cd frontend
npm install
npm run dev        # → http://localhost:5184
```

**Backend (Live data):**
```bash
cd backend
npm install
cp ../.env.example .env     # fill in only the platforms you want — all optional, degrades gracefully
npm run dev                 # → http://localhost:4000
```
Then in `frontend/.env` set `VITE_BACKEND_URL=http://localhost:4000`, restart Vite, and flip the UI to **Live**. Each platform needs its dev-app Client ID/Secret in `backend/.env`; callback URLs are `${PUBLIC_URL}/auth/<platform>/callback`. See [OAUTH_SETUP.md](./OAUTH_SETUP.md).

## Platform Setup (env reference)

OAuth is optional — configure only what you need. The app degrades gracefully (any unconfigured platform is simply absent in Live).

| Platform | Chat | Viewers | Moderation | Clips |
| --- | --- | --- | --- | --- |
| **Twitch** | `TWITCH_CHANNEL` (+ `TWITCH_USERNAME`/`TWITCH_OAUTH` for mod) | `TWITCH_CLIENT_ID`/`SECRET` | same as chat (scopes) | `TWITCH_USER_TOKEN` + `TWITCH_BROADCASTER_ID` |
| **Kick** | `KICK_CHANNEL` (public) | `KICK_CHANNEL` | `KICK_BEARER` or OAuth | — |
| **X** | `X_BEARER_TOKEN` + `X_STREAM_RULES`; guest broadcast needs no keys | — | — | — |
| **YouTube** | `YOUTUBE_VIDEO_ID` + `YOUTUBE_API_KEY` | same | — | — |
| **Login-with-X / tipping** | `X_CLIENT_ID`/`SECRET`, `CHAT_TOKEN_SECRET`, `WALLETS_FILE` | | | |
| **Server** | `PORT`, `CORS_ORIGIN` (comma-sep), `PUBLIC_URL`, `HISTORY_FILE` | | | |

The frontend only reads `VITE_BACKEND_URL` (unset/empty = Demo).

## OBS Usage

| Route | Use |
| --- | --- |
| `/?broadcast=1` | OBS Browser Source for the on-stream chat panel (start ~`880x624`). |
| `/?broadcast=1&stage=1` | Browser preview of placement + Demo/Live + Connections. |
| `/?overlay=1` | Transparent Browser Source for the Interactive Overlay (add `&qr=1` to show the engage QR). |
| `/?dock=1` | OBS → Docks → Custom Browser Docks (operator monitor, not viewer-facing). |

Disable **Shutdown source when not visible** so sources stay connected. The OBS WebSocket v5 client (Connections panel) can add these sources to the current scene for you.

## Scripts, Build & Deploy

```bash
# frontend
npm run dev      # Vite dev server
npm run build    # tsc build + production bundle → dist/
npm run preview  # serve the production build
npm test         # Vitest (money/format/web3/markets/moderation helpers)

# backend
npm run dev        # tsx watch
npm run start      # run the server
npm run typecheck  # tsc --noEmit
```

The frontend is a static Vite build (`dist/`) hostable on Vercel, S3+CloudFront, or any static host (`vercel.json` builds it for Vercel; `aws s3 sync dist/ s3://<bucket>/ --delete` for S3). Live mode also needs a reachable backend with matching `CORS_ORIGIN` / `PUBLIC_URL`. `render.yaml` is provided for the backend.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Only demo data shows | Set `VITE_BACKEND_URL` in `frontend/.env`, restart Vite, flip to Live. |
| Live mode empty / "retrying" | Backend reachable? Browser console CORS errors? The frontend origin must be in the backend `CORS_ORIGIN`. |
| Connect buttons don't open OAuth | Provider Client ID/Secret in `backend/.env`, restart, check `/auth/config`. |
| OAuth callback fails | Callback URL must exactly equal `${PUBLIC_URL}/auth/<platform>/callback`. |
| Emotes show as text | Run backend with `DEBUG_EMOTES=1`, send a known emote, inspect the `[emotes:*]` log line. |
| OBS source not updating | Disable source shutdown; use the clean `?broadcast=1` route. |
| Overlay effects don't fire | Confirm overlay + engage share the same `&room=`; abuse is silently rate-limited. |

## Tech Stack

React 18 · Vite · TypeScript (strict) · Tailwind CSS · Zustand · TanStack Query · Framer Motion ·
react-grid-layout · Socket.io · Express · tmi.js (Twitch) · Kick Pusher · X/Periscope guest endpoints ·
OBS WebSocket v5 · EIP-1193 / ERC-20 (tipping) · Hyperliquid · Polymarket · CoinGecko / Kraken / Yahoo.

## License

Proprietary — © 2026 Market Bubble. All rights reserved. Shared for evaluation and private review only. See [LICENSE](./LICENSE).
