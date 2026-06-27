import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const useUpstash = !!(redisUrl && redisToken);

const limiterCache = new Map<string, Ratelimit>();

function getUpstashLimiter(limit: number, windowMs: number) {
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const key = `${limit}:${windowSec}`;
  if (!limiterCache.has(key)) {
    const redis = new Redis({ url: redisUrl!, token: redisToken! });
    limiterCache.set(
      key,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
        analytics: false,
      })
    );
  }
  return limiterCache.get(key)!;
}

function memoryRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  if (useUpstash) {
    const limiter = getUpstashLimiter(limit, windowMs);
    const result = await limiter.limit(key);
    if (!result.success) {
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
      };
    }
    return { ok: true };
  }
  return memoryRateLimit(key, limit, windowMs);
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}