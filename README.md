# 🫧 Market Bubble

> The real-time **broadcast command center** for Market Bubble — Twitch + Kick + X
> + YouTube chat unified (with real emotes + cross-platform moderation), live
> **Polymarket** odds, a **KOL smart-money tracker** on real Hyperliquid wallets,
> full revenue analytics (subs · bits · Kicks · Super Chats · tips · **estimated ad
> revenue**), X broadcast replays, OBS overlays, and **non-custodial crypto tipping**
> — in a drag/drop visual dashboard. Built for the **$10k Vibe Code Challenge**.

![mode: demo + live](https://img.shields.io/badge/mode-demo%20%2B%20live-16e6a4)
![stack: React 18 · Vite · TS · Socket.io](https://img.shields.io/badge/stack-React%2018%20·%20Vite%20·%20Socket.io-34d6ff)

**Live demo:** https://marketbubble-khaki.vercel.app — runs fully in **demo mode**, no keys needed.
**⚡ 60-second Judge Tour:** https://marketbubble-khaki.vercel.app/?tour — a guided pass over the working core.
Mirror (S3): http://marketbubble-live-preview.s3-website-us-east-1.amazonaws.com

---

## ✨ Features

| Area | What it does |
|---|---|
| **Unified feed** | Twitch + Kick + X + YouTube in one stream — source badges, hover shows which streamer's chat, per-platform filters, search + Hosts/Mentions/Tickers quick filters. Stays pinned to live unless you scroll up. |
| **Real emotes** | 7TV / BTTV / FFZ (global **and** per-channel) + classic Twitch emotes render inline — channel sets auto-resolve for every connected Twitch channel. |
| **Auto-mod** | Leetspeak-tolerant banned-word engine: slurs dropped before render, profanity masked — keeps chat and hosts safe in real time. |
| **Watch any channel** | Type any Twitch/Kick channel in Connections → its real chat streams into the feed (anonymous read, no OAuth needed). |
| **KOL tracker** | Real Hyperliquid leaderboard (probed for live perp activity), real vaults by TVL, verified KOL wallets — click any trader for live account-value chart, open positions, and fills with realized PnL. |
| **Intelligence Feed** | Real headlines (CoinDesk · Cointelegraph · Decrypt · The Block), sentiment-scored with impact + ticker tags, refreshed every 5 min. |
| **Episode replays** | Full past X broadcasts play in-app via guest HLS (no login, zero account risk) — most recent autoplays when nothing is live. |
| **Producer Brief** | A live host rundown derived from chat: topics, tickers in play, room mood, a suggested host question, the last clip-worthy spike, and Polymarket chatter. |
| **Emoji composer** | Send a host message into the feed with a built-in emoji picker. |
| **Live Stats** | Combined viewers + a per-platform → per-channel breakdown with trend sparklines (toggleable), unique/active chatters, watch hours, msg/min and engagement. |
| **Polymarket panel** | Live markets from Polymarket's public API — Trending / Breaking + every category, Yes/No odds (green/red), 24h volume. Click to open the real market, or pin it to your OBS overlay. |
| **Viewer tipping** | Non-custodial **USDC / USDT** tips to wallet-connected viewers (Ethereum, Base, Arbitrum, Optimism, Polygon) — auto-switches the wallet to a supported chain. |
| **Stream preview** | Center-stage player with play/pause, a seek scrubber, per-channel switcher, and a live clip button. |
| **Past broadcasts** | A VOD library with real frame-preview thumbnails — click one to play it in the preview. |
| **Analytics** | Historical KPIs, live snapshot, trends, A/B compare — every revenue stream connected: **bits, subs, Kicks, Super Chats, memberships, tips**, plus **estimated ad revenue tied to ads actually shown** (tracked breaks × live impressions × net CPM; Twitch ad breaks polled via the Ads API). New-follower tracking included. |
| **Leaderboards** | Top Chatters + Subs ($ value per platform), filterable by Day / Week / Month / All-time. |
| **User list** | Searchable cross-platform viewer list — sort by messages / $ spent / name / recency, filter by channel, default-filtered to wallet-connected (tippable) viewers. Click a name for a Twitch-style profile + message history + moderation. |
| **Moderation** | Cross-platform timeout (stackable 1m/5m/15m/1h/1d, reduce/remove) + ban, from chat or the user card. |
| **Giveaway Bot** | Run a giveaway across all platforms at once — pooled entries + animated winner draw. |
| **Clips & Clip Radar** | Auto-detects clip-worthy chat-velocity spikes; capture clips with chat context (native-clip backend seam). |
| **OBS** | Three browser-source routes: floating viewer/chat/market **overlay** (`?overlay=1`), a compact **dock** (`?dock=1`), plus a live **OBS WebSocket v5** client to add the source for you. |
| **Visual editor** | Drag / drop / resize / snap-to-grid every panel; layout persists to localStorage. Theme editor with live CSS-variable theming. |
| **Demo / Live** | One toggle flips the whole app between a self-contained mock firehose and real backend data. |

---

## 🏗️ Architecture

An npm monorepo with a shared type contract:

```
market-bubble/
├── shared/types.ts     # single source of truth — message / stats / layout / socket contracts
├── frontend/           # React 18 + Vite + TS + Tailwind + Zustand + Framer Motion
│   └── src/
│       ├── components/ # widgets + overlays + modals
│       ├── store/      # zustand stores (chat, stats, layout, overlay, wallet, …)
│       ├── lib/        # mock firehose, socket, web3, polymarket, analytics, …
│       └── hooks/      # useChatConnection (the data pump), …
└── backend/            # Node + Express + Socket.io (tsx) — connectors, stats aggregator, OAuth, clips
```

- **Demo vs live is a single switch.** `lib/socket.ts` either starts the mock firehose (`lib/mockData.ts`) or connects to the backend over Socket.io. The rest of the app consumes the same `stats`/`message`/`accounts` events either way.
- **The stats engine is cheap-per-message, recompute-per-tick** (`store/statsStore.ts`): `ingest()` touches small accumulators; a ~1.5s `tick()` rebuilds the read-model `snapshot` the UI renders — so re-renders are bounded no matter how fast chat scrolls.
- **Secrets stay server-side.** The browser only ever sees `VITE_BACKEND_URL`; OAuth client secrets + platform tokens live in the backend. Tipping is non-custodial — every transfer is signed in the user's own wallet.

---

## 🚀 Quick start

**Frontend (demo — no backend or keys needed):**
```bash
cd frontend
npm install
npm run dev          # → http://localhost:5184
```
That's it — the whole dashboard runs on the mock firehose. Toggle **Demo → Live** in the topbar to switch to real data (needs the backend below).

**Backend (live data):**
```bash
cd backend
npm install
cp ../.env.example .env     # fill in the platforms you want (all optional, degrades gracefully)
npm run dev                 # → http://localhost:4000
```
Then set `VITE_BACKEND_URL=http://localhost:4000` for the frontend and toggle the app to **Live**. Each platform you want to connect needs a developer app registered + its Client ID/Secret in `backend/.env` (see the comments there for the exact callback URLs).

**OBS browser sources** (paste into OBS → Sources → Browser):
- Overlay: `<demo-url>/?overlay=1`
- Dock: `<demo-url>/?dock=1`

**Tests** (Vitest — pure-logic smoke tests for the money/format/web3/markets/moderation helpers):
```bash
cd frontend && npm test
```

---

## 🏆 Why this wins

1. **It's real.** Market data, leaderboards, vaults, headlines, wallets, episode
   replays, chat connectors — live APIs with graceful failover, not mockups. The
   one estimated number (ad revenue) is labeled as an estimate.
2. **It's the whole job, not just a chat merger.** Aggregation is table stakes —
   this adds moderation, monetization, market intelligence, production tooling
   (OBS overlay + dock + Producer Brief + Clip Radar), and analytics in one place.
3. **It's honest.** Demo and Live are a single explicit switch; demo never
   pretends to be live data, and the README never claims wiring that isn't there.
4. **It fits the show.** Polymarket odds in the brand theme, KOL wallets the
   hosts actually talk about, X broadcast replays, crypto tipping — built for
   Market Bubble's broadcast, not a generic dashboard.

## 🧰 Tech stack

React 18 · Vite · TypeScript (strict) · Tailwind CSS · Zustand · TanStack Query ·
Framer Motion · react-grid-layout · Socket.io · Express · tmi.js (Twitch) · OBS
WebSocket v5 · EIP-1193 / ERC-20 (wallet tipping) · Polymarket Gamma API.

## ☁️ Deploy

The frontend is a static Vite build. `.github/workflows/deploy.yml` builds and
syncs `frontend/dist/` to S3 on every push to `main` (needs the repo secrets
`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`). Manual: `npm run build` in
`frontend/` then `aws s3 sync dist/ s3://<bucket>/ --delete`.

## 🔒 Security notes

No secrets are committed (`.env*` is gitignored; only `.env.example` is tracked).
Chat / usernames / market data are rendered as escaped React text (no `innerHTML`).
Tipping validates the recipient address before signing and never holds keys. No
visitor analytics live in this repo — there is no tracking code and no visitor
data in git. The backend is a single-operator scaffold — add an auth gate + a
non-wildcard `CORS_ORIGIN` before exposing it publicly.

## 📄 License

Proprietary — © 2026 Market Bubble, all rights reserved. Shared for evaluation
and private review only. See [LICENSE](./LICENSE).
