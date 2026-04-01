/**
 * Tests for AI Cache Service
 *
 * These tests verify SHA-256 content-based caching for AI analysis results.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AICacheService } from '../../../src/ai-engine/cache/ai-cache-service'
import type { AIAnalysisResult } from '../../../src/ai-engine/types'

describe('AICacheService', () => {
  let aiCache: AICacheService
  let mockRedis: any

  beforeEach(() => {
    // Create mock Redis service
    mockRedis = {
      get: vi.fn(),
      setex: vi.fn(),
      del: vi.fn(),
    }

    // Create AICacheService instance with mock
    aiCache = new AICacheService(mockRedis as any)
  })

  /**
   * Test 1: getAIAnalysis returns cached result
   */
  it('should return cached AI analysis result', async () => {
    const content = 'const x = eval(userInput)'
    const cachedResult: AIAnalysisResult = {
      findings: [
        {
          ruleId: 'eval-usage',
          severity: 'critical',
          message: 'eval() allows arbitrary code execution',
          explanation: 'This code uses eval() with user input, which allows arbitrary code execution. An attacker could execute malicious commands on your system.',
          confidence: 95,
        },
      ],
    }

    mockRedis.get.mockResolvedValue(JSON.stringify(cachedResult))

    const result = await aiCache.getAIAnalysis(content)

    expect(result).toEqual(cachedResult)
    expect(mockRedis.get).toHaveBeenCalled()
    expect(mockRedis.get.mock.calls[0][0]).toContain('ai-analysis:v1:')
  })

  /**
   * Test 2: getAIAnalysis returns null for cache miss
   */
  it('should return null when cache miss occurs', async () => {
    const content = 'const x = 1'
    mockRedis.get.mockResolvedValue(null)

    const result = await aiCache.getAIAnalysis(content)

    expect(result).toBeNull()
    expect(mockRedis.get).toHaveBeenCalled()
  })

  /**
   * Test 3: getAIAnalysis returns null for invalid JSON
   */
  it('should return null when cached data is invalid JSON', async () => {
    const content = 'const x = 1'
    mockRedis.get.mockResolvedValue('invalid json')

    const result = await aiCache.getAIAnalysis(content)

    expect(result).toBeNull()
  })

  /**
   * Test 4: setAIAnalysis stores result with TTL
   */
  it('should store AI analysis result with 24-hour TTL', async () => {
    const content = 'const x = eval(userInput)'
    const result: AIAnalysisResult = {
      findings: [
        {
          ruleId: 'eval-usage',
          severity: 'critical',
          message: 'eval() allows arbitrary code execution',
          explanation: 'This code uses eval() with user input, which allows arbitrary code execution. An attacker could execute malicious commands on your system.',
          confidence: 95,
        },
      ],
    }

    mockRedis.setex.mockResolvedValue('OK')

    await aiCache.setAIAnalysis(content, result)

    expect(mockRedis.setex).toHaveBeenCalled()
    const callArgs = mockRedis.setex.mock.calls[0]
    expect(callArgs[0]).toContain('ai-analysis:v1:')
    expect(callArgs[1]).toBe(86400) // 24 hours in seconds
    expect(callArgs[2]).toBe(JSON.stringify(result))
  })

  /**
   * Test 5: Cache key format includes SHA-256 hash
   */
  it('should use SHA-256 hash in cache key', async () => {
    const content = 'const x = 1'
    mockRedis.get.mockResolvedValue(null)

    await aiCache.getAIAnalysis(content)

    const cacheKey = mockRedis.get.mock.calls[0][0]

    // SHA-256 hash is 64 hex characters
    const hashMatch = cacheKey.match(/ai-analysis:v1:([a-f0-9]{64})/)
    expect(hashMatch).toBeTruthy()
  })

  /**
   * Test 6: Cache key format includes version
   */
  it('should include version in cache key', async () => {
    const content = 'const x = 1'
    mockRedis.get.mockResolvedValue(null)

    await aiCache.getAIAnalysis(content)

    const cacheKey = mockRedis.get.mock.calls[0][0]
    expect(cacheKey).toContain('ai-analysis:v1:')
  })

  /**
   * Test 7: Same content produces same cache key
   */
  it('should produce same cache key for identical content', async () => {
    const content = 'const x = eval(userInput)'
    mockRedis.get.mockResolvedValue(null)

    await aiCache.getAIAnalysis(content)
    await aiCache.getAIAnalysis(content)

    const key1 = mockRedis.get.mock.calls[0][0]
    const key2 = mockRedis.get.mock.calls[1][0]

    expect(key1).toBe(key2)
  })

  /**
   * Test 8: Different content produces different cache keys
   */
  it('should produce different cache keys for different content', async () => {
    const content1 = 'const x = 1'
    const content2 = 'const y = 2'
    mockRedis.get.mockResolvedValue(null)

    await aiCache.getAIAnalysis(content1)
    await aiCache.getAIAnalysis(content2)

    const key1 = mockRedis.get.mock.calls[0][0]
    const key2 = mockRedis.get.mock.calls[1][0]

    expect(key1).not.toBe(key2)
  })

  /**
   * Test 9: setAIAnalysis handles complex results
   */
  it('should store complex AI analysis results', async () => {
    const content = 'complex code'
    const result: AIAnalysisResult = {
      findings: [
        {
          ruleId: 'eval-usage',
          severity: 'critical',
          message: 'eval() allows arbitrary code execution',
          explanation: 'This code uses eval() with user input, which allows arbitrary code execution. An attacker could execute malicious commands on your system.',
          confidence: 95,
        },
        {
          ruleId: 'hardcoded-secret',
          severity: 'high',
          message: 'Hardcoded API key detected',
          explanation: 'The code contains a hardcoded API key which can be extracted by anyone with access. Use environment variables instead.',
          confidence: 88,
        },
      ],
      promptInjectionDetected: true,
      jailbreakType: 'DAN',
    }

    mockRedis.setex.mockResolvedValue('OK')

    await aiCache.setAIAnalysis(content, result)

    const stored = JSON.parse(mockRedis.setex.mock.calls[0][2])
    expect(stored.findings).toHaveLength(2)
    expect(stored.promptInjectionDetected).toBe(true)
    expect(stored.jailbreakType).toBe('DAN')
  })

  /**
   * Test 10: Cache handles empty results
   */
  it('should store and retrieve empty analysis results', async () => {
    const content = 'const x = 1'
    const emptyResult: AIAnalysisResult = {
      findings: [],
    }

    mockRedis.setex.mockResolvedValue('OK')
    mockRedis.get.mockResolvedValue(JSON.stringify(emptyResult))

    await aiCache.setAIAnalysis(content, emptyResult)
    const retrieved = await aiCache.getAIAnalysis(content)

    expect(retrieved).toEqual(emptyResult)
    expect(retrieved?.findings).toHaveLength(0)
  })
})
