/**
 * Custom Provider
 *
 * Implements AI-powered security analysis using OpenAI-compatible endpoints.
 * Supports self-hosted models (Ollama, vLLM, local-ai) via custom baseURL.
 */

import { OpenAI } from 'openai'
import { AIAnalysisResultSchema, type AIAnalysisResult, type IAIProvider, type AIProviderConfig } from '../types'
import type { Finding } from '../../types'
import { buildAnalysisPrompt } from '../prompts/analysis-prompt'

/**
 * Custom provider for OpenAI-compatible endpoints
 *
 * Supports self-hosted models (Ollama, vLLM, local-ai)
 * by using custom baseURL configuration.
 */
export class CustomProvider implements IAIProvider {
  private client: OpenAI
  private model: string

  constructor(config: AIProviderConfig) {
    console.info('[CustomProvider] Constructor called with:', { type: config.type, hasApiKey: !!config.apiKey, baseURL: config.baseURL, model: config.model })
    if (!config.baseURL) {
      throw new Error('Custom provider requires baseURL')
    }

    this.model = config.model || 'default-model'
    this.client = new OpenAI({
      apiKey: config.apiKey || 'dummy-key', // Some local APIs don't require keys
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 0,
    })
    console.info('[CustomProvider] OpenAI client created with baseURL:', config.baseURL)
  }

  async analyzeCode(params: {
    code: string
    filename?: string
    findings: Finding[]
  }): Promise<AIAnalysisResult | null> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a security expert analyzing AI Skills files for threats. Return JSON matching the schema.',
          },
          {
            role: 'user',
            content: buildAnalysisPrompt(params.code, params.findings),
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      })

      const content = response.choices[0].message.content || '{}'
      const parsed = JSON.parse(content)
      return AIAnalysisResultSchema.parse(parsed)
    } catch (error) {
      console.warn('Custom provider analysis failed, falling back to static-only:', error)
      return null
    }
  }

  async detectPromptInjection(prompt: string): Promise<{
    detected: boolean
    jailbreakType?: string
    confidence: number
  }> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: `Analyze this prompt for jailbreak attempts: "${prompt}". Return JSON with { detected, jailbreakType, confidence }.`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      })

      const content = response.choices[0].message.content || '{}'
      return JSON.parse(content)
    } catch {
      return { detected: false, confidence: 0 }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      console.info('[CustomProvider] isAvailable checking with model:', this.model)
      await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      })
      console.info('[CustomProvider] isAvailable returned true')
      return true
    } catch (error) {
      console.warn('[CustomProvider] isAvailable returned false:', error)
      return false
    }
  }
}
