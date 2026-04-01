/**
 * Unit Tests for AI Engine Factory
 *
 * Tests the factory function for creating AI engine instances:
 * - Provider selection based on type
 * - Error handling for invalid configs
 * - Cache service integration
 * - Null return on failure
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAIEngine } from '../../../src/ai-engine/factory'
import { CacheService } from '../../../src/storage'
import { RedisService } from '../../../src/storage/cache/client'

describe('AI Engine Factory', () => {
  let cacheService: CacheService

  beforeEach(() => {
    // Create Redis service singleton
    const redis = RedisService.getInstance()
    cacheService = new CacheService(redis)
  })

  describe('createAIEngine', () => {
    it('should create AI engine with OpenAI provider', () => {
      const aiEngine = createAIEngine(
        {
          provider: {
            type: 'openai',
            apiKey: 'sk-test-key',
          },
        },
        cacheService
      )

      expect(aiEngine).toBeDefined()
      expect(aiEngine).not.toBeNull()
    })

    it('should create AI engine with Anthropic provider', () => {
      const aiEngine = createAIEngine(
        {
          provider: {
            type: 'anthropic',
            apiKey: 'sk-ant-test-key',
          },
        },
        cacheService
      )

      expect(aiEngine).toBeDefined()
      expect(aiEngine).not.toBeNull()
    })

    it('should create AI engine with custom provider', () => {
      const aiEngine = createAIEngine(
        {
          provider: {
            type: 'custom',
            baseURL: 'http://localhost:11434/v1',
            apiKey: 'dummy-key',
          },
        },
        cacheService
      )

      expect(aiEngine).toBeDefined()
      expect(aiEngine).not.toBeNull()
    })

    it('should return null for OpenAI without API key', () => {
      const aiEngine = createAIEngine(
        {
          provider: {
            type: 'openai',
          },
        },
        cacheService
      )

      expect(aiEngine).toBeNull()
    })

    it('should return null for Anthropic without API key', () => {
      const aiEngine = createAIEngine(
        {
          provider: {
            type: 'anthropic',
          },
        },
        cacheService
      )

      expect(aiEngine).toBeNull()
    })

    it('should return null for unknown provider type', () => {
      const aiEngine = createAIEngine(
        {
          provider: {
            type: 'unknown' as any,
            apiKey: 'test-key',
          },
        },
        cacheService
      )

      expect(aiEngine).toBeNull()
    })

    it('should pass engine config to AI engine', () => {
      const aiEngine = createAIEngine(
        {
          provider: {
            type: 'openai',
            apiKey: 'sk-test-key',
          },
          engine: {
            timeout: 60000,
            circuitBreakerThreshold: 10,
          },
        },
        cacheService
      )

      expect(aiEngine).toBeDefined()
      expect(aiEngine).not.toBeNull()
    })

    it('should handle provider instantiation errors gracefully', () => {
      // Mock a scenario where provider creation might fail
      const aiEngine = createAIEngine(
        {
          provider: {
            type: 'custom',
            baseURL: undefined, // Invalid config
          },
        },
        cacheService
      )

      // Should return null instead of throwing
      expect(aiEngine).toBeNull()
    })

    it('should integrate with cache service', () => {
      const aiEngine = createAIEngine(
        {
          provider: {
            type: 'openai',
            apiKey: 'sk-test-key',
          },
        },
        cacheService
      )

      expect(aiEngine).toBeDefined()
      // The AI engine should have access to cache through the wrapped cache service
      expect(typeof aiEngine?.isAvailable).toBe('function')
    })

    it('should support custom model configuration', () => {
      const aiEngine = createAIEngine(
        {
          provider: {
            type: 'openai',
            apiKey: 'sk-test-key',
            model: 'gpt-4-turbo',
          },
        },
        cacheService
      )

      expect(aiEngine).toBeDefined()
      expect(aiEngine).not.toBeNull()
    })

    it('should support custom timeout configuration', () => {
      const aiEngine = createAIEngine(
        {
          provider: {
            type: 'openai',
            apiKey: 'sk-test-key',
            timeout: 45000,
          },
        },
        cacheService
      )

      expect(aiEngine).toBeDefined()
      expect(aiEngine).not.toBeNull()
    })

    it('should support max retries configuration', () => {
      const aiEngine = createAIEngine(
        {
          provider: {
            type: 'anthropic',
            apiKey: 'sk-ant-test-key',
            maxRetries: 2,
          },
        },
        cacheService
      )

      expect(aiEngine).toBeDefined()
      expect(aiEngine).not.toBeNull()
    })
  })

  describe('factory error handling', () => {
    it('should not throw on invalid provider type', () => {
      expect(() => {
        createAIEngine(
          {
            provider: {
              type: 'invalid' as any,
              apiKey: 'test',
            },
          },
          cacheService
        )
      }).not.toThrow()
    })

    it('should not throw on missing API key for OpenAI', () => {
      expect(() => {
        createAIEngine(
          {
            provider: {
              type: 'openai',
            },
          },
          cacheService
        )
      }).not.toThrow()
    })

    it('should not throw on missing API key for Anthropic', () => {
      expect(() => {
        createAIEngine(
          {
            provider: {
              type: 'anthropic',
            },
          },
          cacheService
        )
      }).not.toThrow()
    })
  })
})
