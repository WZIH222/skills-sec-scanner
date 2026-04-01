/**
 * AI Engine Types
 *
 * Defines the core types and interfaces for AI-powered security analysis.
 * Includes provider interface, analysis result schema, and configuration types.
 */

import { z } from 'zod'
import type { Finding } from '../types'

/**
 * Supported AI provider types
 */
export type AIProviderType = 'openai' | 'anthropic' | 'custom' | 'test'

/**
 * Configuration for AI provider
 */
export interface AIProviderConfig {
  type: AIProviderType
  apiKey?: string
  baseURL?: string // For custom provider
  model?: string // Override default model
  timeout?: number // Default 30000ms
  maxRetries?: number // Default 0 per CONTEXT.md
}

/**
 * Jailbreak types for prompt injection detection
 */
export type JailbreakType = 'DAN' | 'role-reversal' | 'ignore-instructions' | 'system-prompt' | 'none'

/**
 * Individual AI-generated finding with enhanced metadata
 */
export interface AIFinding {
  ruleId: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  message: string
  explanation: string // 3-5 sentences, min 50, max 500 chars
  confidence: number // 0-100
}

/**
 * AI Analysis Result schema with Zod validation
 *
 * Validates the structure of AI-generated analysis results.
 * Ensures explanations meet length requirements and confidence is in valid range.
 */
export const AIAnalysisResultSchema = z.object({
  findings: z.array(
    z.object({
      ruleId: z.string(),
      severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
      message: z.string(),
      explanation: z.string().min(20).max(500),
      confidence: z.number().min(0).max(100),
    })
  ),
  promptInjectionDetected: z.boolean().optional(),
  jailbreakType: z.enum(['DAN', 'role-reversal', 'ignore-instructions', 'system-prompt', 'none']).optional(),
})

/**
 * Inferred type from AIAnalysisResultSchema
 */
export type AIAnalysisResult = z.infer<typeof AIAnalysisResultSchema>

/**
 * AI Provider Interface
 *
 * Defines the common contract for all AI provider implementations.
 * Each provider (OpenAI, Anthropic, custom) must implement these methods.
 */
export interface IAIProvider {
  /**
   * Analyze code for security threats using AI
   *
   * @param params - Code analysis parameters
   * @param params.code - Source code to analyze
   * @param params.filename - Optional filename for context
   * @param params.findings - Existing static analysis findings to enhance
   * @returns AI analysis result or null if analysis fails
   */
  analyzeCode(params: {
    code: string
    filename?: string
    findings: Finding[]
  }): Promise<AIAnalysisResult | null>

  /**
   * Detect prompt injection or jailbreak attempts
   *
   * @param prompt - Prompt text to analyze
   * @returns Detection result with jailbreak type and confidence
   */
  detectPromptInjection(prompt: string): Promise<{
    detected: boolean
    jailbreakType?: string
    confidence: number
  }>

  /**
   * Check if AI provider is available
   *
   * @returns true if provider is ready to analyze code
   */
  isAvailable(): Promise<boolean>
}
