import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import type { Express, Request, Response } from "express";
import type { Account, Platform } from "../../shared/types.ts";

/**
 * OAuth 2.0 connect flow for streaming platforms.
 *
 * Each provider is configured purely from env (CLIENT_ID/SECRET) — no secrets
 * ever live in the frontend. The frontend opens `/auth/:platform/start` in a
 * popup; we redirect to the platform, receive the callback, exchange the code
 * for a token, look up the account, and push the updated account list to the UI.
 *
 * Register your apps and set the redirect URI to `${PUBLIC_URL}/auth/:platform/callback`:
 *   Twitch  → https://dev.twitch.tv/console/apps
 *   YouTube → https://console.cloud.google.com (Google OAuth client)
 *   X       → https://developer.x.com (OAuth 2.0, PKCE)
 *   Kick    → https://kick.com/settings/developer
 */

interface Provider {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
  pkce?: boolean;
  /** Authenticate the token request with an HTTP Basic header instead of body params (X requires this for confidential clients). */
  basicAuth?: boolean;
  clientId?: string;
  clientSecret?: string;
  /** Resolve the connected account's handle + display name from a token. */
  userInfo: (token: string) => Promise<{ handle: string; displayName: string } | null>;
}

const env = process.env;

const PROVIDERS: Partial<Record<Platform, Provider>> = {
  twitch: {
    authorizeUrl: "https://id.twitch.tv/oauth2/authorize",
    tokenUrl: "https://id.twitch.tv/oauth2/token",
    scopes: "chat:read chat:edit channel:moderate moderator:manage:banned_users",
    clientId: env.TWITCH_CLIENT_ID,
    clientSecret: env.TWITCH_CLIENT_SECRET,
    userInfo: async (token) => {
      const r = await fetch("https://api.twitch.tv/helix/users", {
        headers: { "Client-Id": env.TWITCH_CLIENT_ID ?? "", Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null;
      const d = (await r.json()) as { data?: { login: string; display_name: string }[] };
      const u = d.data?.[0];
      return u ? { handle: u.login, displayName: u.display_name } : null;
    },
  },
  youtube: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "https://www.googleapis.com/auth/youtube.readonly",
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    userInfo: async (token) => {
      const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return null;
      const d = (await r.json()) as { items?: { snippet: { title: string; customUrl?: string } }[] };
      const c = d.items?.[0];
      return c ? { handle: c.snippet.customUrl ?? `@${c.snippet.title}`, displayName: c.snippet.title } : null;
    },
  },
  x: {
    authorizeUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    scopes: "tweet.read users.read offline.access",
    pkce: true,
    basicAuth: true,
    clientId: env.X_CLIENT_ID,
    clientSecret: env.X_CLIENT_SECRET,
    userInfo: async (token) => {
      const r = await fetch("https://api.twitter.com/2/users/me", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      const d = (await r.json()) as { data?: { username: string; name: string } };
      return d.data ? { handle: `@${d.data.username}`, displayName: d.data.name } : null;
    },
  },
  kick: {
    authorizeUrl: "https://id.kick.com/oauth/authorize",
    tokenUrl: "https://id.kick.com/oauth/token",
    scopes: "user:read chat:write",
    pkce: true,
    clientId: env.KICK_CLIENT_ID,
    clientSecret: env.KICK_CLIENT_SECRET,
    userInfo: async (token) => {
      const r = await fetch("https://api.kick.com/public/v1/users", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      const d = (await r.json()) as { data?: { name: string }[] };
      const u = d.data?.[0];
      return u ? { handle: u.name, displayName: u.name } : null;
    },
  },
};

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// --- account + token store ---
// Persisted to disk with a 30-day TTL so a login survives backend restarts:
// reconnected accounts come back on boot and their chat readers re-start.
const AUTH_STORE = process.env.AUTH_STORE_PATH ?? "auth-store.json";
const LOGIN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const accounts: Account[] = [];
const tokens = new Map<string, { access: string; refresh?: string }>();
const connectedAt = new Map<string, number>(); // account id -> epoch ms of login
const pending = new Map<string, { platform: Platform; verifier?: string }>();

function persistStore() {
  try {
    const data = {
      accounts: accounts.map((a) => ({ ...a, connectedAt: connectedAt.get(a.id) ?? Date.now() })),
      tokens: Object.fromEntries(tokens),
    };
    writeFileSync(AUTH_STORE, JSON.stringify(data));
  } catch (e) {
    console.error("auth store persist failed:", e);
  }
}

function loadStore() {
  try {
    const data = JSON.parse(readFileSync(AUTH_STORE, "utf8")) as {
      accounts?: (Account & { connectedAt?: number })[];
      tokens?: Record<string, { access: string; refresh?: string }>;
    };
    const now = Date.now();
    for (const a of data.accounts ?? []) {
      const ca = a.connectedAt ?? 0;
      if (now - ca > LOGIN_TTL_MS) continue; // login older than the 30-day TTL — drop it
      accounts.push({ id: a.id, platform: a.platform, handle: a.handle, displayName: a.displayName, connected: true });
      connectedAt.set(a.id, ca);
      const tok = data.tokens?.[a.id];
      if (tok) tokens.set(a.id, tok);
    }
    if (accounts.length) console.log(`↺ restored ${accounts.length} connected account(s) from the 30-day auth store`);
  } catch {
    /* no store yet — first run */
  }
}
loadStore();

export function getAccounts(): Account[] {
  return accounts;
}
export function getToken(accountId: string) {
  return tokens.get(accountId);
}

/** Mount the auth routes. `publicUrl` is the externally-reachable backend URL. */
export function mountAuth(app: Express, publicUrl: string, onChange: () => void) {
  const redirectUri = (p: string) => `${publicUrl}/auth/${p}/callback`;

  app.get("/auth/config", (_req, res) => {
    const configured: Record<string, boolean> = {};
    for (const [p, prov] of Object.entries(PROVIDERS)) configured[p] = Boolean(prov?.clientId && prov?.clientSecret);
    res.json({ configured, redirectBase: publicUrl });
  });

  app.get("/auth/accounts", (_req, res) => res.json(accounts));

  app.get("/auth/:platform/start", (req: Request, res: Response) => {
    const platform = req.params.platform as Platform;
    const prov = PROVIDERS[platform];
    if (!prov?.clientId) return res.status(400).send(`OAuth not configured for ${platform}. Set its CLIENT_ID/SECRET.`);

    const state = b64url(randomBytes(16));
    const params = new URLSearchParams({
      client_id: prov.clientId,
      redirect_uri: redirectUri(platform),
      response_type: "code",
      scope: prov.scopes,
      state,
    });
    if (prov.pkce) {
      const verifier = b64url(randomBytes(32));
      params.set("code_challenge", b64url(createHash("sha256").update(verifier).digest()));
      params.set("code_challenge_method", "S256");
      pending.set(state, { platform, verifier });
    } else {
      pending.set(state, { platform });
    }
    res.redirect(`${prov.authorizeUrl}?${params.toString()}`);
  });

  app.get("/auth/:platform/callback", async (req: Request, res: Response) => {
    const platform = req.params.platform as Platform;
    const prov = PROVIDERS[platform];
    const code = req.query.code as string;
    const state = req.query.state as string;
    const ctx = pending.get(state);
    if (!prov || !code || !ctx) return res.status(400).send(closePopup("Invalid OAuth callback"));
    pending.delete(state);

    try {
      const body = new URLSearchParams({
        client_id: prov.clientId!,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri(platform),
      });
      if (ctx.verifier) body.set("code_verifier", ctx.verifier);

      const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
      if (prov.basicAuth) {
        // Confidential-client auth (X): credentials go in the Authorization header.
        headers.Authorization = `Basic ${Buffer.from(`${prov.clientId}:${prov.clientSecret}`).toString("base64")}`;
      } else {
        body.set("client_secret", prov.clientSecret!);
      }

      const tr = await fetch(prov.tokenUrl, { method: "POST", headers, body });
      if (!tr.ok) return res.send(closePopup(`Token exchange failed (${tr.status})`));
      const tok = (await tr.json()) as { access_token: string; refresh_token?: string };

      const info = await prov.userInfo(tok.access_token);
      if (!info) return res.send(closePopup("Could not read account info"));

      const id = `${platform}:${info.handle.replace(/^@/, "").toLowerCase()}`;
      tokens.set(id, { access: tok.access_token, refresh: tok.refresh_token });
      if (!accounts.some((a) => a.id === id)) {
        accounts.push({ id, platform, handle: info.handle, displayName: info.displayName, connected: true });
      }
      connectedAt.set(id, Date.now()); // (re)login resets the 30-day TTL
      persistStore();
      onChange();
      res.send(closePopup(`Connected ${info.displayName} on ${platform}`, info.handle));
    } catch (e) {
      res.send(closePopup(`OAuth error: ${e}`));
    }
  });

  app.delete("/auth/account/:id", (req: Request, res: Response) => {
    const i = accounts.findIndex((a) => a.id === req.params.id);
    if (i >= 0) {
      tokens.delete(accounts[i].id);
      connectedAt.delete(accounts[i].id);
      accounts.splice(i, 1);
      persistStore();
      onChange();
    }
    res.json({ ok: true });
  });
}

/** Tiny HTML that notifies the opener and closes the popup. */
function closePopup(message: string, handle?: string): string {
  return `<!doctype html><meta charset=utf-8><body style="background:#04100c;color:#16e6a4;font-family:system-ui;display:grid;place-items:center;height:100vh">
<div style="text-align:center"><h3>${message}</h3><p style="color:#78b6a4">You can close this window.</p></div>
<script>try{window.opener&&window.opener.postMessage({type:"mb-auth",handle:${JSON.stringify(handle ?? null)}},"*")}catch(e){}setTimeout(()=>window.close(),1200)</script>`;
}
