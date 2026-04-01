/**
 * Tests for AI engine types and interfaces
 */

import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import {
  IAIProvider,
  AIAnalysisResultSchema,
  AIAnalysisResult,
  AIProviderType,
  AIProviderConfig,
} from '../../../src/ai-engine/types'

describe('AI Engine Types', () => {
  describe('AIProviderType', () => {
    it('should accept valid provider types', () => {
      const validTypes: AIProviderType[] = ['openai', 'anthropic', 'custom']

      validTypes.forEach((type) => {
        expect(type).toMatch(/^(openai|anthropic|custom)$/)
      })
    })
  })

  describe('AIProviderConfig', () => {
    it('should accept valid config with all fields', () => {
      const config: AIProviderConfig = {
        type: 'openai',
        apiKey: 'sk-test-key',
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        timeout: 30000,
        maxRetries: 2,
      }

      expect(config.type).toBe('openai')
      expect(config.apiKey).toBe('sk-test-key')
      expect(config.timeout).toBe(30000)
      expect(config.maxRetries).toBe(2)
    })

    it('should accept minimal config with only type', () => {
      const config: AIProviderConfig = {
        type: 'anthropic',
      }

      expect(config.type).toBe('anthropic')
      expect(config.apiKey).toBeUndefined()
      expect(config.timeout).toBeUndefined()
    })
  })

  describe('AIAnalysisResultSchema', () => {
    it('should validate valid AI analysis result', () => {
      const validResult = {
        findings: [
          {
            ruleId: 'AI-001',
            severity: 'high' as const,
            message: 'Potential security threat detected',
            explanation: 'This code contains a pattern that may allow unauthorized access. An attacker could exploit this to bypass security controls. This requires immediate attention.',
            confidence: 85,
          },
        ],
        promptInjectionDetected: false,
      }

      const result = AIAnalysisResultSchema.parse(validResult)

      expect(result.findings).toHaveLength(1)
      expect(result.findings[0].ruleId).toBe('AI-001')
      expect(result.findings[0].confidence).toBe(85)
      expect(result.promptInjectionDetected).toBe(false)
    })

    it('should validate result with prompt injection detected', () => {
      const resultWithInjection = {
        findings: [],
        promptInjectionDetected: true,
        jailbreakType: 'DAN' as const,
      }

      const result = AIAnalysisResultSchema.parse(resultWithInjection)

      expect(result.promptInjectionDetected).toBe(true)
      expect(result.jailbreakType).toBe('DAN')
    })

    it('should reject result with explanation shorter than 50 characters', () => {
      const invalidResult = {
        findings: [
          {
            ruleId: 'AI-001',
            severity: 'high' as const,
            message: 'Threat detected',
            explanation: 'Too short', // Less than 50 chars
            confidence: 85,
          },
        ],
      }

      expect(() => AIAnalysisResultSchema.parse(invalidResult)).toThrow(z.ZodError)
    })

    it('should reject result with explanation longer than 500 characters', () => {
      const longExplanation = 'A'.repeat(501)
      const invalidResult = {
        findings: [
          {
            ruleId: 'AI-001',
            severity: 'high' as const,
            message: 'Threat detected',
            explanation: longExplanation,
            confidence: 85,
          },
        ],
      }

      expect(() => AIAnalysisResultSchema.parse(invalidResult)).toThrow(z.ZodError)
    })

    it('should reject result with confidence outside 0-100 range', () => {
      const invalidResult = {
        findings: [
          {
            ruleId: 'AI-001',
            severity: 'high' as const,
            message: 'Threat detected',
            explanation: 'This is a valid explanation that meets the minimum length requirement for testing purposes.',
            confidence: 150, // Invalid: > 100
          },
        ],
      }

      expect(() => AIAnalysisResultSchema.parse(invalidResult)).toThrow(z.ZodError)
    })

    it('should reject result with invalid jailbreak type', () => {
      const invalidResult = {
        findings: [],
        promptInjectionDetected: true,
        jailbreakType: 'invalid-type' as const,
      }

      expect(() => AIAnalysisResultSchema.parse(invalidResult)).toThrow(z.ZodError)
    })

    it('should accept all valid jailbreak types', () => {
      const jailbreakTypes = ['DAN', 'role-reversal', 'ignore-instructions', 'system-prompt', 'none'] as const

      jailbreakTypes.forEach((jailbreakType) => {
        const result = {
          findings: [],
          promptInjectionDetected: true,
          jailbreakType,
        }

        const parsed = AIAnalysisResultSchema.parse(result)
        expect(parsed.jailbreakType).toBe(jailbreakType)
      })
    })

    it('should accept all severity levels', () => {
      const severities: ['critical', 'high', 'medium', 'low', 'info'] = ['critical', 'high', 'medium', 'low', 'info']

      severities.forEach((severity) => {
        const result = {
          findings: [
            {
              ruleId: 'AI-001',
              severity,
              message: 'Threat detected',
              explanation: 'This is a valid explanation that meets the minimum length requirement for testing purposes.',
              confidence: 75,
            },
          ],
        }

        const parsed = AIAnalysisResultSchema.parse(result)
        expect(parsed.findings[0].severity).toBe(severity)
      })
    })
  })

  describe('IAIProvider interface', () => {
    it('should define required methods', () => {
      // This test verifies the interface structure at compile time
      // We create a mock implementation to verify the interface contract

      class MockProvider implements IAIProvider {
        async analyzeCode(_params: {
          code: string
          filename?: string
          findings: unknown[]
        }): Promise<AIAnalysisResult | null> {
          return {
            findings: [],
            promptInjectionDetected: false,
          }
        }

        async detectPromptInjection(_prompt: string): Promise<{
          detected: boolean
          jailbreakType?: string
          confidence: number
        }> {
          return {
            detected: false,
            confidence: 0,
          }
        }

        async isAvailable(): Promise<boolean> {
          return true
        }
      }

      const provider: IAIProvider = new MockProvider()

      expect(typeof provider.analyzeCode).toBe('function')
      expect(typeof provider.detectPromptInjection).toBe('function')
      expect(typeof provider.isAvailable).toBe('function')
    })
  })
})
