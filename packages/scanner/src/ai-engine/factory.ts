/**
 * AI Engine Factory
 *
 * Factory function for creating AI engine instances with configured providers.
 * Provides abstraction over provider instantiation and error handling.
 *
 * Usage:
 *   const aiEngine = createAIEngine(
 *     { provider: { type: 'openai', apiKey: 'sk-...' } },
 *     cacheService
 *   )
 */

import { AIEngine, type AIEngineConfig, type IAIEngine } from './index'
import { OpenAIProvider } from './providers/openai-provider'
import { AnthropicProvider } from './providers/anthropic-provider'
import { CustomProvider } from './providers/custom-provider'
import { TestAIProvider } from './providers/test-provider'
import { AICacheService } from './cache/ai-cache-service'
import { RedisService } from '../storage/cache/client'
import type { AIProviderConfig } from './types'

export interface AIEngineFactoryConfig {
  provider: AIProviderConfig
  engine?: AIEngineConfig
}

/**
 * Create AI engine with configured provider
 * @param config - Provider and engine configuration
 * @param redisService - Redis service for AI caching
 * @returns AI engine instance or null if config invalid
 */
export function createAIEngine(
  config: AIEngineFactoryConfig,
  redisService: RedisService
): IAIEngine | null {
  try {
    // Create provider based on type
    let provider
    const { type, apiKey, baseURL, model, timeout, maxRetries } = config.provider

    switch (type) {
      case 'openai':
        if (!apiKey) {
          console.warn('OpenAI provider requires API key, AI disabled')
          return null
        }
        provider = new OpenAIProvider(apiKey, model, timeout, maxRetries, baseURL)
        break

      case 'anthropic':
        if (!apiKey) {
          console.warn('Anthropic provider requires API key, AI disabled')
          return null
        }
        provider = new AnthropicProvider(apiKey, model, timeout, maxRetries)
        break

      case 'custom':
        provider = new CustomProvider(config.provider)
        break

      case 'test':
        provider = new TestAIProvider()
        break

      default:
        console.warn(`Unknown AI provider type: ${type}, AI disabled`)
        return null
    }

    // Create AI cache service wrapping existing cache
    const aiCache = new AICacheService(redisService)

    // Create AI engine with provider and cache
    return new AIEngine(provider, aiCache, config.engine)
  } catch (error) {
    console.error('Failed to create AI engine, using static-only:', error)
    return null
  }
}
