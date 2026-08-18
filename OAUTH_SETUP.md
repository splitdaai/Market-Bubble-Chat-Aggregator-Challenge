# Market Bubble — OAuth App Registration (Vercel, no server)

The **Connect** buttons log you into a platform and add *your* channel to the
live feed. The login runs on same-origin Vercel functions (`/api/auth/*`) —
there is no backend server anymore. Nothing is stored: the popup only tells the
app which channel is yours. Reading public chat never needs a login at all
(type the channel name in the box under each platform instead).

To make **Connect** work you register one OAuth app per platform (about 5 min
each) and paste its Client ID + Secret into **Vercel → Project → Settings →
Environment Variables** (Production). Secrets stay server-side.

## The one redirect URI you'll paste everywhere

```
https://marketbubble-five.vercel.app/api/auth/<platform>/callback
```

| Platform | Exact callback URL to register                                        | Vercel env vars                             |
| -------- | ---------------------------------------------------------------------- | ------------------------------------------- |
| Twitch   | `https://marketbubble-five.vercel.app/api/auth/twitch/callback`        | `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` |
| YouTube  | `https://marketbubble-five.vercel.app/api/auth/youtube/callback`       | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |
| X        | `https://marketbubble-five.vercel.app/api/auth/x/callback`             | `X_CLIENT_ID` / `X_CLIENT_SECRET`           |
| Kick     | `https://marketbubble-five.vercel.app/api/auth/kick/callback`          | `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET`     |

> Using a custom domain later? Register the same path on the new host and set
> `PUBLIC_URL=https://<new-host>` in Vercel so the callback URL matches exactly.
> For local dev (`npm run dev` on :5180) also register
> `http://localhost:5180/api/auth/<platform>/callback` and put the same vars in
> a root `.env` (never committed).

---

## 1. Twitch  ⭐ start here (fastest, most reliable)

1. Go to **https://dev.twitch.tv/console/apps** → **Register Your Application**.
2. **Name:** `Market Bubble LIVE` (must be globally unique — add a suffix if taken).
3. **OAuth Redirect URLs:** `https://marketbubble-five.vercel.app/api/auth/twitch/callback`
4. **Category:** Chat Bot · **Client Type:** Confidential.
5. Create → open the app → copy **Client ID**, click **New Secret** → copy it.
6. Vercel env vars: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`.

Scope requested: `chat:read` (identity only).

## 2. YouTube (Google Cloud)

1. **https://console.cloud.google.com** → create a project (e.g. `market-bubble`).
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **APIs & Services → OAuth consent screen** → External → fill the basics →
   under **Test users** add your own Google account (required while the app is
   in "Testing").
4. **Credentials → Create Credentials → OAuth client ID** → Application type
   **Web application**.
5. **Authorized redirect URIs:** `https://marketbubble-five.vercel.app/api/auth/youtube/callback`
6. Vercel env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

Scope requested: `youtube.readonly` (identity only — live chat itself is read
without any key via `/api/yt-chat`).

## 3. X / Twitter

1. **https://developer.x.com** → Developer Portal → **Projects & Apps** → create
   an app inside a project.
2. Open the app → **User authentication settings → Set up**.
3. **App permissions:** Read · **Type of App:** *Web App, Automated App or Bot*
   (this makes it a confidential client with a secret).
4. **Callback URI / Redirect URL:** `https://marketbubble-five.vercel.app/api/auth/x/callback`
   **Website URL:** `https://marketbubble-five.vercel.app`
5. Save → from **Keys and tokens**, copy the **OAuth 2.0 Client ID** + **Client Secret**.
6. Vercel env vars: `X_CLIENT_ID`, `X_CLIENT_SECRET`.

Scopes requested: `tweet.read users.read` (PKCE + Basic-auth token exchange —
already handled). Note: X live *chat* follows a broadcast link, not a profile —
paste your `x.com/i/broadcasts/…` link in Connections when you go live.

## 4. Kick

1. **https://kick.com/settings/developer** → create an application.
2. **Redirect URL:** `https://marketbubble-five.vercel.app/api/auth/kick/callback`
3. **Scopes:** `user:read channel:read`
4. Vercel env vars: `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`.

> Kick chat rides a numbered chat room per channel; new channels need a
> one-time room-id lookup (Kick's lookup endpoint is bot-walled). Paste the id
> next to the channel in Connections.

---

## After pasting creds

1. In Vercel: **Deployments → ⋯ → Redeploy** (env vars only apply to new deployments).
2. Confirm: `https://marketbubble-five.vercel.app/api/auth/config` shows `true`
   for each platform you configured.
3. In the app: open **Connections** (plug icon) → click **Connect** on a platform
   → log in in the popup → your channel appears in the list; flip to **LIVE** and
   its chat flows into the feed.

Anything left blank is simply skipped — that platform's button reads **Set up**
and the type-a-channel box still works.
