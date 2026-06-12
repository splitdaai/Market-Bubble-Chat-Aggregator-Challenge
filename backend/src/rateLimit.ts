import type { NextFunction, Request, RequestHandler, Response } from "express";

interface RateLimitOptions {
  name: string;
  windowMs: number;
  max: number;
}

type Bucket = { resetAt: number; count: number };

function clientKey(req: Request, name: string) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `${name}:${ip}`;
}

export function createIpRateLimit({ name, windowMs, max }: RateLimitOptions): RequestHandler {
  const buckets = new Map<string, Bucket>();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, Math.max(windowMs, 30_000));
  cleanup.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = clientKey(req, name);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count <= max) return next();

    res.set("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
    return res.status(429).json({ error: "rate limit exceeded" });
  };
}
