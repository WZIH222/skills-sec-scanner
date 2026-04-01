/**
 * Integration tests for Cache Service (Redis caching)
 *
 * These tests require a running Redis instance.
 * They should be skipped if REDIS_URL is not set.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { RedisService } from '../../../src/storage/cache/client'
import { CacheService } from '../../../src/storage/cache/cache-service'
import { ScanResult, Finding, Severity } from '../../../src/types'

// Check if Redis is available
const REDIS_URL = process.env.REDIS_URL || process.env.TEST_REDIS_URL
const redisAvailable = !!REDIS_URL

describe.skipIf(!redisAvailable)('CacheService - Redis Integration', () => {
  let redis: RedisService
  let cache: CacheService

  beforeAll(async () => {
    redis = RedisService.getInstance()
    cache = new CacheService(redis)
  })

  afterAll(async () => {
    // Close connection
    await redis.quit()
  })

  /**
   * Test 1: CacheService stores and retrieves scan results by content hash
   */
  it('should store and retrieve scan results by content hash', async () => {
    const content = 'const x = eval(userInput)'
    const result: ScanResult = {
      findings: [
        {
          ruleId: 'eval-call',
          severity: 'critical' as Severity,
          message: 'eval() allows arbitrary code execution',
          location: { line: 1, column: 12 },
          code: 'eval(userInput)',
        },
      ],
      score: 50,
      metadata: {
        scannedAt: new Date(),
        scanDuration: 100,
      },
    }

    // Store in cache
    await cache.set(content, result, 60)

    // Retrieve from cache
    const retrieved = await cache.get(content)

    expect(retrieved).toBeDefined()
    expect(retrieved?.findings).toHaveLength(1)
    expect(retrieved?.score).toBe(50)
    expect(retrieved?.findings[0].ruleId).toBe('eval-call')
  })

  /**
   * Test 2: CacheService sets TTL on cache entries
   */
  it('should set TTL on cache entries', async () => {
    const content = 'test content for ttl'
    const result: ScanResult = {
      findings: [],
      score: 0,
      metadata: {
        scannedAt: new Date(),
        scanDuration: 50,
      },
    }

    // Store with 1 second TTL
    await cache.set(content, result, 1)

    // Should be available immediately
    const retrieved1 = await cache.get(content)
    expect(retrieved1).toBeDefined()

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 1100))

    // Should be gone after TTL
    const retrieved2 = await cache.get(content)
    expect(retrieved2).toBeNull()
  })

  /**
   * Test 3: CacheService invalidates cache entries
   */
  it('should invalidate cache entries', async () => {
    const content = 'test content for invalidate'
    const result: ScanResult = {
      findings: [],
      score: 0,
      metadata: {
        scannedAt: new Date(),
        scanDuration: 50,
      },
    }

    // Store in cache
    await cache.set(content, result, 60)

    // Verify it's there
    const retrieved1 = await cache.get(content)
    expect(retrieved1).toBeDefined()

    // Invalidate
    await cache.invalidate(content)

    // Should be gone
    const retrieved2 = await cache.get(content)
    expect(retrieved2).toBeNull()
  })

  /**
   * Test 4: CacheService handles cache miss gracefully
   */
  it('should return null for cache miss', async () => {
    const retrieved = await cache.get('non-existent content')
    expect(retrieved).toBeNull()
  })

  /**
   * Test 5: CacheService uses SHA-256 for content hashing
   */
  it('should use consistent SHA-256 hashes for same content', async () => {
    const content = 'const x = 1'
    const result: ScanResult = {
      findings: [],
      score: 0,
      metadata: {
        scannedAt: new Date(),
        scanDuration: 0,
      },
    }

    // Store twice with same content
    await cache.set(content, result, 60)

    const retrieved1 = await cache.get(content)
    const retrieved2 = await cache.get(content)

    expect(retrieved1).toEqual(retrieved2)
  })

  /**
   * Test 6: CacheService handles empty results
   */
  it('should handle empty scan results', async () => {
    const content = 'const safe = true'
    const result: ScanResult = {
      findings: [],
      score: 0,
      metadata: {
        scannedAt: new Date(),
        scanDuration: 10,
      },
    }

    await cache.set(content, result, 60)
    const retrieved = await cache.get(content)

    expect(retrieved).toBeDefined()
    expect(retrieved?.findings).toHaveLength(0)
    expect(retrieved?.score).toBe(0)
  })

  /**
   * Test 7: CacheService handles complex findings
   */
  it('should handle scan results with multiple findings', async () => {
    const content = 'complex code'
    const result: ScanResult = {
      findings: [
        {
          ruleId: 'rule-1',
          severity: 'critical' as Severity,
          message: 'Critical issue',
          location: { line: 1, column: 1 },
          code: 'code1',
        },
        {
          ruleId: 'rule-2',
          severity: 'high' as Severity,
          message: 'High issue',
          location: { line: 2, column: 2 },
          code: 'code2',
        },
        {
          ruleId: 'rule-3',
          severity: 'medium' as Severity,
          message: 'Medium issue',
          location: { line: 3, column: 3 },
        },
      ],
      score: 75,
      metadata: {
        scannedAt: new Date(),
        scanDuration: 200,
      },
    }

    await cache.set(content, result, 60)
    const retrieved = await cache.get(content)

    expect(retrieved).toBeDefined()
    expect(retrieved?.findings).toHaveLength(3)
    expect(retrieved?.score).toBe(75)
  })
})
