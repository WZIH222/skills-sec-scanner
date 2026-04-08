/**
 * SSE Connection Tracker
 *
 * Tracks active SSE connections per user using Redis with TTL.
 * Per D-06 (RATE-02): 1 SSE connection per user, 429 if exceeded.
 */

import { Redis } from 'ioredis'

const SSE_CONNECTION_TTL = 300 // 5 minutes (matches SSE timeout in ws/route.ts)

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
      enableReadyCheck: false,
    })

    redisClient.on('error', (err) => {
      console.error('[SSE] Redis client error:', err.message)
      if (redisClient) {
        redisClient.disconnect()
        redisClient = null
      }
    })

    return redisClient
  } catch {
    return null
  }
}

/**
 * SSE Connection Manager
 *
 * Tracks active SSE connections per userId using Redis SET NX.
 * Returns true if connection was acquired, false if user already has one.
 */
export class SseConnectionManager {
  /**
   * Try to acquire an SSE connection for a user
   *
   * Uses Redis SET with NX (only set if not exists) and EX (expiry).
   * Returns true if connection acquired, false if user already has active connection.
   *
   * @param userId - User ID to track
   * @returns true if connection acquired, false if limit exceeded
   */
  async acquireConnection(userId: string): Promise<boolean> {
    const redis = getRedisClient()
    if (!redis) {
      // If Redis unavailable, allow connection (fail-open for SSE)
      return true
    }

    try {
      const key = `sse:conn:${userId}`
      const result = await redis.set(key, Date.now().toString(), 'EX', SSE_CONNECTION_TTL, 'NX')
      return result === 'OK'
    } catch {
      // Redis error, fail-open
      return true
    }
  }

  /**
   * Refresh SSE connection TTL (heartbeat)
   *
   * Call this periodically to keep the connection alive.
   *
   * @param userId - User ID whose connection to refresh
   */
  async refreshConnection(userId: string): Promise<void> {
    const redis = getRedisClient()
    if (!redis) return

    try {
      const key = `sse:conn:${userId}`
      await redis.expire(key, SSE_CONNECTION_TTL)
    } catch {
      // Ignore errors on refresh
    }
  }

  /**
   * Release SSE connection for a user
   *
   * Call this when the SSE connection closes.
   *
   * @param userId - User ID whose connection to release
   */
  async releaseConnection(userId: string): Promise<void> {
    const redis = getRedisClient()
    if (!redis) return

    try {
      const key = `sse:conn:${userId}`
      await redis.del(key)
    } catch {
      // Ignore errors on release
    }
  }

  /**
   * Check if user has an active SSE connection
   *
   * @param userId - User ID to check
   * @returns true if user has active connection
   */
  async hasConnection(userId: string): Promise<boolean> {
    const redis = getRedisClient()
    if (!redis) return false

    try {
      const key = `sse:conn:${userId}`
      const exists = await redis.exists(key)
      return exists === 1
    } catch {
      return false
    }
  }

  /**
   * Get TTL remaining on user's SSE connection
   *
   * @param userId - User ID to check
   * @returns TTL in seconds, or -2 if key doesn't exist, -1 if no expiry
   */
  async getConnectionTtl(userId: string): Promise<number> {
    const redis = getRedisClient()
    if (!redis) return -2

    try {
      const key = `sse:conn:${userId}`
      return await redis.ttl(key)
    } catch {
      return -2
    }
  }
}

// Export singleton instance
export const sseConnectionManager = new SseConnectionManager()
