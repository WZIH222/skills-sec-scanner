/**
 * Redis-backed distributed rate limiter
 *
 * Uses sliding window algorithm with Redis for distributed
 * rate limiting across multiple server instances.
 * Per D-05 (RATE-01): fail-open if Redis unavailable.
 */

import { Redis } from 'ioredis'

interface RateLimitEntry {
  count: number
  resetTime: number
}

let redisClient: Redis | null = null

/**
 * Get or create Redis client singleton
 */
function getRedisClient(): Redis | null {
  if (redisClient) return redisClient

  const redisUrl = process.env.REDIS_URL
  if (!redisUrl || redisUrl === 'disabled') {
    return null
  }

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      enableReadyCheck: false,
    })

    redisClient.on('error', () => {
      redisClient = null
    })

    return redisClient
  } catch {
    return null
  }
}

export class RateLimiter {
  constructor(
    public maxRequests: number = 100,
    public windowMs: number = 60000
  ) {}

  /**
   * Check if request should be rate limited
   * Returns true if rate limit exceeded
   * FAIL-OPEN: if Redis unavailable, allows request
   */
  async isRateLimited(identifier: string): Promise<boolean> {
    const redis = getRedisClient()
    if (!redis) {
      // Fail-open: allow request if Redis unavailable
      return false
    }

    try {
      const now = Date.now()
      const windowStart = Math.floor(now / this.windowMs) * this.windowMs
      const key = `ratelimit:${identifier}:${windowStart}`

      const multi = redis.multi()
      multi.incr(key)
      multi.expire(key, Math.ceil(this.windowMs / 1000))
      const results = await multi.exec()

      const count = results?.[0]?.[1] as number | undefined
      if (count === undefined) {
        return false // Redis operation failed, fail-open
      }

      return count > this.maxRequests
    } catch {
      // Redis error, fail-open
      return false
    }
  }

  /**
   * Get remaining requests for identifier
   */
  async getRemainingRequests(identifier: string): Promise<number> {
    const redis = getRedisClient()
    if (!redis) {
      return this.maxRequests
    }

    try {
      const now = Date.now()
      const windowStart = Math.floor(now / this.windowMs) * this.windowMs
      const key = `ratelimit:${identifier}:${windowStart}`

      const count = await redis.get(key)
      if (!count) {
        return this.maxRequests
      }

      return Math.max(0, this.maxRequests - parseInt(count, 10))
    } catch {
      return this.maxRequests
    }
  }

  /**
   * Get reset time for identifier (as Unix timestamp)
   */
  async getResetTime(identifier: string): Promise<number | null> {
    const redis = getRedisClient()
    if (!redis) {
      return null
    }

    try {
      const now = Date.now()
      const windowStart = Math.floor(now / this.windowMs) * this.windowMs
      const key = `ratelimit:${identifier}:${windowStart}`

      const ttl = await redis.ttl(key)
      if (ttl <= 0) {
        return null
      }

      return now + (ttl * 1000)
    } catch {
      return null
    }
  }

  /**
   * Reset rate limit for identifier (for testing or admin use)
   */
  async reset(identifier: string): Promise<void> {
    const redis = getRedisClient()
    if (!redis) return

    try {
      const now = Date.now()
      const windowStart = Math.floor(now / this.windowMs) * this.windowMs
      const key = `ratelimit:${identifier}:${windowStart}`
      await redis.del(key)
    } catch {
      // Ignore errors on reset
    }
  }
}

/**
 * Extract identifier from request for rate limiting
 * Matches the existing interface from the in-memory implementation
 */
export function getRateLimitIdentifier(request: Request): string {
  const userId = request.headers.get('x-user-id')
  if (userId) {
    return `user:${userId}`
  }

  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown'
  return `ip:${ip}`
}

/**
 * Pre-configured rate limiters for different endpoint types
 * These are instances, not classes — same interface as before
 */
export const rateLimiters = {
  auth: new RateLimiter(5, 60000),   // 5 requests per minute
  api: new RateLimiter(100, 60000),  // 100 requests per minute
  read: new RateLimiter(200, 60000), // 200 requests per minute
}
