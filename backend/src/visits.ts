import type { Express, Request, Response } from "express";
import { createIpRateLimit } from "./rateLimit.ts";

const ALLOWED_HOSTS = new Set([
  "marketbubble-khaki.vercel.app",
  "marketbubble-live-preview.s3-website-us-east-1.amazonaws.com",
  "marketbubble.chat",
  "www.marketbubble.chat",
  "3-213-104-77.nip.io",
  "localhost",
  "127.0.0.1",
]);

const VALID_SITES = new Set(["khaki", "aws", "marketbubble", "backend", "local", "unknown"]);
const visitRateLimit = createIpRateLimit({ name: "visit", windowMs: 60_000, max: 240 });

function hostnameFrom(value: string | undefined) {
  if (!value) return "";
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function cleanParam(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim()
    .slice(0, max);
}

function originIsAllowed(req: Request) {
  const originHost = hostnameFrom(req.get("origin"));
  const refererHost = hostnameFrom(req.get("referer"));

  if (originHost && !ALLOWED_HOSTS.has(originHost)) return false;
  if (!originHost && refererHost && !ALLOWED_HOSTS.has(refererHost)) return false;
  return true;
}

function visitHandler(req: Request, res: Response) {
  res.set("Cache-Control", "no-store");
  res.set("X-Robots-Tag", "noindex");

  if (!originIsAllowed(req)) return res.status(204).end();

  const site = cleanParam(req.query.site, 32);
  if (site && !VALID_SITES.has(site)) return res.status(204).end();

  // The durable source of truth is Caddy's JSON access log, which captures this
  // bounded query string plus Origin/Referer/User-Agent for the private visits
  // parser. The API itself deliberately stores nothing and returns no body.
  return res.status(204).end();
}

export function mountVisitRoutes(app: Express) {
  app.get("/api/visit", visitRateLimit, visitHandler);
  app.post("/api/visit", visitRateLimit, visitHandler);
}
