# ⚡ VibeChat Aggregator

> One beautiful, real-time feed for **Twitch + X + Kick**. Crystal-clear source
> labels, full cross-platform moderation, and an insanely customizable
> drag/drop/snap visual editor. Built for the $10k Vibe Code Challenge.

![mode: demo + live](https://img.shields.io/badge/mode-demo%20%2B%20live-b14dff)
![stack: React 18 · Vite · TS · Socket.io](https://img.shields.io/badge/stack-React%2018%20·%20Vite%20·%20Socket.io-2dd4ff)

---

## ✨ What's in here

| Feature | Status |
|---|---|
| **Unified real-time feed** — newest at bottom, pop-in physics, per-platform filters | ✅ |
| **Source badges** (Twitch purple · X mono · Kick green) on every message | ✅ |
| **Live Stats dashboard** — combined + per-platform viewers, unique chatters, cumulative watch time, peak, share-of-voice, engagement ratio | ✅ |
| **Clip Radar** — auto-detects clip-worthy moments from chat-velocity spikes (the thing streamers beg for) | ✅ |
| **Clips** — capture a moment (chat context + viewer counts), gallery, manual/auto, + native-clip backend seam | ✅ |
| **Giveaway Bot** — run a giveaway across all 3 platforms at once; pooled entries + animated winner draw | ✅ |
| **Viewer Overlay** — freely-placeable per-platform viewer badges + standalone OBS browser-source route | ✅ |
| **Mood Meter** — live cross-platform chat sentiment (spicy → hyped) | ✅ (addable) |
| **Top Chatters** — cross-platform most-active leaderboard | ✅ |
| **Visual editor** — drag / drop / resize / snap-to-grid panels, persisted to localStorage | ✅ |
| **Theme editor** — live color/glow/radius/font with presets | ✅ |
| **Button editor** — author custom action buttons (Raid, Hype Train, …) with live preview | ✅ |
| **Cross-platform moderation** — right-click any message → delete / timeout / ban / unban / slow | ✅ (UI + backend proxy) |
| **DogeFundMe-grade polish** — aurora bg, particle bursts on hype, neon glass, hype meter, confetti milestones | ✅ |
| **Backend connectors** — Twitch (tmi.js), Kick (public WS), X (filtered stream) → normalize → broadcast | ✅ skeleton, credential-gated |

The frontend runs **fully standalone in demo mode** with a realistic mock
firehose — no backend or API keys required to see everything working.

---

## 🗂 Structure

```
vibechat-aggregator/
├── frontend/          # React 18 + Vite + TS + Tailwind + Framer Motion
│   └── src/
│       ├── components/   ChatFeed, Message, SourceBadge, EditorCanvas,
│       │                 ThemeEditor, ButtonEditor, ModMenu, widgets/…
│       ├── lib/          socket · api · theme · mockData
│       ├── store/        Zustand: chat · layout · theme · toast
│       └── hooks/        useChatConnection
├── backend/           # Node + Express + Socket.io
│   └── src/
│       ├── platforms/    twitch · kick · x  (common Connector interface)
│       ├── sockets/      hub  (fan-out + status + command routing)
│       ├── moderation.ts route a command to the right platform
│       └── index.ts
├── shared/            # types.ts — the Message/Layout/Theme contract
└── .env.example
```

`shared/types.ts` is the single contract both sides agree on — every connector
must emit the same normalized `ChatMessage`.

---

## 🚀 Run it

### Frontend (demo mode — zero config)

```bash
cd frontend
npm install
npm run dev          # → http://localhost:5184
```

That's it. The mock firehose lights up the whole UI. Hit **Edit** (top-right) to
drag panels around; the 🎨 icon opens the theme editor.

### Backend (live mode)

```bash
cd backend
npm install
cp ../.env.example .env     # fill in the platforms you want
npm run dev                 # → http://localhost:4000
```

Then point the frontend at it:

```bash
# frontend/.env
VITE_BACKEND_URL=http://localhost:4000
```

The frontend transparently switches from mock to live — the rest of the app
doesn't know the difference (see `frontend/src/lib/socket.ts`). The moment
`VITE_BACKEND_URL` is set, **every** mock is bypassed (firehose, warm-start,
seeded analytics) and all data comes from the backend.

### What "live" actually wires up

| Data | Source when live |
|---|---|
| Chat messages → feed, sentiment, donors, subs, clips, user list | backend `message` events (real Twitch/Kick/X chat) |
| Combined + per-platform **viewer counts**, peak, watch time | backend `stats` (Twitch Helix + Kick API pollers, every 15s) |
| **Donations / subs** | parsed from real bits/sub/gift events on `message.event` |
| **Analytics** past streams | backend `history` (persisted to `data/history.json`) |
| **Moderation** (timeout/ban/…) | proxied to the platform API via the `moderate` event |
| **Clips** | `clip:create` → Twitch Helix Create Clip → `clip:created` URL |

End a broadcast and roll it into analytics with:
`curl -X POST localhost:4000/api/session/save -H 'content-type: application/json' -d '{"title":"Fed Day"}'`

---

## 🔌 Platform wiring

| Platform | Chat | Viewers | Moderate | Clips |
|---|---|---|---|---|
| **Twitch** | anon `TWITCH_CHANNEL` | Helix (`TWITCH_CLIENT_ID`/`_SECRET`) | mod OAuth | Helix (`TWITCH_USER_TOKEN` + `TWITCH_BROADCASTER_ID`) |
| **Kick** | public WS | public channel API | session bearer | — |
| **X** | App-Only bearer, filtered stream | n/a (broadcast) | n/a | — |
| **YouTube** | — | Data API v3 (`YOUTUBE_API_KEY` + `YOUTUBE_VIDEO_ID`) | — | — |

See `.env.example` for the full credential list. Missing a platform's config
just skips it — one dead source never takes the others down, and the dashboard
shows real numbers for whatever you've wired.

---

## 📊 Stats contract (frontend ⇄ backend handoff)

The frontend computes everything it can **see in the chat firehose** itself —
unique chatters, active chatters, messages, msg/min, sentiment, top chatters, and
clip-worthy-moment detection — so those work today on the mock stream with **no
backend dependency**.

The backend (Codex) only needs to supply what chat *can't* reveal: real
**viewer counts, peak viewers, cumulative watch time, follows gained**. Emit an
`AggregateStats` snapshot over the socket `stats` event on a ~2s cadence:

```ts
// shared/types.ts  — single source of truth
socket.emit("stats", {
  sessionStart,                 // epoch ms
  updatedAt,                    // epoch ms
  perPlatform: [
    { platform: "twitch",
      viewers, peakViewers, watchTimeMinutes, followsGained,  // [BACKEND] required
      uniqueChatters, activeChatters, messages, messagesPerMin // [DERIVED] optional override
    },
    // …kick, x
  ],
});
```

When the `stats` event arrives, the frontend swaps simulated viewer numbers for
the real ones automatically (`statsStore.applyBackendStats`) and the demo badge
disappears. Until then it simulates a believable viewer random-walk so the
dashboard is always alive. Fields marked `[DERIVED]` are computed client-side; send
them only if the backend has authoritative numbers.

## 🎬 Clips, 🎁 Giveaways, 📺 Overlay

- **Clips** — "Clip Now" (or an auto-fire from Clip Radar) snapshots the
  surrounding chat + live viewer counts into a clip. The **`clip:create`** socket
  event is the seam for Codex to cut a *native* platform clip (Twitch/Kick Clips
  API); when it returns **`clip:created(clipId, url)`** the gallery shows an "Open
  clip ↗" link. Works fully (chat-side) with no backend.
- **Giveaway Bot** — set a keyword (`!enter`) + prize, open it, and viewers on
  **all three platforms enter together**. Entries are pooled and de-duped per
  user; "Draw Winner" picks one across every platform with a confetti reveal.
  100% client-side off the unified firehose — no backend needed.
- **Viewer Overlay** — toggle the 🖥 button to float per-platform (and combined)
  viewer badges anywhere on screen; drag to position, positions persist. The
  **"OBS link"** button copies a `?overlay=1` URL that renders just the badges on
  a **transparent background** — drop it into OBS as a Browser Source for a live,
  always-current viewer counter on stream.

## 🎨 Design system

Dark cyber/crypto by default — deep blacks, neon purple/green/blue, glassmorphism.
Every token is a CSS variable on `:root`, so the Theme Editor mutates the live
look with no rebuild. Tailwind utilities reference the same vars.

---

## 🛠 Tech

React 18 · Vite · TypeScript · Tailwind · Framer Motion · Zustand · TanStack
Query · react-grid-layout (drag/resize/snap) · Socket.io · Express · tmi.js · ws ·
Lucide icons · custom canvas particles.
