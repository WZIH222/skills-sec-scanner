/**
 * AI Engine Public API
 *
 * Exports all AI engine components for use in the scanner.
 * Follows Phase 1's index.ts pattern for clean public API.
 */

// Core types
export type { IAIProvider, AIAnalysisResult, AIProviderConfig, AIProviderType } from './types'
export { AIAnalysisResultSchema } from './types'

// AI Engine interface (for Scanner dependency injection)
export interface IAIEngine {
  analyzeCode(params: {
    code: string
    filename?: string
    findings: import('../types').Finding[]
  }): Promise<import('./types').AIAnalysisResult | null>

  detectPromptInjection(prompt: string): Promise<{
    detected: boolean
    jailbreakType?: string
    confidence: number
  }>

  isAvailable(): Promise<boolean>

  tiebreaker(findings: import('../types').Finding[], code: string): Promise<import('../types').Finding[]>
}

// Engine implementation
export { AIEngine, type AIEngineConfig } from './ai-engine'

// Providers
export { OpenAIProvider } from './providers/openai-provider'
export { AnthropicProvider } from './providers/anthropic-provider'
export { CustomProvider } from './providers/custom-provider'

// Cache
export { AICacheService } from './cache/ai-cache-service'

// Detectors
export { PromptInjectionDetector, type JailbreakPattern } from './detectors/prompt-injection-detector'

// Prompts
export { buildAnalysisPrompt } from './prompts/analysis-prompt'
export { buildRuleGenerationPrompt } from './prompts/rule-generation-prompt'

// Factory helper
export { createAIEngine } from './factory'
