/**
 * OpenAI Provider
 *
 * Implements AI-powered security analysis using OpenAI GPT-4.
 * Uses JSON mode for structured output with graceful degradation.
 */

import OpenAI from 'openai'
import { AIAnalysisResultSchema, type AIAnalysisResult, type IAIProvider } from '../types'
import type { Finding } from '../../types'
import { buildAnalysisPrompt } from '../prompts/analysis-prompt'

export class OpenAIProvider implements IAIProvider {
  private client: OpenAI

  constructor(
    apiKey: string,
    private model: string = 'gpt-4o',
    private timeout: number = 30000,
    private maxRetries: number = 0,
    private baseURL?: string
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL: this.baseURL,
      maxRetries: this.maxRetries,
      timeout: this.timeout,
    })
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
      console.warn('OpenAI analysis failed, falling back to static-only:', error)
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
      await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      })
      return true
    } catch {
      return false
    }
  }
}
