/**
 * Redis Service - Redis Cache Client
 *
 * Singleton pattern for Redis client to ensure
 * only one connection is used throughout the application.
 *
 * When Redis is not available, the service gracefully degrades.
 */

import Redis from 'ioredis'

/**
 * Redis Service - Singleton cache client
 */
export class RedisService {
  private static instance: RedisService
  private redis: Redis | null = null
  private redisAvailable = false

  private constructor() {
    const redisUrl = process.env.REDIS_URL

    // Skip Redis if URL is not set or explicitly disabled
    if (!redisUrl || redisUrl === 'disabled') {
      console.warn('Redis is disabled - running without caching')
      return
    }

    try {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000)
          return delay
        },
        // Don't delay first connection attempt, fail fast if Redis is down
        enableReadyCheck: false,
      })

      this.redis.on('error', (error: Error) => {
        console.warn('Redis connection error - running without caching:', error.message)
        this.redisAvailable = false
      })

      this.redis.on('connect', () => {
        console.log('Redis connected')
        this.redisAvailable = true
      })

      // Set up ping to check if Redis is actually available
      this.redis.ping().then(() => {
        this.redisAvailable = true
      }).catch(() => {
        this.redisAvailable = false
      })
    } catch (error) {
      console.warn('Redis initialization failed - running without caching')
      this.redis = null
      this.redisAvailable = false
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService()
    }

    return RedisService.instance
  }

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return this.redis !== null && this.redisAvailable
  }

  /**
   * Get Redis client (may return null if Redis is unavailable)
   */
  get client(): Redis | null {
    return this.redis
  }

  /**
   * Get a value from Redis
   */
  async get(key: string): Promise<string | null> {
    if (!this.isAvailable()) return null
    try {
      return await this.redis!.get(key)
    } catch (error) {
      console.warn('Redis get failed:', error)
      return null
    }
  }

  /**
   * Set a value in Redis with expiration
   */
  async setex(key: string, seconds: number, value: string): Promise<'OK' | null> {
    if (!this.isAvailable()) return null
    try {
      return await this.redis!.setex(key, seconds, value)
    } catch (error) {
      console.warn('Redis setex failed:', error)
      return null
    }
  }

  /**
   * Set a value in Redis without expiration
   */
  async set(key: string, value: string): Promise<'OK' | null> {
    if (!this.isAvailable()) return null
    try {
      return await this.redis!.set(key, value)
    } catch (error) {
      console.warn('Redis set failed:', error)
      return null
    }
  }

  /**
   * Delete a key from Redis
   */
  async del(key: string): Promise<number> {
    if (!this.isAvailable()) return 0
    try {
      return await this.redis!.del(key)
    } catch (error) {
      console.warn('Redis del failed:', error)
      return 0
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<number> {
    if (!this.isAvailable()) return 0
    try {
      return await this.redis!.exists(key)
    } catch (error) {
      console.warn('Redis exists failed:', error)
      return 0
    }
  }

  /**
   * Set expiration time on a key
   */
  async expire(key: string, seconds: number): Promise<number> {
    if (!this.isAvailable()) return 0
    try {
      return await this.redis!.expire(key, seconds)
    } catch (error) {
      console.warn('Redis expire failed:', error)
      return 0
    }
  }

  /**
   * Flush all keys (use with caution)
   */
  async flushdb(): Promise<'OK' | null> {
    if (!this.isAvailable()) return null
    try {
      return await this.redis!.flushdb()
    } catch (error) {
      console.warn('Redis flushdb failed:', error)
      return null
    }
  }

  /**
   * Quit connection
   */
  async quit(): Promise<'OK' | null> {
    if (!this.isAvailable()) return null
    try {
      return await this.redis!.quit()
    } catch (error) {
      console.warn('Redis quit failed:', error)
      return null
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.disconnect()
      } catch (error) {
        console.warn('Redis disconnect failed:', error)
      }
    }
  }
}
