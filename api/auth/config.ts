// Which platforms have OAuth app credentials set (Vercel env vars) — the UI
// shows "Connect" for these and "Set up" (with the exact env var names) otherwise.
import type { IncomingMessage, ServerResponse } from "node:http";
import { PLATFORMS, configured, publicOrigin } from "../_oauth.js";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const out: Record<string, boolean> = {};
  for (const p of PLATFORMS) out[p] = configured(p);
  res.statusCode = 200;
  res.end(JSON.stringify({ configured: out, redirectBase: `${publicOrigin(req)}/api/auth` }));
}
