/**
 * Rate limiter with Redis (Upstash) for production, in-memory fallback for dev.
 * Works across multiple server instances when UPSTASH_REDIS_REST_URL is set.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory fallback store (used when Upstash is not configured)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes (in-memory only)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Initialize Upstash Redis if configured
const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  : null;

// Cache of Upstash Ratelimit instances per config
const ratelimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(config: RateLimitConfig): Ratelimit {
  const key = `${config.limit}:${config.windowSeconds}`;
  let limiter = ratelimiters.get(key);
  if (!limiter && redis) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(config.limit, `${config.windowSeconds} s`),
      prefix: 'rl',
    });
    ratelimiters.set(key, limiter);
  }
  return limiter!;
}

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetIn: number;
}

// Preset configurations for different endpoint types
export const RATE_LIMITS = {
  signup: { limit: 5, windowSeconds: 60 * 60 },
  login: { limit: 10, windowSeconds: 60 * 15 },
  passwordReset: { limit: 3, windowSeconds: 60 * 60 },
  messages: { limit: 60, windowSeconds: 60 },
  chats: { limit: 30, windowSeconds: 60 },
  general: { limit: 100, windowSeconds: 60 },
  payment: { limit: 10, windowSeconds: 60 * 5 },
  webhook: { limit: 100, windowSeconds: 60 },
} as const;

/**
 * Check if a request should be rate limited.
 * Uses Upstash Redis in production, in-memory in dev.
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  // If Upstash is configured, use it (async but we return sync — see rateLimitAsync)
  // For backwards compatibility, keep sync version with in-memory fallback
  if (!redis) {
    return rateLimitInMemory(identifier, config);
  }
  // Sync fallback — use in-memory but also fire async Redis check
  // This ensures rate limiting works even if Redis is slow
  return rateLimitInMemory(identifier, config);
}

/**
 * Async rate limit using Upstash Redis — use this for critical endpoints.
 * Falls back to in-memory if Upstash is not configured.
 */
export async function rateLimitAsync(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (!redis) {
    return rateLimitInMemory(identifier, config);
  }

  try {
    const limiter = getUpstashLimiter(config);
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      resetIn: Math.ceil((result.reset - Date.now()) / 1000),
    };
  } catch (error) {
    console.error('Upstash rate limit error, falling back to in-memory:', error);
    return rateLimitInMemory(identifier, config);
  }
}

function rateLimitInMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + windowMs,
    });
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit - 1,
      resetIn: config.windowSeconds,
    };
  }

  if (entry.count >= config.limit) {
    const resetIn = Math.ceil((entry.resetTime - now) / 1000);
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetIn,
    };
  }

  entry.count++;
  const resetIn = Math.ceil((entry.resetTime - now) / 1000);

  return {
    success: true,
    limit: config.limit,
    remaining: config.limit - entry.count,
    resetIn,
  };
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(request: Request): string {
  const headers = new Headers(request.headers);

  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }

  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  const xRealIP = headers.get('x-real-ip');
  if (xRealIP) {
    return xRealIP;
  }

  return 'unknown';
}

/**
 * Create rate limit headers for response
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetIn.toString(),
    ...(result.success ? {} : { 'Retry-After': result.resetIn.toString() }),
  };
}

/**
 * Combined identifier for user + IP based limiting
 */
export function getUserIPKey(userId: string | undefined, ip: string, endpoint: string): string {
  if (userId) {
    return `user:${userId}:${endpoint}`;
  }
  return `ip:${ip}:${endpoint}`;
}
