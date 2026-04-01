/**
 * Simple in-memory rate limiter for API routes
 *
 * In production, use Redis-based rate limiting for distributed systems
 * This implementation is suitable for single-server deployments
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor(
    public maxRequests: number = 100, // Maximum requests per window
    public windowMs: number = 60000 // Time window in milliseconds (default: 1 minute)
  ) {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 60000)
  }

  /**
   * Check if request should be rate limited
   * Returns true if rate limit exceeded
   */
  isRateLimited(identifier: string): boolean {
    const now = Date.now()
    const entry = this.store.get(identifier)

    // Reset if window expired
    if (!entry || now > entry.resetTime) {
      this.store.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      })
      return false
    }

    // Increment counter
    entry.count++

    // Check if limit exceeded
    if (entry.count > this.maxRequests) {
      return true
    }

    return false
  }

  /**
   * Get remaining requests for identifier
   */
  getRemainingRequests(identifier: string): number {
    const entry = this.store.get(identifier)
    if (!entry || Date.now() > entry.resetTime) {
      return this.maxRequests
    }
    return Math.max(0, this.maxRequests - entry.count)
  }

  /**
   * Get reset time for identifier
   */
  getResetTime(identifier: string): number | null {
    const entry = this.store.get(identifier)
    if (!entry) {
      return null
    }
    return entry.resetTime
  }

  /**
   * Reset rate limit for identifier (for testing or admin use)
   */
  reset(identifier: string): void {
    this.store.delete(identifier)
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.store.clear()
  }
}

/**
 * Extract identifier from request for rate limiting
 */
export function getRateLimitIdentifier(request: Request): string {
  // Try to get user ID from headers (set by middleware)
  const userId = request.headers.get('x-user-id')
  if (userId) {
    return `user:${userId}`
  }

  // Fall back to IP address
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown'
  return `ip:${ip}`
}

/**
 * Pre-configured rate limiters for different endpoint types
 */
export const rateLimiters = {
  // Strict rate limiter for authentication endpoints
  auth: new RateLimiter(5, 60000), // 5 requests per minute

  // Moderate rate limiter for API endpoints
  api: new RateLimiter(100, 60000), // 100 requests per minute

  // Lenient rate limiter for read-only endpoints
  read: new RateLimiter(200, 60000), // 200 requests per minute
}
