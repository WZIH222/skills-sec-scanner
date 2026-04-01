/**
 * Unit Tests for Scanner Factory with AI Integration
 *
 * Tests the factory functions for creating Scanner instances:
 * - createScanner() with AI configuration
 * - createScannerWithDeps() with AI overrides
 * - Backward compatibility (works without AI config)
 * - AI provider initialization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createScanner, createScannerWithDeps, ScannerOptions } from '../../src/factory'
import { Scanner, ScannerDeps } from '../../src/scanner'
import type { IAIEngine } from '../../src/ai-engine'
import type { AICacheService } from '../../src/ai-engine'

describe('Scanner Factory with AI Integration', () => {
  describe('createScanner()', () => {
    it('should create scanner without AI configuration', async () => {
      const scanner = await createScanner()

      expect(scanner).toBeInstanceOf(Scanner)
    })

    it('should create scanner with OpenAI provider', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: 'sk-test-key',
        },
      })

      expect(scanner).toBeInstanceOf(Scanner)
    })

    it('should create scanner with Anthropic provider', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'anthropic',
          apiKey: 'sk-ant-test-key',
        },
      })

      expect(scanner).toBeInstanceOf(Scanner)
    })

    it('should create scanner with custom provider', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'custom',
          baseURL: 'http://localhost:11434/v1',
          apiKey: 'dummy-key',
        },
      })

      expect(scanner).toBeInstanceOf(Scanner)
    })

    it('should handle missing API key gracefully', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
        },
      })

      expect(scanner).toBeInstanceOf(Scanner)
      expect(consoleWarn).toHaveBeenCalledWith('OpenAI provider requires API key, AI disabled')

      consoleWarn.mockRestore()
    })

    it('should maintain backward compatibility without AI options', async () => {
      const options: ScannerOptions = {
        ruleConfig: {
          disabledRules: ['test-rule'],
        },
      }

      const scanner = await createScanner(options)

      expect(scanner).toBeInstanceOf(Scanner)
    })
  })

  describe('createScannerWithDeps()', () => {
    it('should create scanner with custom dependencies', async () => {
      const mockCache = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        invalidate: vi.fn().mockResolvedValue(undefined),
      } as any

      const mockRepository = {
        create: vi.fn().mockResolvedValue(undefined),
        findByFileId: vi.fn().mockResolvedValue(null),
        findByContentHash: vi.fn().mockResolvedValue(null),
        deleteOldScans: vi.fn().mockResolvedValue(0),
      } as any

      const scanner = await createScannerWithDeps({
        cache: mockCache,
        repository: mockRepository,
      })

      expect(scanner).toBeInstanceOf(Scanner)
    })

    it('should allow overriding AI engine', async () => {
      const mockAIEngine = {
        analyzeCode: vi.fn().mockResolvedValue(null),
        detectPromptInjection: vi.fn().mockResolvedValue({ detected: false, confidence: 0 }),
        isAvailable: vi.fn().mockResolvedValue(true),
        tiebreaker: vi.fn().mockResolvedValue([]),
      } as any

      const scanner = await createScannerWithDeps({
        aiEngine: mockAIEngine,
      })

      expect(scanner).toBeInstanceOf(Scanner)
    })

    it('should allow overriding AI cache', async () => {
      const mockAICache = {
        getAIAnalysis: vi.fn().mockResolvedValue(null),
        setAIAnalysis: vi.fn().mockResolvedValue(undefined),
      } as any

      const scanner = await createScannerWithDeps({
        aiCache: mockAICache,
      })

      expect(scanner).toBeInstanceOf(Scanner)
    })

    it('should merge custom deps with AI configuration', async () => {
      const mockCache = {
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue(undefined),
        invalidate: vi.fn().mockResolvedValue(undefined),
      } as any

      const scanner = await createScannerWithDeps(
        {
          cache: mockCache,
        },
        {
          aiProvider: {
            type: 'openai',
            apiKey: 'sk-test-key',
          },
        }
      )

      expect(scanner).toBeInstanceOf(Scanner)
    })

    it('should work with both custom deps and AI provider', async () => {
      const mockAIEngine = {
        analyzeCode: vi.fn().mockResolvedValue(null),
        detectPromptInjection: vi.fn().mockResolvedValue({ detected: false, confidence: 0 }),
        isAvailable: vi.fn().mockResolvedValue(true),
        tiebreaker: vi.fn().mockResolvedValue([]),
      } as any

      const scanner = await createScannerWithDeps(
        {
          aiEngine: mockAIEngine,
        },
        {
          aiProvider: {
            type: 'anthropic',
            apiKey: 'sk-ant-test-key',
          },
        }
      )

      expect(scanner).toBeInstanceOf(Scanner)
      // Custom AI engine should override the one from aiProvider config
    })
  })

  describe('backward compatibility', () => {
    it('should work without any options', async () => {
      const scanner = await createScanner()

      expect(scanner).toBeInstanceOf(Scanner)
    })

    it('should work with only ruleConfig', async () => {
      const scanner = await createScanner({
        ruleConfig: {
          disabledRules: ['rule1', 'rule2'],
          severityOverrides: {
            rule1: 'critical',
          },
        },
      })

      expect(scanner).toBeInstanceOf(Scanner)
    })

    it('should work with only redisUrl', async () => {
      const scanner = await createScanner({
        redisUrl: 'redis://localhost:6379',
      })

      expect(scanner).toBeInstanceOf(Scanner)
    })

    it('should work with only databaseUrl', async () => {
      const scanner = await createScanner({
        databaseUrl: 'postgresql://localhost:5432/test',
      })

      expect(scanner).toBeInstanceOf(Scanner)
    })
  })
})
