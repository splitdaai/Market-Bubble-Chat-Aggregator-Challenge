# Market Bubble — OAuth App Registration

To let the **Connect** buttons log real accounts into the live feed, register one
OAuth app per platform and drop its Client ID + Secret into `backend/.env`.
Secrets stay server-side — they are never sent to the browser.

## The one redirect URI you'll paste everywhere

When registering each app, set its **redirect / callback URL** to:

```
http://localhost:4000/auth/<platform>/callback
```

| Platform | Exact callback URL to register                   | Env vars                                  |
| -------- | ------------------------------------------------- | ----------------------------------------- |
| Twitch   | `http://localhost:4000/auth/twitch/callback`      | `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` |
| YouTube  | `http://localhost:4000/auth/youtube/callback`     | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |
| X        | `http://localhost:4000/auth/x/callback`           | `X_CLIENT_ID` / `X_CLIENT_SECRET`         |
| Kick     | `http://localhost:4000/auth/kick/callback`        | `KICK_CLIENT_ID` / `KICK_CLIENT_SECRET`   |

> When you deploy the backend behind HTTPS, change `PUBLIC_URL` in `backend/.env`
> to that origin and re-register the same paths with the new host.

---

## 1. Twitch  ⭐ start here (fastest, most reliable)

1. Go to **https://dev.twitch.tv/console/apps** → **Register Your Application**.
2. **Name:** `Market Bubble LIVE` (must be globally unique — add a suffix if taken).
3. **OAuth Redirect URLs:** `http://localhost:4000/auth/twitch/callback`
4. **Category:** Chat Bot · **Client Type:** Confidential.
5. Create → open the app → copy **Client ID**, click **New Secret** → copy it.
6. Put them in `backend/.env`:
   ```
   TWITCH_CLIENT_ID=...
   TWITCH_CLIENT_SECRET=...
   ```
Scopes requested by the app: `chat:read chat:edit channel:moderate moderator:manage:banned_users`.

## 2. YouTube (Google Cloud)

1. **https://console.cloud.google.com** → create a project (e.g. `market-bubble`).
2. **APIs & Services → Library** → enable **YouTube Data API v3**.
3. **APIs & Services → OAuth consent screen** → External → fill the basics →
   under **Test users** add your own Google account (required while the app is
   in "Testing").
4. **Credentials → Create Credentials → OAuth client ID** → Application type
   **Web application**.
5. **Authorized redirect URIs:** `http://localhost:4000/auth/youtube/callback`
6. Copy the **Client ID** + **Client Secret**:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
Scope requested: `youtube.readonly`.
> While the app is in "Testing", only the added test users can connect and
> tokens expire after 7 days — fine for the demo.

## 3. X / Twitter

1. **https://developer.x.com** → Developer Portal → **Projects & Apps** → create
   an app inside a project.
2. Open the app → **User authentication settings → Set up**.
3. **App permissions:** Read · **Type of App:** *Web App, Automated App or Bot*
   (this makes it a confidential client with a secret).
4. **Callback URI / Redirect URL:** `http://localhost:4000/auth/x/callback`
   **Website URL:** anything valid (e.g. your X profile or the S3 demo URL).
5. Save → from **Keys and tokens**, copy the **OAuth 2.0 Client ID** + **Client Secret**:
   ```
   X_CLIENT_ID=...
   X_CLIENT_SECRET=...
   ```
Scopes requested: `tweet.read users.read offline.access` (PKCE + Basic-auth token
exchange — already handled in the backend).

## 4. Kick

1. **https://kick.com/settings/developer** → create an application.
2. **Redirect URL:** `http://localhost:4000/auth/kick/callback`
3. **Scopes:** `user:read chat:write`
4. Copy **Client ID** + **Client Secret**:
   ```
   KICK_CLIENT_ID=...
   KICK_CLIENT_SECRET=...
   ```
> Kick's public OAuth is the newest of the four and may require enabling
> developer access first; its portal UI changes often. If it misbehaves, the
> other three are enough to prove the live path.

---

## After pasting creds

1. Restart the backend (`npm run start` in `backend/`) so it reloads `.env`.
2. Confirm it sees them: `curl -s localhost:4000/auth/config` should now show
   `true` for each platform you configured.
3. In the app: open **Connections** (Plug icon) → flip the tile to **Live** →
   click **Connect** on a platform → log in in the popup → your account appears
   in the feed, stats, and leaderboards.

Anything left blank is simply skipped — the app degrades gracefully.
