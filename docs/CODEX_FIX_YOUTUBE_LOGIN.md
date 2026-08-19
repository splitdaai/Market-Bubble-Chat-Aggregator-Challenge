# Task: fix the YouTube "Connect" login for Market Bubble (Google client secret in Vercel is wrong)

**Owner:** Eddie (splitdaai). **Repo:** `~/Downloads/vibechat-aggregator` (GitHub `splitdaai/Market-Bubble-Chat-Aggregator-Challenge`).
**Live site:** https://marketbubble-five.vercel.app — Vercel project `marketbubble` (team `splitdaais-projects`, id `prj_503FK7yGJMgeptwCVckrDhldWMnM`). Vercel CLI is already logged in on this Mac (`npx vercel whoami` → splitdaai).

## What's wrong (one sentence)

The OAuth login runs on Vercel functions (`api/auth/[platform]/{start,callback}.ts`); Twitch, Kick and X work. YouTube fails at the token exchange because the value stored in Vercel env var **`GOOGLE_CLIENT_SECRET` (Production) does not match any enabled secret on the Google OAuth client** — Google answers `invalid_client: The provided client secret is invalid.` The client ID (`GOOGLE_CLIENT_ID`) and the redirect URI are correct.

## How to verify (before and after) — no clicking through Google needed

```bash
curl -s "https://marketbubble-five.vercel.app/api/auth/config?check=1" | python3 -m json.tool
```
- Broken now: `"youtube": {"ok": false, "error": "invalid_client: …"}`
- Fixed: `"youtube": {"ok": true, …}` (the probe reports "secret accepted").
`twitch`, `kick`, `x` should already be `ok: true`.

## Steps

1. **Google Cloud Console** (Eddie's Google account) → project **My First Project** (`project-600bbfa7-03aa-44ba-939`) → **APIs & Services → Credentials** → OAuth 2.0 Client IDs → open **Market-Bubble** (client ID starts `346907395560-ehrgf2l7…`).
   Direct link: https://console.cloud.google.com/apis/credentials?project=project-600bbfa7-03aa-44ba-939
2. Confirm **Authorized redirect URIs** contains exactly
   `https://marketbubble-five.vercel.app/api/auth/youtube/callback` (add + Save if missing).
3. Under **Client secrets** click **+ Add secret**. Copy the new value immediately (Google shows it once). Optionally disable the older secrets afterwards.
4. Replace the Vercel value (Production). Either in the dashboard
   (https://vercel.com/splitdaais-projects/marketbubble/settings/environment-variables → row `GOOGLE_CLIENT_SECRET` → Edit → paste → Save), or via CLI from the repo root:
   ```bash
   cd ~/Downloads/vibechat-aggregator
   npx vercel env rm GOOGLE_CLIENT_SECRET production -y
   npx vercel env add GOOGLE_CLIENT_SECRET production      # paste the NEW secret at the prompt, no spaces/newlines
   ```
5. Redeploy so the new value is picked up (env vars only apply to new deployments):
   ```bash
   cd ~/Downloads/vibechat-aggregator && npx vercel --prod --yes
   ```
6. Re-run the verify command above until `youtube.ok` is `true`.
7. Final proof: open https://marketbubble-five.vercel.app → plug icon (Connections) → **YouTube → Connect** → pick Eddie's Google account → popup says "Connected SplitDaWig" and the channel appears under YouTube.

## Pitfalls seen so far

- A pasted value with a leading/trailing space or line break → `invalid_client`.
- Using a secret that was later **disabled/deleted** in Google → `invalid_client`.
- If Google shows "This app isn't verified": click Advanced → Continue (app is in Testing; Eddie's account must be listed under OAuth consent screen → Test users).
- Do NOT commit secrets to the repo and do not paste them into chat logs; they belong only in Vercel env vars.
- Callback path for each platform is `/api/auth/<platform>/callback` (twitch | youtube | x | kick) on `https://marketbubble-five.vercel.app`.
