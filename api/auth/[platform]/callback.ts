// GET /api/auth/:platform/callback — verify state, exchange the code, read the
// account identity, hand it to the opener window, close the popup. No token is
// kept: read-only chat aggregation only needs to know WHICH channel is yours.
import type { IncomingMessage, ServerResponse } from "node:http";
import { PROVIDERS, clearPendingCookie, exchangeCode, isPlatform, popupHtml, publicOrigin, readPendingCookie, redirectUri } from "../../_oauth.js";

export default async function handler(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://x");
  const platform = String(req.query?.platform ?? url.pathname.split("/").filter(Boolean).slice(-2, -1)[0] ?? "");
  const secure = publicOrigin(req).startsWith("https");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const fail = (msg: string) => { console.error(`[oauth:${platform}] ${msg}`); clearPendingCookie(res, secure); res.statusCode = 200; res.end(popupHtml(msg, undefined, true)); };
  if (!isPlatform(platform)) return fail("Unknown platform");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");
  if (denied) return fail(`${platform} login was cancelled (${denied})`);
  const pending = readPendingCookie(req);
  if (!code || !state || !pending || pending.state !== state || pending.platform !== platform) {
    console.error(`[oauth:${platform}] state check failed: code=${Boolean(code)} state=${Boolean(state)} cookie=${Boolean(pending)} match=${pending?.state === state} host=${String(req.headers.host)}`);
    return fail("Login session expired — please try Connect again");
  }
  try {
    const token = await exchangeCode(platform, code, redirectUri(req, platform), pending.verifier);
    if (!token) return fail(`${platform} rejected the login (token exchange failed) — check the app's redirect URI matches ${redirectUri(req, platform)}`);
    const info = await PROVIDERS[platform].userInfo(token, PROVIDERS[platform].clientId!);
    if (!info) return fail("Logged in, but couldn't read the account details");
    clearPendingCookie(res, secure);
    res.statusCode = 200;
    res.end(popupHtml(`Connected ${info.displayName}`, { platform, handle: info.handle, displayName: info.displayName, avatar: info.avatar, id: info.id }));
  } catch (e) {
    fail(`OAuth error: ${e instanceof Error ? e.message : String(e)}`);
  }
}
