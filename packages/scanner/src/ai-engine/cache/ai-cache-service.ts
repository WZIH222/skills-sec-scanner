/**
 * AI Cache Service
 *
 * Provides caching functionality for AI analysis results.
 * Uses SHA-256 content hashing with versioning for cache invalidation.
 * Composes RedisService directly for AI-specific caching needs.
 */

import { createHash } from 'crypto'
import type { AIAnalysisResult } from '../types'
import { RedisService } from '../../storage/cache/client'

/**
 * AI Cache Service
 *
 * Manages AI analysis result caching with content-based keys and versioning.
 * Uses RedisService directly with custom cache keys and TTL.
 */
export class AICacheService {
  private readonly CACHE_PREFIX = 'ai-analysis:'
  private readonly CACHE_VERSION = 'v1' // Increment to invalidate all caches
  private readonly CACHE_TTL = 86400 // 24 hours in seconds

  constructor(private redis: RedisService) {}

  /**
   * Get cached AI analysis result by content
   *
   * @param content - File content to hash and look up
   * @returns Cached AI analysis result or null if not found
   */
  async getAIAnalysis(content: string): Promise<AIAnalysisResult | null> {
    const key = this.getCacheKey(content)
    const cached = await this.redis.get(key)

    if (!cached) {
      return null
    }

    try {
      return JSON.parse(cached) as AIAnalysisResult
    } catch (error) {
      console.error('Failed to parse cached AI analysis:', error)
      return null // Invalid cache entry, treat as miss
    }
  }

  /**
   * Set AI analysis result in cache
   *
   * @param content - File content to hash for key
   * @param result - AI analysis result to cache
   */
  async setAIAnalysis(content: string, result: AIAnalysisResult): Promise<void> {
    const key = this.getCacheKey(content)

    try {
      const serialized = JSON.stringify(result)
      await this.redis.setex(key, this.CACHE_TTL, serialized)
    } catch (error) {
      console.error('Failed to cache AI analysis:', error)
      throw error
    }
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
   * Get cache key for content with version prefix
   *
   * @param content - Content to generate key for
   * @returns Redis key with prefix and version
   */
  private getCacheKey(content: string): string {
    const hash = this.computeHash(content)
    return `${this.CACHE_PREFIX}${this.CACHE_VERSION}:${hash}`
  }

  /**
   * Invalidate all AI caches by incrementing version
   *
   * Call this when AI prompts improve significantly.
   * Note: This requires manual code update to CACHE_VERSION.
   *
   * @deprecated Update CACHE_VERSION manually instead
   */
  incrementVersion(): void {
    console.warn('AI cache version increment not implemented - update CACHE_VERSION manually')
  }
}
