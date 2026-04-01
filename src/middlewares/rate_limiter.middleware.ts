import { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimiterOptions {
  windowMs: number;    // time window in ms — e.g. 60 * 1000 for 1 minute
  maxRequests: number; // max allowed requests per window per key
  message?: string;
}

/**
 * In-memory fixed window rate limiter.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
 *   router.post("/route", BasicAuthMiddleware, limiter, Controller);
 *
 * Identifies requests by API key value (req.apiKey.value set by BasicAuthMiddleware).
 * Falls back to IP if no API key is present.
 *
 * Returns standard headers on every response:
 *   X-RateLimit-Limit     — max requests allowed in window
 *   X-RateLimit-Remaining — requests left in current window
 *   X-RateLimit-Reset     — ISO timestamp when the window resets
 *   Retry-After           — seconds until reset (only on 429)
 */
const createRateLimiter = (options: RateLimiterOptions) => {
  const {
    windowMs,
    maxRequests,
    message = "Too many requests. Please slow down and try again later.",
  } = options;

  // key → { count, windowStart }
  const store = new Map<string, RateLimitEntry>();

  // Purge expired entries once per window to prevent unbounded memory growth
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart > windowMs) {
        store.delete(key);
      }
    }
  }, windowMs).unref(); // .unref() so this timer never prevents process from exiting cleanly

  return (req: Request, res: Response, next: NextFunction) => {
    // Prefer API key identity; fall back to client IP
    const identifier: string =
      (req as any).apiKey?.value ||
      ((req.headers["x-forwarded-for"] as string) || "")
        .split(",")[0]
        .trim() ||
      req.socket.remoteAddress ||
      "unknown";

    const now = Date.now();
    const entry = store.get(identifier);
    const windowExpired = !entry || now - entry.windowStart > windowMs;

    if (windowExpired) {
      store.set(identifier, { count: 1, windowStart: now });
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", maxRequests - 1);
      res.setHeader(
        "X-RateLimit-Reset",
        new Date(now + windowMs).toISOString()
      );
      return next();
    }

    if (entry.count >= maxRequests) {
      const resetAt = entry.windowStart + windowMs;
      const retryAfterSeconds = Math.ceil((resetAt - now) / 1000);

      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", new Date(resetAt).toISOString());
      res.setHeader("Retry-After", retryAfterSeconds);

      return res.status(429).json({
        success: false,
        message,
      });
    }

    entry.count++;
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", maxRequests - entry.count);
    res.setHeader(
      "X-RateLimit-Reset",
      new Date(entry.windowStart + windowMs).toISOString()
    );
    return next();
  };
};

export { createRateLimiter };
