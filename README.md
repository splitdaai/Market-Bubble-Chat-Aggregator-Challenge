# Market Bubble

Market Bubble is a real-time broadcast operations dashboard for live financial and creator streams. It brings chat, viewer activity, moderation, market context, Polymarket odds, OBS sources, analytics, and crypto tipping into one production-focused interface.

The app is built to run in two clear modes:

- **Demo mode:** a self-contained mock firehose for reviewing the product without API keys or backend services.
- **Live mode:** a Socket.io backend drives real chat, accounts, viewer stats, OAuth connections, and stream history.

[![Mode](https://img.shields.io/badge/mode-demo%20%2B%20live-16e6a4)](#demo-and-live-mode)
[![Frontend](https://img.shields.io/badge/frontend-React%2018%20%2B%20Vite%20%2B%20TypeScript-34d6ff)](#tech-stack)
[![Backend](https://img.shields.io/badge/backend-Node%20%2B%20Express%20%2B%20Socket.io-d9a547)](#tech-stack)
[![License](https://img.shields.io/badge/license-proprietary-lightgrey)](#license)

## Live Links

- **Live demo:** https://marketbubble-khaki.vercel.app
- **Judge tour:** https://marketbubble-khaki.vercel.app/?tour
- **Chat-only OBS source:** `/?broadcast=1`
- **Staged chat preview:** `/?broadcast=1&stage=1`
- **Floating overlay:** `/?overlay=1`
- **OBS dock:** `/?dock=1`

## What Market Bubble Does

Market Bubble is designed for operators, hosts, and producers who need one screen that answers four questions during a live show:

1. **What is the audience saying?** Unified chat, mentions, tickers, sentiment, moderation, and viewer profiles.
2. **What is happening in the market?** Polymarket odds, headlines, KOL wallet activity, and watchlist context.
3. **What should the show do next?** Producer briefs, clip radar, topic spikes, and host prompts.
4. **What goes on stream?** OBS-ready chat, overlays, docks, and browser sources.

## Feature Guide

| Feature | How it works | How to use it |
| --- | --- | --- |
| Unified chat feed | Normalizes Twitch, Kick, X, and YouTube messages into one shared message format with platform badges, streamer attribution, timestamps, moderation state, and per-user history. | Open the dashboard and use the chat feed filters for platforms, hosts, mentions, tickers, or search. Stay at the bottom to remain pinned to live messages; scroll up to review history. |
| Demo / Live mode | Demo mode starts a local mock firehose. Live mode connects the frontend to the backend through `VITE_BACKEND_URL` and uses backend socket events instead of mock data. | Use the Demo/Live control in the top bar or Chat Only staged view. Leave `VITE_BACKEND_URL` unset for demo. Set it to the backend URL for live data. |
| Platform connections | The Connections panel launches platform OAuth flows where credentials are configured. Twitch and Kick can also watch public channels by name where supported. Secrets and OAuth tokens stay server-side. | Open **Connections**, switch to **Live**, then click **Connect** for a platform. For Twitch or Kick, use the watch-channel input to add a public channel to the live feed. |
| Real emote rendering | Twitch, Kick, 7TV, BTTV, and FFZ emotes resolve and render inline so chat looks familiar to streamers and viewers. Twitch official emotes are resolved from IRC tags; Kick emotes are resolved from message metadata, channel emote data, or numeric Kick emote tokens when available. | Connect or watch Twitch/Kick channels, then view messages in the feed or Chat Only source. Emotes render automatically when available. |
| Moderation | The app applies an auto-mod pass before messages render, then exposes manual moderation actions through message rows and user profiles. | Click a viewer or moderation action to timeout, ban, remove, or inspect message history. Live platform enforcement depends on backend credentials and scopes. |
| Viewer profiles | User cards combine platform identity, message history, activity, moderation controls, and tipping eligibility. | Click a username in chat or the viewer list. Use the profile for context before moderating, tipping, or tracking viewer activity. |
| Top chatters and viewer list | Aggregates message volume, spend, recency, platform, channel, and wallet eligibility into ranked views. | Use the leaderboards and viewer list to find high-signal users, recent participants, subscribers, and tippable viewers. |
| Live stats | Stats are ingested per message and rebuilt on a timed tick so UI rendering stays bounded during fast chat. | Watch combined viewers, active chatters, message rate, engagement, platform breakdowns, and stream trends in the dashboard. |
| Revenue analytics | Tracks subscriptions, bits, Kick activity, Super Chats, memberships, tips, and estimated ad revenue where signals are available. | Open the analytics view to compare live snapshots, trends, and historical stream performance. Demo mode seeds example history; live mode uses backend history. |
| Polymarket panel | Pulls market data from Polymarket public APIs and displays odds, volume, categories, and watchable markets. | Open the Polymarket panel, browse trending or category views, click markets to inspect them, or pin relevant market context to the overlay. |
| KOL smart-money tracker | Surfaces trader and wallet context from available leaderboard, vault, and wallet data. | Use the KOL view to inspect account value, positions, fills, realized PnL, and market context for notable traders. |
| Intelligence feed | Displays market headlines with ticker and impact context so producers can spot useful show topics quickly. | Open the intelligence/news area during prep or live production. Use impact and ticker labels to decide what belongs in the show. |
| Producer brief | Summarizes live room context into host-ready prompts: active topics, tickers, mood, questions, and clip-worthy moments. | Keep the brief visible for host direction or use it during transitions when the show needs the next topic. |
| Stream preview | Provides a center-stage video surface with stream controls, source switching, and replay support. | Use the preview to monitor the show, review replays, or switch between available stream sources. |
| Past broadcasts | Presents a VOD/replay library with thumbnails and playable entries. | Open a past broadcast to review show moments or prepare clips and talking points. |
| Clip radar | Detects chat-velocity spikes and clip-worthy windows around moments that caused audience reaction. | Watch clip alerts during the show, then capture or review the surrounding chat context. Native clip creation depends on backend platform support. |
| Giveaway bot | Pools eligible entries across connected platforms and selects a winner with a visual draw. | Start a giveaway from the dashboard, define the entry behavior, then run the winner draw when entries close. |
| Visual editor | Dashboard panels can be moved, resized, and arranged with persisted local layout state. | Use edit controls in the main dashboard to arrange the workspace for the operator, producer, or host. Layouts persist in the browser. |
| Theme editor | CSS variable based theming lets the operator adjust the look without changing application code. | Open the theme editor, adjust colors and presentation, then review the dashboard and overlays. |
| Chat Only source | Renders the aggregated chat as a clean OBS browser source. The staged preview places the chat over the show frame for review, while the clean source stays chrome-free for OBS. | Use `/?broadcast=1` in OBS. Use `/?broadcast=1&stage=1` in the browser to preview the show placement, toggle Demo/Live, and open Connections. |
| OBS overlay | Renders market, viewer, and chat elements as browser-source friendly overlays. | Add `/?overlay=1` as an OBS Browser Source. Use the dashboard to control which market or overlay elements should appear. |
| OBS dock | Provides a compact browser dock for the operator inside OBS. | In OBS, open **Docks -> Custom Browser Docks** and add `/?dock=1`. Use it as an internal monitor, not as a viewer-facing source. |
| OBS WebSocket integration | Connects to OBS WebSocket v5 and can add browser sources directly to the current scene. | Open **Connections**, enter OBS host, port, and WebSocket password, then use the one-click source buttons. |
| Crypto tipping | Uses an EIP-1193 wallet and ERC-20 transfers for non-custodial USDC/USDT tips on supported EVM chains. | Connect a wallet, enable tipping, click a wallet-connected viewer, choose a token/amount, and approve the transaction in your wallet. |

## Demo and Live Mode

The app is intentionally explicit about data mode.

### Demo mode

Demo mode is the default when the frontend has no backend URL. It is useful for product review, UI testing, local development, and demos without API keys.

Demo mode includes:

- seeded chat traffic,
- seeded viewer activity,
- seeded analytics history,
- mock platform accounts,
- demo-friendly stream and market surfaces.

### Live mode

Live mode is enabled by setting `VITE_BACKEND_URL` for the frontend and running the backend. In live mode, the frontend expects the backend to provide messages, connection status, accounts, stats, and history.

Live mode is used for:

- real platform account connections,
- real watched channels,
- real socket-delivered chat,
- real backend stats,
- server-side OAuth and token handling,
- platform moderation and clip actions when credentials support them.

## Architecture

This repository is organized as a small TypeScript monorepo with shared contracts.

```text
market-bubble/
|-- shared/      # shared TypeScript contracts
|-- frontend/    # React, Vite, Tailwind, Zustand, Socket.io client
`-- backend/     # Express, Socket.io, OAuth, platform connectors
```

### Data flow

1. The frontend mounts the chat connection hook.
2. Demo mode starts the mock firehose in the browser.
3. Live mode connects to the backend over Socket.io.
4. Messages are batched before entering the store so fast chat does not trigger one render per message.
5. Stats are ingested cheaply and rebuilt on a timed tick for predictable UI performance.
6. Dashboard widgets, overlays, and OBS routes consume the same normalized state.

### Security model

- OAuth client secrets stay in the backend environment.
- Platform access tokens stay server-side.
- The browser only needs the backend origin.
- Wallet tipping is non-custodial; transactions are approved in the user's wallet.
- Demo mode never requires real credentials.

## Quick Start

### Prerequisites

- Node.js 18 or newer
- npm
- Optional: OBS Studio with OBS WebSocket enabled
- Optional: platform developer apps for OAuth

### Run the frontend in demo mode

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5184.

No backend or API keys are required for demo mode.

### Run the backend for live mode

```bash
cd backend
npm install
cp ../.env.example .env
npm run dev
```

Then configure the frontend:

```bash
cd frontend
cp .env.example .env
```

Set:

```bash
VITE_BACKEND_URL=http://localhost:4000
```

Restart the frontend after changing environment variables, then switch the UI from Demo to Live.

## Platform Setup

Platform OAuth is optional. Configure only the providers you need.

| Platform | What it enables | Required environment variables |
| --- | --- | --- |
| Twitch | OAuth account connection, chat, moderation, viewer/clip APIs depending on scopes | `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, optional bot/moderation tokens |
| YouTube | OAuth account connection and YouTube data access | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optional API key/video ID |
| X | OAuth account connection and configured stream rules | `X_CLIENT_ID`, `X_CLIENT_SECRET`, optional bearer token/rules |
| Kick | OAuth account connection and public channel watching where available | `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`, optional bearer token |

For exact callback URLs and provider registration steps, see [OAUTH_SETUP.md](./OAUTH_SETUP.md).

## OBS Usage

Market Bubble exposes multiple browser-ready routes.

| Route | Purpose | Recommended use |
| --- | --- | --- |
| `/?broadcast=1` | Clean Chat Only source | Add as an OBS Browser Source for the on-stream chat panel. |
| `/?broadcast=1&stage=1` | Staged Chat Only preview | Use in a browser to preview placement, switch Demo/Live, and open Connections. |
| `/?overlay=1` | Floating overlay | Add as a transparent OBS Browser Source for viewer, market, and chat overlays. |
| `/?dock=1` | Operator dock | Add under OBS Custom Browser Docks for an internal chat monitor. |

Useful Chat Only query options:

```text
?broadcast=1&bg=transparent
?broadcast=1&platform=twitch,kick
?broadcast=1&fontsize=18
?broadcast=1&messages=80
```

Recommended OBS settings:

- Browser Source size: start around `880x624` for Chat Only.
- Disable **Shutdown source when not visible** if you want the source to stay connected.
- Use the clean `?broadcast=1` route for OBS. Use `&stage=1` only for browser preview.

## Available Scripts

Frontend:

```bash
cd frontend
npm run dev       # local Vite server
npm run build     # TypeScript build plus production Vite bundle
npm run preview   # serve the production build locally
npm test          # Vitest test suite
```

Backend:

```bash
cd backend
npm run dev        # watch mode
npm run start      # run the server
npm run typecheck  # TypeScript type check
```

## Deployment

The frontend is a static Vite build.

```bash
cd frontend
npm run build
```

The generated `dist` directory can be hosted on Vercel, S3 static hosting, CloudFront, or any static file host.

For S3:

```bash
aws s3 sync dist/ s3://<bucket-name>/ --delete
```

For Vercel, the root `vercel.json` builds the frontend and serves `frontend/dist`.

Production live mode also requires a reachable backend URL and matching `CORS_ORIGIN` / `PUBLIC_URL` values in the backend environment.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| The app only shows demo data | Confirm `frontend/.env` has `VITE_BACKEND_URL` and restart the Vite dev server. |
| Live mode is empty | Confirm the backend is running, the frontend can reach it, and the browser console has no CORS errors. |
| Connect buttons do not open OAuth | Confirm the provider client ID/secret is set in `backend/.env`, restart the backend, and verify `/auth/config`. |
| OAuth callback fails | Confirm the provider callback URL exactly matches `${PUBLIC_URL}/auth/<platform>/callback`. |
| Twitch/Kick public watch does not add chat | Confirm Live mode is enabled and the channel slug is valid. |
| Twitch/Kick emotes show as text | Run the backend with `DEBUG_EMOTES=1`, send one known emote in the watched channel, and inspect the `[emotes:twitch]` or `[emotes:kick]` log line. It shows the raw platform token/range data and the image URL the normalizer resolved. |
| OBS source is not updating | Disable source shutdown in OBS and use the clean `?broadcast=1` route. |
| Overlay appears with the wrong background | Add `bg=transparent` where supported and confirm OBS Browser Source transparency. |
| Buttons feel slow during heavy chat | Confirm the current build is running; message ingestion is batched to reduce render pressure. |

## Tech Stack

- React 18
- Vite
- TypeScript
- Tailwind CSS
- Zustand
- TanStack Query
- Framer Motion
- react-grid-layout
- Socket.io
- Express
- tmi.js
- OBS WebSocket v5
- EIP-1193 wallet integrations
- Polymarket public APIs

## License

Proprietary - Copyright 2026 Market Bubble. All rights reserved. Shared for evaluation and private review only. See [LICENSE](./LICENSE).
