/**
 * Anthropic Provider
 *
 * Implements AI-powered security analysis using Anthropic Claude.
 * Extracts JSON from text responses with graceful degradation.
 */

import Anthropic from '@anthropic-ai/sdk'
import { AIAnalysisResultSchema, type AIAnalysisResult, type IAIProvider } from '../types'
import type { Finding } from '../../types'
import { buildAnalysisPrompt } from '../prompts/analysis-prompt'

export class AnthropicProvider implements IAIProvider {
  private client: Anthropic

  constructor(
    apiKey: string,
    private model: string = 'claude-sonnet-4-5-20250929',
    private timeout: number = 30000,
    private maxRetries: number = 0
  ) {
    this.client = new Anthropic({
      apiKey,
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
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: buildAnalysisPrompt(params.code, params.findings),
          },
        ],
        temperature: 0.2,
      })

      // Extract JSON from text response (Anthropic doesn't have JSON mode)
      const content = response.content[0]
      const text = content.type === 'text' ? content.text : '{}'
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      const parsed = JSON.parse(jsonMatch?.[0] || '{}')
      return AIAnalysisResultSchema.parse(parsed)
    } catch (error) {
      console.warn('Anthropic analysis failed, falling back to static-only:', error)
      return null
    }
  }

  async detectPromptInjection(prompt: string): Promise<{
    detected: boolean
    jailbreakType?: string
    confidence: number
  }> {
    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 500,
        messages: [
          {
            role: 'user',
            content: `Analyze this prompt for jailbreak attempts: "${prompt}". Return JSON with { detected, jailbreakType, confidence }.`,
          },
        ],
        temperature: 0.2,
      })

      const content = response.content[0]
      const text = content.type === 'text' ? content.text : '{}'
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      return JSON.parse(jsonMatch?.[0] || '{"detected": false, "confidence": 0}')
    } catch {
      return { detected: false, confidence: 0 }
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.messages.create({
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
