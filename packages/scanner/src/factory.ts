/**
 * Scanner Factory
 *
 * Factory function for creating Scanner instances with all dependencies resolved.
 * Provides explicit dependency injection for testability.
 *
 * Usage:
 *   const scanner = await createScanner()
 *   const result = await scanner.scan(code, filename)
 *
 * For testing with mocks:
 *   const scanner = await createScannerWithDeps({ cache: mockCache })
 */

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { RedisService } from './storage/cache/client'
import { PrismaService } from './storage/database/client'
import { CacheService } from './storage/cache/cache-service'
import { ScanRepository } from './storage/database/scan-repository'
import { TypeScriptParser, JSONParser, createParser, type IParser } from './parser'
import { RuleLoader } from './rules'
import { PatternMatcher } from './analyzer'
import { TaintTracker } from './analyzer'
import { RiskScorer } from './analyzer'
import { Scanner, ScannerDeps } from './scanner'
import type { AIProviderConfig } from './ai-engine'
import { FalsePositiveFilter } from './storage'
import { PolicyEnforcer } from './policy'

/**
 * Scanner factory options
 */
export interface ScannerOptions {
  redisUrl?: string
  databaseUrl?: string
  ruleConfig?: {
    disabledRules?: string[]
    severityOverrides?: Record<string, any>
  }
  // NEW: AI provider configuration
  aiProvider?: AIProviderConfig
  // Skip AI engine creation even if aiProvider is configured (for memory efficiency in batch scans)
  skipAI?: boolean
  // Filename for parser selection (used to select appropriate parser based on file type)
  filename?: string
}

// Module-level caches to avoid recreating heavy objects
// These are shared across ALL scanner instances
let cachedRules: any[] | undefined
let cachedRuleDir: string | undefined
let cachedRuleLoader: RuleLoader | undefined
let cachedPatternMatcher: PatternMatcher | undefined
let cachedTaintTracker: TaintTracker | undefined
let cachedScorer: RiskScorer | undefined
let cachedCacheService: CacheService | undefined
let cachedScanRepository: ScanRepository | undefined
let cachedFalsePositiveFilter: import('./storage').FalsePositiveFilter | undefined
let cachedPolicyEnforcer: import('./policy').PolicyEnforcer | undefined

// Module-level seeder flag to ensure RuleSeeder runs only once
let seederInvoked = false

/**
 * Create a Scanner instance with all dependencies resolved
 *
 * @param options - Optional configuration
 * @returns Configured Scanner instance
 */
export async function createScanner(options?: ScannerOptions): Promise<Scanner> {
  // Step 1: Create infrastructure services (use singletons)
  const redis = RedisService.getInstance()
  const prisma = PrismaService.getInstance()

  // Seed built-in rules from JSON to database on first startup
  if (!seederInvoked) {
    try {
      const seeder = await import('./rules/seeder')
      await seeder.RuleSeeder.seed(prisma.client)
      seederInvoked = true
    } catch (err) {
      console.warn('[Factory] RuleSeeder failed to run:', err)
    }
  }

  // Step 2: Create storage layer (with caching to avoid recreating)
  if (!cachedCacheService) {
    cachedCacheService = new CacheService(redis)
  }
  if (!cachedScanRepository) {
    cachedScanRepository = new ScanRepository(prisma)
  }
  const cache = cachedCacheService
  const repository = cachedScanRepository

  // Step 3: Create parser (select based on filename or default to TypeScript)
  const parser: IParser = options?.filename
    ? createParser(options.filename) || new TypeScriptParser()
    : new TypeScriptParser()

  // Step 4: Load rules (with module-level caching to avoid repeated disk reads)
  // Only reload if ruleConfig changes (different disabled/override rules)
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const ruleDir = join(__dirname, 'rules')

  if (!cachedRules || cachedRuleDir !== ruleDir || cachedRuleLoader === null) {
    const ruleLoader = new RuleLoader(options?.ruleConfig)
    try {
      cachedRules = await ruleLoader.loadRules(ruleDir)
      cachedRuleDir = ruleDir
      cachedRuleLoader = ruleLoader
      console.log(`[Factory] Cached ${cachedRules.length} security rules from ${ruleDir}`)
    } catch (error) {
      console.warn('Rules directory not found, continuing with empty rules')
      cachedRules = []
    }
  }

  // Reuse cached analyzers - these are stateless and safe to share
  if (!cachedPatternMatcher) {
    cachedPatternMatcher = new PatternMatcher(cachedRules || [])
  }
  if (!cachedTaintTracker) {
    cachedTaintTracker = new TaintTracker()
  }
  if (!cachedScorer) {
    cachedScorer = new RiskScorer()
  }

  // Update pattern matcher with current rules if different config
  if (options?.ruleConfig && cachedRules) {
    // If config changed, we might need to reload - for now just use cached
  }

  // Step 6: Create AI engine if configured AND not skipped
  let aiEngine: import('./ai-engine').IAIEngine | undefined
  let aiCache: import('./ai-engine').AICacheService | undefined

  if (options?.aiProvider && !options?.skipAI) {
    const { createAIEngine } = await import('./ai-engine')
    const { AICacheService } = await import('./ai-engine')
    console.info(`[Factory] Creating AI engine with provider: ${JSON.stringify({ type: options.aiProvider.type, hasApiKey: !!options.aiProvider.apiKey, baseURL: options.aiProvider.baseURL, model: options.aiProvider.model })}`)
    aiEngine = createAIEngine(
      { provider: options.aiProvider },
      redis  // Pass RedisService directly for AI caching
    ) || undefined

    if (aiEngine) {
      aiCache = new AICacheService(redis)
      console.info(`AI engine initialized with provider: ${options.aiProvider.type}`)
    } else {
      console.warn('[Factory] createAIEngine returned null - AI will be disabled')
    }
  } else {
    console.info('[Factory] Skipping AI engine creation:', { hasAiProvider: !!options?.aiProvider, skipAI: options?.skipAI })
  }

  // Step 6.5: Create FalsePositiveFilter if database is available (cached)
  let falsePositiveFilter: FalsePositiveFilter | undefined

  if (options?.databaseUrl && !cachedFalsePositiveFilter) {
    cachedFalsePositiveFilter = new FalsePositiveFilter(prisma.client)
    console.info('FalsePositiveFilter initialized (cached)')
  }
  falsePositiveFilter = cachedFalsePositiveFilter

  // Step 6.6: Create PolicyEnforcer if database is available (cached)
  let policyEnforcer: PolicyEnforcer | undefined

  if (options?.databaseUrl && !cachedPolicyEnforcer) {
    const aiAvailable = !!aiEngine // Policy needs to know AI availability
    cachedPolicyEnforcer = new PolicyEnforcer(aiAvailable)
    console.info('PolicyEnforcer initialized (cached)')
  }
  policyEnforcer = cachedPolicyEnforcer

  // Step 7: Inject all into Scanner
  // Use cached stateless analyzers (patternMatcher, taintTracker, scorer)
  // Create new parser per scanner since each file needs its own parser instance
  const deps: ScannerDeps = {
    parser,
    ruleLoader: cachedRuleLoader || new RuleLoader(),
    patternMatcher: cachedPatternMatcher!,
    taintTracker: cachedTaintTracker!,
    scorer: cachedScorer!,
    cache,
    repository,
    aiEngine, // NEW: Optional AI dependency
    aiCache,  // NEW: Optional AI cache
    falsePositiveFilter, // NEW: Inject filter
    policyEnforcer, // NEW: Inject policy enforcer
  }

  return new Scanner(deps)
}

/**
 * Create a Scanner instance with custom dependencies
 *
 * This function allows overriding specific dependencies for testing or customization.
 * Any dependency not provided will use the default implementation.
 *
 * @param customDeps - Partial dependencies to override
 * @param options - Optional factory configuration
 * @returns Configured Scanner instance
 */
export async function createScannerWithDeps(
  customDeps: Partial<ScannerDeps>,
  options?: ScannerOptions
): Promise<Scanner> {
  // Create default deps
  const defaultDeps = await createScannerDeps(options)

  // Merge with custom deps (custom deps override defaults)
  const mergedDeps: ScannerDeps = {
    ...defaultDeps,
    ...customDeps,
  }

  return new Scanner(mergedDeps)
}

/**
 * Helper function to create default scanner dependencies
 *
 * @param options - Optional factory configuration
 * @returns Default scanner dependencies
 */
async function createScannerDeps(options?: ScannerOptions): Promise<ScannerDeps> {
  // Infrastructure
  const redis = RedisService.getInstance()
  const prisma = PrismaService.getInstance()

  // Storage
  const cache = new CacheService(redis)
  const repository = new ScanRepository(prisma)

  // Parser
  const parser: IParser = options?.filename
    ? createParser(options.filename) || new TypeScriptParser()
    : new TypeScriptParser()

  // Rules
  const ruleLoader = new RuleLoader(options?.ruleConfig)
  let rules: any[] = []
  try {
    // Get the directory of this module
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const ruleDir = join(__dirname, 'rules')
    rules = await ruleLoader.loadRules(ruleDir)
  } catch (error) {
    // Rules directory not found, continue with empty rules
    console.warn('Rules directory not found, continuing with empty rules')
  }

  // Analyzers
  const patternMatcher = new PatternMatcher(rules)
  const taintTracker = new TaintTracker()
  const scorer = new RiskScorer()

  // NEW: Create AI engine if configured AND not skipped
  let aiEngine: import('./ai-engine').IAIEngine | undefined
  let aiCache: import('./ai-engine').AICacheService | undefined

  if (options?.aiProvider && !options?.skipAI) {
    const { createAIEngine } = await import('./ai-engine')
    const { AICacheService } = await import('./ai-engine')
    aiEngine = createAIEngine({ provider: options.aiProvider }, redis) || undefined
    if (aiEngine) {
      aiCache = new AICacheService(redis)
    }
  }

  // Step 6.5: Create FalsePositiveFilter if database is available
  let falsePositiveFilter: FalsePositiveFilter | undefined

  if (options?.databaseUrl) {
    falsePositiveFilter = new FalsePositiveFilter(prisma.client)
  }

  // Step 6.6: Create PolicyEnforcer if database is available
  let policyEnforcer: PolicyEnforcer | undefined

  if (options?.databaseUrl) {
    const aiAvailable = !!aiEngine // Policy needs to know AI availability
    policyEnforcer = new PolicyEnforcer(aiAvailable)
  }

  return {
    parser,
    ruleLoader,
    patternMatcher,
    taintTracker,
    scorer,
    cache,
    repository,
    aiEngine,
    aiCache,
    falsePositiveFilter,
    policyEnforcer,
  }
}
