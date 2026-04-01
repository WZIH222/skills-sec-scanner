/**
 * AI Engine Orchestrator
 *
 * Main AI analysis engine with circuit breaker pattern, cache-first workflow,
 * and tiebreaker logic for ambiguous findings.
 *
 * Features:
 * - Circuit breaker: Opens after 5 failures, recovers after 60 seconds
 * - Cache-first: Checks cache BEFORE calling provider (KEY LINK)
 * - Graceful degradation: Returns null on failures, never blocks scans
 * - Tiebreaker: Uses AI to resolve ambiguous static analysis findings
 */

import type { IAIProvider, AIAnalysisResult } from './types'
import type { Finding } from '../types'
import { AICacheService } from './cache/ai-cache-service'

export interface AIEngineConfig {
  timeout?: number // Default 30000ms
  retryAttempts?: number // Default 0 per CONTEXT.md
  circuitBreakerThreshold?: number // Default 5 failures
  circuitBreakerRecoveryTimeout?: number // Default 60000ms (1 minute)
}

type CircuitState = 'closed' | 'open' | 'half-open'

export class AIEngine {
  private circuitState: CircuitState = 'closed'
  private failureCount = 0
  private lastFailureTime = 0
  private readonly FAILURE_THRESHOLD: number
  private readonly RECOVERY_TIMEOUT: number

  constructor(
    private provider: IAIProvider,
    private aiCache: AICacheService,
    config: AIEngineConfig = {}
  ) {
    this.FAILURE_THRESHOLD = config.circuitBreakerThreshold || 5
    this.RECOVERY_TIMEOUT = config.circuitBreakerRecoveryTimeout || 60000
  }

  /**
   * Analyze code with AI, using cache and circuit breaker
   * @param params - Code and existing findings to analyze
   * @returns AI analysis result or null (graceful degradation)
   */
  async analyzeCode(params: {
    code: string
    filename?: string
    findings: Finding[]
  }): Promise<AIAnalysisResult | null> {
    // Check circuit breaker
    if (this.circuitState === 'open') {
      if (Date.now() - this.lastFailureTime > this.RECOVERY_TIMEOUT) {
        this.circuitState = 'half-open'
        console.info('AI circuit breaker entering half-open state')
      } else {
        console.warn('AI circuit breaker open, using static-only')
        return null
      }
    }

    try {
      // KEY LINK: Check cache FIRST before calling provider
      const cached = await this.aiCache.getAIAnalysis(params.code)
      if (cached) {
        console.debug('AI analysis cache hit')
        return cached
      }

      // Call provider (only if cache miss)
      const result = await this.provider.analyzeCode(params)

      if (!result) {
        this.recordFailure()
        return null
      }

      // Store in cache after successful analysis
      await this.aiCache.setAIAnalysis(params.code, result)

      // Reset circuit breaker on success
      this.resetCircuitBreaker()

      return result
    } catch (error) {
      this.recordFailure()
      console.warn('AI analysis failed, falling back to static-only:', error)
      return null
    }
  }

  /**
   * Detect prompt injection using AI semantic analysis
   * @param prompt - Prompt content to analyze
   * @returns Detection result with confidence
   */
  async detectPromptInjection(prompt: string): Promise<{
    detected: boolean
    jailbreakType?: string
    confidence: number
  }> {
    try {
      return await this.provider.detectPromptInjection(prompt)
    } catch (error) {
      console.warn('AI prompt injection detection failed:', error)
      return { detected: false, confidence: 0 }
    }
  }

  /**
   * Check if AI provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      return await this.provider.isAvailable()
    } catch {
      return false
    }
  }

  /**
   * Act as tiebreaker for ambiguous findings
   * Use AI to resolve low-confidence static analysis results
   * @param findings - Ambiguous findings from static analysis
   * @param code - Original code for context
   * @returns AI-validated findings with updated confidence
   */
  async tiebreaker(findings: Finding[], code: string): Promise<Finding[]> {
    // Filter for ambiguous findings (could add confidence threshold later)
    const ambiguous = findings.filter(f => f.severity === 'medium' || f.severity === 'low')

    if (ambiguous.length === 0) {
      return findings
    }

    try {
      const result = await this.analyzeCode({ code, findings: ambiguous })

      if (!result) {
        return findings // AI unavailable, return original findings
      }

      // Merge AI analysis into original findings
      return findings.map(finding => {
        const aiFinding = result.findings.find(ai => ai.ruleId === finding.ruleId)
        if (aiFinding) {
          return {
            ...finding,
            explanation: aiFinding.explanation,
            confidence: aiFinding.confidence,
          }
        }
        return finding
      })
    } catch (error) {
      console.warn('AI tiebreaker failed, using original findings:', error)
      return findings
    }
  }

  private recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.FAILURE_THRESHOLD) {
      this.circuitState = 'open'
      console.error(`AI circuit breaker opened after ${this.failureCount} failures`)
    }
  }

  private resetCircuitBreaker(): void {
    this.failureCount = 0
    this.circuitState = 'closed'
  }

  /**
   * Get current circuit breaker state (for monitoring)
   */
  getCircuitState(): { state: CircuitState; failureCount: number } {
    return {
      state: this.circuitState,
      failureCount: this.failureCount
    }
  }
}
