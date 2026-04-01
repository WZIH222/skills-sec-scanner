/**
 * Skills Security Scanner - Core scanning engine
 *
 * Exports all public types and utilities for the scanner package
 */

// Types
export * from './types'

// Scanner
export { Scanner, ScannerDeps } from './scanner'
export { createScanner, createScannerWithDeps, type ScannerOptions } from './factory'

// Queue
export * from './queue'

// Storage
export * from './storage'

// Analyzers
export * from './analyzer'

// Parser
export * from './parser'

// Rules
export * from './rules'

// NEW: AI Engine exports
export {
  AIEngine,
  type IAIEngine,
  type AIEngineConfig,
  OpenAIProvider,
  AnthropicProvider,
  CustomProvider,
  AICacheService,
  PromptInjectionDetector,
  buildAnalysisPrompt,
  buildRuleGenerationPrompt,
  createAIEngine,
} from './ai-engine'

export type {
  IAIProvider,
  AIAnalysisResult,
  AIProviderConfig,
  AIProviderType,
  JailbreakPattern,
} from './ai-engine'

// NEW: Policy exports
export {
  PolicyEnforcer,
  PolicyMode,
} from './policy'

export type {
  PolicyResult,
  BlockDecision,
  PolicyResolution,
} from './policy'

// NEW: Folder worker exports
export {
  FolderWorkerService,
  processFolderFile,
} from './workers/folder-worker'
