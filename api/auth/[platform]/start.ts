// GET /api/auth/:platform/start — kick off the OAuth popup: mint state (+ PKCE),
// stash them in a signed short-lived cookie, redirect to the platform.
import type { IncomingMessage, ServerResponse } from "node:http";
import { PROVIDERS, challengeOf, configured, isPlatform, newState, newVerifier, popupHtml, publicOrigin, redirectUri, setPendingCookie } from "../../_oauth.js";

export default function handler(req: IncomingMessage & { query?: Record<string, string | string[]> }, res: ServerResponse) {
  const url = new URL(req.url ?? "/", "http://x");
  const platform = String(req.query?.platform ?? url.pathname.split("/").filter(Boolean).slice(-2, -1)[0] ?? "");
  res.setHeader("Cache-Control", "no-store");
  if (!isPlatform(platform)) { res.statusCode = 400; res.setHeader("Content-Type", "text/html"); return res.end(popupHtml("Unknown platform", undefined, true)); }
  if (!configured(platform)) {
    res.statusCode = 400; res.setHeader("Content-Type", "text/html");
    return res.end(popupHtml(`${platform} login isn't set up yet — add its CLIENT_ID / CLIENT_SECRET in Vercel`, undefined, true));
  }
  const prov = PROVIDERS[platform];
  const state = newState();
  const params = new URLSearchParams({ client_id: prov.clientId!, redirect_uri: redirectUri(req, platform), response_type: "code", scope: prov.scopes, state });
  for (const [k, v] of Object.entries(prov.authParams ?? {})) params.set(k, v);
  let verifier: string | undefined;
  if (prov.pkce) { verifier = newVerifier(); params.set("code_challenge", challengeOf(verifier)); params.set("code_challenge_method", "S256"); }
  setPendingCookie(res, { platform, state, verifier }, publicOrigin(req).startsWith("https"));
  res.statusCode = 302;
  res.setHeader("Location", `${prov.authorizeUrl}?${params.toString()}`);
  res.end();
}
