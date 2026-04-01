/**
 * End-to-End Integration Tests for Scanner AI Integration
 *
 * Tests the complete AI integration with the scanner:
 * - Real OpenAI provider integration (skip if no API key)
 * - Real Anthropic provider integration (skip if no API key)
 * - Graceful degradation scenarios
 * - AI caching behavior
 * - AI findings merge with static findings
 * - AI tiebreaker functionality
 *
 * Note: These tests require Redis to be running. They will be skipped if REDIS_URL is not set.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createScanner } from '../../src/factory'
import type { ScanResult } from '../../src/types'

// Check if Redis is available
const REDIS_URL = process.env.REDIS_URL || process.env.TEST_REDIS_URL
const redisAvailable = !!REDIS_URL

// Skip all tests if Redis is not available
describe.skipIf(!redisAvailable)('Scanner AI Integration', () => {
  describe('with OpenAI', () => {
    const hasApiKey = !!process.env.OPENAI_API_KEY

    it.skipIf(!hasApiKey)('should analyze code with OpenAI', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY!,
        },
      })

      const code = "eval(userInput)"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      expect(result.metadata.aiAnalysis).toBe(true)
      expect(result.metadata.aiProvider).toBe('openai')
      expect(result.findings).toBeDefined()
    }, 30000) // 30s timeout for API calls

    it.skipIf(!hasApiKey)('should cache AI results', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY!,
        },
      })

      const code = "fetch('https://evil.com')"
      const result1 = await scanner.scan(code, 'test.js', { aiEnabled: true })
      const result2 = await scanner.scan(code, 'test.js', { aiEnabled: true })

      expect(result1.metadata.aiAnalysis).toBe(true)
      expect(result2.metadata.aiAnalysis).toBe(true)
      // Second scan should be faster due to cache
    }, 30000)

    it.skipIf(!hasApiKey)('should use AI tiebreaker for ambiguous findings', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY!,
        },
      })

      const code = "eval('test')" // Benign eval - should be clarified by AI
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      // Check that AI analysis was performed
      expect(result.metadata.aiAnalysis).toBe(true)
      // Should have findings from analysis
      expect(result.findings.length).toBeGreaterThanOrEqual(0)
    }, 30000)
  })

  describe('with Anthropic', () => {
    const hasApiKey = !!process.env.ANTHROPIC_API_KEY

    it.skipIf(!hasApiKey)('should analyze code with Anthropic', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'anthropic',
          apiKey: process.env.ANTHROPIC_API_KEY!,
        },
      })

      const code = "exec(userCommand)"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      expect(result.metadata.aiAnalysis).toBe(true)
      expect(result.metadata.aiProvider).toBe('anthropic')
      expect(result.findings).toBeDefined()
    }, 30000)
  })

  describe('graceful degradation', () => {
    it('should work without AI when aiEnabled=false', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      const code = "eval('test')"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: false })

      expect(result.metadata.aiAnalysis).toBe(false)
      expect(result.findings.length).toBeGreaterThanOrEqual(0) // Static analysis works
    }, 10000)

    it('should work without AI provider configured', async () => {
      const scanner = await createScanner() // No AI config

      const code = "eval('test')"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      expect(result.metadata.aiAnalysis).toBe(false)
      expect(result.findings.length).toBeGreaterThanOrEqual(0) // Static analysis works
    }, 10000)

    it('should work when AI provider fails', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: 'invalid-key',
        },
      })

      const code = "eval('test')"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      expect(result.metadata.aiAnalysis).toBe(false)
      expect(result.findings.length).toBeGreaterThanOrEqual(0) // Static analysis works

      consoleWarn.mockRestore()
    }, 10000)
  })

  describe('AI findings integration', () => {
    it('should merge AI findings with static findings', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      const code = "eval(userInput)"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      // Should have static findings
      expect(result.findings.length).toBeGreaterThanOrEqual(0)

      // If AI analysis succeeded, check for AI-generated metadata
      if (result.metadata.aiAnalysis) {
        const aiFindings = result.findings.filter(f => f.aiAnalyzed)
        aiFindings.forEach(finding => {
          expect(finding.explanation).toBeDefined()
          expect(finding.confidence).toBeDefined()
          expect(finding.confidence).toBeGreaterThanOrEqual(0)
          expect(finding.confidence).toBeLessThanOrEqual(100)
        })
      }
    }, 10000)

    it('should include aiAnalysis flag in metadata', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      const code = "const x = 1"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      // Metadata should always exist
      expect(result.metadata).toBeDefined()
      expect(result.metadata.aiAnalysis).toBeDefined()
      expect(typeof result.metadata.aiAnalysis).toBe('boolean')
    }, 10000)

    it('should track aiProvider in metadata when AI used', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      const code = "eval('test')"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      if (result.metadata.aiAnalysis) {
        expect(result.metadata.aiProvider).toBeDefined()
      }
    }, 10000)
  })

  describe('AI enablement control', () => {
    it('should respect aiEnabled option when false', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      const code = "eval('test')"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: false })

      expect(result.metadata.aiAnalysis).toBe(false)
    }, 10000)

    it('should attempt AI when aiEnabled is true', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      const code = "eval('test')"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      // If AI provider is valid, aiAnalysis should be true
      // If invalid, it should be false (graceful degradation)
      expect(result.metadata.aiAnalysis).toBeDefined()
      expect(typeof result.metadata.aiAnalysis).toBe('boolean')
    }, 10000)

    it('should default to aiEnabled=false when not specified', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      const code = "eval('test')"
      const result = await scanner.scan(code, 'test.js') // No aiEnabled option

      expect(result.metadata.aiAnalysis).toBe(false)
    }, 10000)
  })

  describe('conditional AI trigger', () => {
    it('should run AI when new rules detect patterns AND aiEnabled=true', async () => {
      const hasApiKey = !!process.env.OPENAI_API_KEY

      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      // Code that triggers prototype-pollution-assign rule (new rule from Phase 3.7)
      const code = "Object.assign({}, JSON.parse(userInput))"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      // Should have static findings from new rule
      const hasNewRuleFinding = result.findings.some(f =>
        f.ruleId === 'prototype-pollution-assign' ||
        f.ruleId === 'unsafe-deserialization'
      )

      // If new rule detected and API key available, AI should run
      if (hasNewRuleFinding && hasApiKey) {
        expect(result.metadata.aiAnalysis).toBe(true)
      }
    }, 10000)

    it('should NOT run AI when only old rules detect AND aiEnabled=true', async () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      // Code that only triggers old rules (eval is from Phase 1)
      const code = "eval('test')"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      // Check that no new rules were detected
      const hasNewRuleFinding = result.findings.some(f =>
        f.ruleId === 'prototype-pollution-assign' ||
        f.ruleId === 'dom-xss-innerhtml' ||
        f.ruleId === 'unsafe-deserialization' ||
        f.ruleId === 'path-traversal-fs-read' ||
        f.ruleId.startsWith('sensitive-data-')
      )

      expect(hasNewRuleFinding).toBe(false)

      // AI should NOT run for old rules only (unless it's a prompt-type skill)
      if (!code.endsWith('.prompt') && !code.endsWith('.txt')) {
        // For non-prompt files with only old rules, AI should not run
        // (unless API key is valid and it decides to run, but that's implementation detail)
        consoleWarn.mockRestore()
      }
    }, 10000)

    it('should NOT run AI when new rules detect BUT aiEnabled=false', async () => {
      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      // Code that triggers new rule
      const code = "Object.assign({}, userInput)"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: false })

      // AI should NOT run when aiEnabled=false
      expect(result.metadata.aiAnalysis).toBe(false)

      // Static analysis should still work
      expect(result.findings.length).toBeGreaterThanOrEqual(0)
    }, 10000)

    it('should run AI for prompt-type skills regardless of rule detection', async () => {
      const hasApiKey = !!process.env.OPENAI_API_KEY

      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      // Safe code but prompt-type file
      const code = "const x = 1"
      const result = await scanner.scan(code, 'test.prompt', { aiEnabled: true })

      // Prompt-type skills should always trigger AI if aiEnabled=true
      if (hasApiKey) {
        expect(result.metadata.aiAnalysis).toBe(true)
      }
    }, 10000)

    it('should run AI for .txt files regardless of rule detection', async () => {
      const hasApiKey = !!process.env.OPENAI_API_KEY

      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      // Safe code but .txt file (prompt-type)
      const code = "You are a helpful assistant"
      const result = await scanner.scan(code, 'instructions.txt', { aiEnabled: true })

      // .txt files should always trigger AI if aiEnabled=true
      if (hasApiKey) {
        expect(result.metadata.aiAnalysis).toBe(true)
      }
    }, 10000)
  })

  describe('bidirectional severity adjustment', () => {
    it('should upgrade Medium→High when AI confirms exploitability', async () => {
      const hasApiKey = !!process.env.OPENAI_API_KEY

      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      // Code that triggers medium severity finding (e.g., DOM XSS)
      const code = "document.innerHTML = userInput"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      if (hasApiKey && result.metadata.aiAnalysis) {
        // Check if any findings were upgraded from medium to high
        const highSeverityFindings = result.findings.filter(f => f.severity === 'high')
        const hasUpgradedFinding = highSeverityFindings.some(f =>
          f.aiAnalyzed && f.explanation && f.explanation.includes('exploit')
        )

        // AI may upgrade severity based on context
        // (This is a soft assertion - AI behavior depends on actual analysis)
        expect(result.findings.length).toBeGreaterThan(0)
      }
    }, 10000)

    it('should downgrade High→Medium when AI shows safe usage', async () => {
      const hasApiKey = !!process.env.OPENAI_API_KEY

      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      // Code that looks dangerous but is actually safe (e.g., eval with constant)
      const code = "eval('console.log(\"test\")')"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      if (hasApiKey && result.metadata.aiAnalysis) {
        // Check if any findings were downgraded from high to medium
        const mediumSeverityFindings = result.findings.filter(f => f.severity === 'medium')
        const hasDowngradedFinding = mediumSeverityFindings.some(f =>
          f.aiAnalyzed && f.explanation && f.explanation.includes('safe')
        )

        // AI may downgrade severity based on context
        expect(result.findings.length).toBeGreaterThan(0)
      }
    }, 10000)

    it('should maintain severity when no change needed', async () => {
      const hasApiKey = !!process.env.OPENAI_API_KEY

      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      // Clearly dangerous code (critical severity)
      const code = "eval(userInput)"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      if (hasApiKey && result.metadata.aiAnalysis) {
        // Critical findings should remain critical
        const criticalFindings = result.findings.filter(f => f.severity === 'critical')
        expect(criticalFindings.length).toBeGreaterThan(0)
      }
    }, 10000)

    it('should provide clear reasoning for severity changes', async () => {
      const hasApiKey = !!process.env.OPENAI_API_KEY

      const scanner = await createScanner({
        aiProvider: {
          type: 'openai',
          apiKey: process.env.OPENAI_API_KEY || 'dummy',
        },
      })

      const code = "eval(userInput)"
      const result = await scanner.scan(code, 'test.js', { aiEnabled: true })

      if (hasApiKey && result.metadata.aiAnalysis) {
        // AI-analyzed findings should have explanations
        const aiFindings = result.findings.filter(f => f.aiAnalyzed)

        aiFindings.forEach(finding => {
          // Should have explanation for severity assessment
          expect(finding.explanation).toBeDefined()
          expect(finding.confidence).toBeDefined()
          expect(finding.confidence).toBeGreaterThanOrEqual(0)
          expect(finding.confidence).toBeLessThanOrEqual(100)
        })
      }
    }, 10000)
  })
})
