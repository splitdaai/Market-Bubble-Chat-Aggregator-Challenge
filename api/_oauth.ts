// OAuth "Connect" for Twitch / YouTube / X / Kick as stateless Vercel functions
// (port of backend/src/auth.ts — the EC2 backend was retired).
//
// Identity-only: the popup logs the operator into the platform, we exchange the
// code for a token ONCE, read "who is this?" and hand { platform, handle,
// displayName } back to the opener window, which adds the channel to the feed.
// No token is stored anywhere (no DB, no cookie) — read-only chat aggregation
// never needs one. The only state is the OAuth `state` + PKCE verifier, kept in
// a short-lived signed httpOnly cookie between /start and /callback.
//
// Each provider is configured purely from env (never in the frontend):
//   TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET   → https://dev.twitch.tv/console/apps
//   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET   → https://console.cloud.google.com  (OAuth client, Web app)
//   X_CLIENT_ID      / X_CLIENT_SECRET        → https://developer.x.com            (OAuth 2.0, confidential client)
//   KICK_CLIENT_ID   / KICK_CLIENT_SECRET     → https://kick.com/settings/developer
// Register each app's redirect URI as  https://<your-host>/api/auth/<platform>/callback
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

export type Platform = "twitch" | "youtube" | "x" | "kick";
export const PLATFORMS: Platform[] = ["twitch", "youtube", "x", "kick"];

interface Provider {
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string;
  pkce?: boolean;
  /** X: confidential clients authenticate the token request with HTTP Basic. */
  basicAuth?: boolean;
  authParams?: Record<string, string>;
  clientId?: string;
  clientSecret?: string;
  userInfo: (token: string, clientId: string) => Promise<{ handle: string; displayName: string; avatar?: string; id?: string } | null>;
}

const env = process.env;

export const PROVIDERS: Record<Platform, Provider> = {
  twitch: {
    authorizeUrl: "https://id.twitch.tv/oauth2/authorize",
    tokenUrl: "https://id.twitch.tv/oauth2/token",
    scopes: "chat:read",
    authParams: { force_verify: "true" },
    clientId: env.TWITCH_CLIENT_ID,
    clientSecret: env.TWITCH_CLIENT_SECRET,
    userInfo: async (token, clientId) => {
      const r = await fetch("https://api.twitch.tv/helix/users", { headers: { "Client-Id": clientId, Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      const d = (await r.json()) as { data?: { id?: string; login: string; display_name: string; profile_image_url?: string }[] };
      const u = d.data?.[0];
      return u ? { handle: u.login, displayName: u.display_name, avatar: u.profile_image_url, id: u.id } : null;
    },
  },
  youtube: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "https://www.googleapis.com/auth/youtube.readonly",
    authParams: { prompt: "select_account" },
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    userInfo: async (token) => {
      const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      const d = (await r.json()) as { items?: { id?: string; snippet: { title: string; customUrl?: string; thumbnails?: { default?: { url?: string } } } }[] };
      const c = d.items?.[0];
      if (!c) return null;
      // customUrl is the @handle — exactly what the live-chat resolver wants.
      const handle = c.snippet.customUrl ? (c.snippet.customUrl.startsWith("@") ? c.snippet.customUrl : `@${c.snippet.customUrl}`) : (c.id ?? `@${c.snippet.title}`);
      return { handle, displayName: c.snippet.title, avatar: c.snippet.thumbnails?.default?.url, id: c.id };
    },
  },
  x: {
    authorizeUrl: "https://x.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    scopes: "tweet.read users.read",
    pkce: true,
    basicAuth: true,
    clientId: env.X_CLIENT_ID,
    clientSecret: env.X_CLIENT_SECRET,
    userInfo: async (token) => {
      const r = await fetch("https://api.x.com/2/users/me?user.fields=profile_image_url", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      const d = (await r.json()) as { data?: { username: string; name: string; profile_image_url?: string; id?: string } };
      if (!d.data) return null;
      return { handle: `@${d.data.username}`, displayName: d.data.name, avatar: d.data.profile_image_url?.replace("_normal.", "_400x400."), id: d.data.id };
    },
  },
  kick: {
    authorizeUrl: "https://id.kick.com/oauth/authorize",
    tokenUrl: "https://id.kick.com/oauth/token",
    scopes: "user:read channel:read",
    pkce: true,
    clientId: env.KICK_CLIENT_ID,
    clientSecret: env.KICK_CLIENT_SECRET,
    userInfo: async (token) => {
      // The channel endpoint (no params) = the authenticated user's own channel → slug.
      const rc = await fetch("https://api.kick.com/public/v1/channels", { headers: { Authorization: `Bearer ${token}` } });
      if (rc.ok) {
        const d = (await rc.json()) as { data?: { slug?: string; broadcaster_user_id?: number; banner_picture?: string }[] };
        const c = d.data?.[0];
        if (c?.slug) return { handle: c.slug, displayName: c.slug, id: c.broadcaster_user_id ? String(c.broadcaster_user_id) : undefined };
      }
      const r = await fetch("https://api.kick.com/public/v1/users", { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return null;
      const d = (await r.json()) as { data?: { name: string; user_id?: number; profile_picture?: string }[] };
      const u = d.data?.[0];
      return u ? { handle: u.name, displayName: u.name, avatar: u.profile_picture, id: u.user_id ? String(u.user_id) : undefined } : null;
    },
  },
};

export const isPlatform = (p: string): p is Platform => (PLATFORMS as string[]).includes(p);
export const configured = (p: Platform) => Boolean(PROVIDERS[p].clientId && PROVIDERS[p].clientSecret);

export const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha256 = (s: string) => createHash("sha256").update(s).digest();

/** Public origin for redirect URIs — PUBLIC_URL if set, else from the request. */
export function publicOrigin(req: IncomingMessage): string {
  if (env.PUBLIC_URL) return env.PUBLIC_URL.replace(/\/+$/, "");
  const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost").split(",")[0].trim();
  const fwd = req.headers["x-forwarded-proto"] ? String(req.headers["x-forwarded-proto"]).split(",")[0].trim() : "";
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = fwd || ((req.socket as { encrypted?: boolean } | undefined)?.encrypted ? "https" : local ? "http" : "https");
  return `${proto}://${host}`;
}
export const redirectUri = (req: IncomingMessage, p: Platform) => `${publicOrigin(req)}/api/auth/${p}/callback`;

// --- signed state cookie (state + PKCE verifier survive the round trip) ---
const COOKIE = "mb_oauth";
const stateSecret = () =>
  env.OAUTH_STATE_SECRET || [env.TWITCH_CLIENT_SECRET, env.GOOGLE_CLIENT_SECRET, env.X_CLIENT_SECRET, env.KICK_CLIENT_SECRET].filter(Boolean).join("|") || "mb-dev-state";
const sign = (payload: string) => b64url(createHmac("sha256", stateSecret()).update(payload).digest());

export function newState(): string { return b64url(randomBytes(16)); }
export function newVerifier(): string { return b64url(randomBytes(32)); }
export function challengeOf(verifier: string): string { return b64url(sha256(verifier)); }

export function setPendingCookie(res: ServerResponse, data: { platform: Platform; state: string; verifier?: string }, secure: boolean) {
  const p = b64url(Buffer.from(JSON.stringify({ ...data, iat: Date.now() })));
  const value = `${p}.${sign(p)}`;
  res.setHeader("Set-Cookie", `${COOKIE}=${value}; Path=/api/auth; Max-Age=600; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`);
}
export function readPendingCookie(req: IncomingMessage): { platform: Platform; state: string; verifier?: string } | null {
  const raw = String(req.headers.cookie ?? "").split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`));
  if (!raw) return null;
  const [p, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (!p || !sig || sign(p) !== sig) return null;
  try {
    const d = JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString()) as { platform: Platform; state: string; verifier?: string; iat: number };
    if (!d.state || Date.now() - d.iat > 10 * 60_000) return null;
    return d;
  } catch { return null; }
}
export function clearPendingCookie(res: ServerResponse, secure: boolean) {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`);
}

/** code → access token (client-secret in body, or HTTP Basic for X). */
export async function exchangeCode(p: Platform, code: string, redirect: string, verifier?: string): Promise<string | null> {
  const prov = PROVIDERS[p];
  const body = new URLSearchParams({ client_id: prov.clientId!, code, grant_type: "authorization_code", redirect_uri: redirect });
  if (verifier) body.set("code_verifier", verifier);
  const headers: Record<string, string> = { "Content-Type": "application/x-www-form-urlencoded" };
  if (prov.basicAuth) headers.Authorization = `Basic ${Buffer.from(`${prov.clientId}:${prov.clientSecret}`).toString("base64")}`;
  else body.set("client_secret", prov.clientSecret!);
  const r = await fetch(prov.tokenUrl, { method: "POST", headers, body });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    console.error(`[oauth:${p}] token exchange ${r.status}: ${t.slice(0, 300)}`);
    return null;
  }
  const d = (await r.json()) as { access_token?: string };
  return d.access_token ?? null;
}

/** Does the platform accept our client id + secret? (client-credentials grant; Twitch + Kick support it.) */
export async function checkCredentials(): Promise<Record<string, { ok: boolean; status?: number; error?: string }>> {
  const out: Record<string, { ok: boolean; status?: number; error?: string }> = {};
  for (const p of ["twitch", "kick"] as Platform[]) {
    if (!configured(p)) { out[p] = { ok: false, error: "not configured" }; continue; }
    const prov = PROVIDERS[p];
    try {
      const r = await fetch(prov.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "client_credentials", client_id: prov.clientId!, client_secret: prov.clientSecret! }),
      });
      const body = (await r.json().catch(() => ({}))) as { message?: string; error?: string; error_description?: string };
      out[p] = r.ok ? { ok: true, status: r.status } : { ok: false, status: r.status, error: body.message || body.error_description || body.error || `HTTP ${r.status}` };
    } catch (e) {
      out[p] = { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
  return out;
}

function escapeHtml(v: string): string {
  return v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Tiny HTML page that reports back to the opener window and closes itself. */
export function popupHtml(message: string, account?: { platform: Platform; handle: string; displayName: string; avatar?: string; id?: string }, error = false): string {
  const payload = JSON.stringify(account ? { type: "mb-auth", ...account } : { type: "mb-auth", error: message }).replace(/</g, "\\u003c");
  return `<!doctype html><meta charset=utf-8><title>Market Bubble</title><body style="background:#04100c;color:${error ? "#ffb4b4" : "#16e6a4"};font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center;padding:24px"><h3 style="margin:0 0 8px">${escapeHtml(message)}</h3><p style="color:#78b6a4;margin:0">You can close this window.</p></div>
<script>try{window.opener&&window.opener.postMessage(${payload},"*")}catch(e){}setTimeout(function(){window.close()},${error ? 4000 : 1200})</script>`;
}
