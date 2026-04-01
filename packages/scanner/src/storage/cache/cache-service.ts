/**
 * Cache Service
 *
 * Provides caching functionality for scan results using Redis.
 * Uses SHA-256 content hashing for cache keys.
 *
 * When Redis is unavailable, caching is silently skipped (no-op).
 */

import { createHash } from 'crypto'
import { RedisService } from './client'
import { ScanResult } from '../../types'

/**
 * Cache Service
 *
 * Manages scan result caching with content-based keys
 */
export class CacheService {
  private readonly CACHE_PREFIX = 'scan:'
  private readonly DEFAULT_TTL = 3600 // 1 hour in seconds

  constructor(private redis: RedisService) {}

  /**
   * Get cached scan result by content
   *
   * @param content - File content to hash and look up
   * @returns Cached scan result or null if not found
   */
  async get(content: string): Promise<ScanResult | null> {
    const key = this.getCacheKey(content)
    const cached = await this.redis.get(key)

    if (!cached) {
      return null
    }

    try {
      return JSON.parse(cached) as ScanResult
    } catch (error) {
      console.error('Failed to parse cached result:', error)
      return null
    }
  }

  /**
   * Set scan result in cache
   *
   * @param content - File content to hash for key
   * @param result - Scan result to cache
   * @param ttl - Time to live in seconds (default: 3600)
   */
  async set(content: string, result: ScanResult, ttl: number = this.DEFAULT_TTL): Promise<void> {
    const key = this.getCacheKey(content)

    const result_set = await this.redis.setex(key, ttl, JSON.stringify(result))
    if (result_set !== 'OK') {
      console.warn('Failed to cache result - Redis unavailable')
    }
  }

  /**
   * Invalidate cached scan result
   *
   * @param content - File content to hash and invalidate
   */
  async invalidate(content: string): Promise<void> {
    const key = this.getCacheKey(content)
    await this.redis.del(key)
  }

  /**
   * Compute SHA-256 hash of content for cache key
   *
   * @param content - Content to hash
   * @returns SHA-256 hex digest
   */
  private computeHash(content: string): string {
    return createHash('sha256').update(content).digest('hex')
  }

  /**
   * Get cache key for content
   *
   * @param content - Content to generate key for
   * @returns Redis key with prefix
   */
  private getCacheKey(content: string): string {
    const hash = this.computeHash(content)
    return `${this.CACHE_PREFIX}${hash}`
  }
}
