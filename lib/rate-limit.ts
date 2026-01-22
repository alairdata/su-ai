/**
 * Simple in-memory rate limiter using sliding window algorithm
 * For production with multiple instances, consider using @upstash/ratelimit with Redis
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limiting (per-instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  // Maximum number of requests allowed in the window
  limit: number;
  // Time window in seconds
  windowSeconds: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetIn: number; // seconds until reset
}

// Preset configurations for different endpoint types
export const RATE_LIMITS = {
  // Auth endpoints - stricter limits to prevent brute force
  signup: { limit: 5, windowSeconds: 60 * 60 }, // 5 per hour
  login: { limit: 10, windowSeconds: 60 * 15 }, // 10 per 15 minutes
  passwordReset: { limit: 3, windowSeconds: 60 * 60 }, // 3 per hour

  // API endpoints - more generous for normal usage
  messages: { limit: 60, windowSeconds: 60 }, // 60 per minute (1/sec average)
  chats: { limit: 30, windowSeconds: 60 }, // 30 per minute
  general: { limit: 100, windowSeconds: 60 }, // 100 per minute

  // Payment/sensitive endpoints
  payment: { limit: 10, windowSeconds: 60 * 5 }, // 10 per 5 minutes

  // Webhooks - allow more for external services
  webhook: { limit: 100, windowSeconds: 60 }, // 100 per minute
} as const;

/**
 * Check if a request should be rate limited
 * @param identifier - Unique identifier (IP address, user ID, or combination)
 * @param config - Rate limit configuration
 * @returns RateLimitResult with success status and metadata
 */
export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  const windowMs = config.windowSeconds * 1000;

  const entry = rateLimitStore.get(key);

  // If no entry or window has passed, create new entry
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
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

  // Check if limit exceeded
  if (entry.count >= config.limit) {
    const resetIn = Math.ceil((entry.resetTime - now) / 1000);
    return {
      success: false,
      limit: config.limit,
      remaining: 0,
      resetIn,
    };
  }

  // Increment counter
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
 * Handles various proxy scenarios (Vercel, Cloudflare, etc.)
 */
export function getClientIP(request: Request): string {
  // Try various headers in order of preference
  const headers = new Headers(request.headers);

  // Vercel/Cloudflare
  const xForwardedFor = headers.get('x-forwarded-for');
  if (xForwardedFor) {
    // Take the first IP (original client)
    return xForwardedFor.split(',')[0].trim();
  }

  // Cloudflare
  const cfConnectingIP = headers.get('cf-connecting-ip');
  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Vercel
  const xRealIP = headers.get('x-real-ip');
  if (xRealIP) {
    return xRealIP;
  }

  // Fallback
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
