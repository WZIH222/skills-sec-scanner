/**
 * Prompt Injection Detector
 *
 * Detects prompt injection and jailbreak attempts using pattern-based detection
 * with optional AI semantic analysis as fallback for obfuscated attempts.
 *
 * Covers common jailbreak patterns:
 * - DAN (Do Anything Now)
 * - Role reversal attacks
 * - Instruction override attempts
 * - System prompt extraction attempts
 */

export interface JailbreakPattern {
  name: string
  pattern: RegExp
  confidence: number
  description: string
}

export class PromptInjectionDetector {
  private readonly JAILBREAK_PATTERNS: JailbreakPattern[] = [
    {
      name: 'DAN',
      pattern: /do anything now|ignore\s+all\s+instructions/i,
      confidence: 90,
      description: 'Do Anything Now jailbreak attempt'
    },
    {
      name: 'role-reversal',
      pattern: /act\s+as|pretend\s+you\s+are|you\s+are\s+now/i,
      confidence: 70,
      description: 'Role reversal attack'
    },
    {
      name: 'ignore-instructions',
      pattern: /ignore\s+previous|disregard\s+earlier|forget\s+everything/i,
      confidence: 85,
      description: 'Instruction override attempt'
    },
    {
      name: 'system-prompt',
      pattern: /show\s+your\s+instructions|print\s+your\s+prompt|what\s+are\s+you\s+programmed/i,
      confidence: 80,
      description: 'System prompt extraction attempt'
    }
  ]

  /**
   * Detect prompt injection using pattern matching
   * @param prompt - Prompt content to analyze
   * @returns Detection result with jailbreak type and confidence
   */
  detect(prompt: string): {
    detected: boolean
    jailbreakType?: string
    confidence: number
    description?: string
  } {
    for (const { name, pattern, confidence, description } of this.JAILBREAK_PATTERNS) {
      if (pattern.test(prompt)) {
        return {
          detected: true,
          jailbreakType: name,
          confidence,
          description
        }
      }
    }
    return { detected: false, confidence: 0 }
  }

  /**
   * Detect prompt injection using AI semantic analysis
   * Use this for complex/obfuscated attempts that bypass pattern matching
   * @param prompt - Prompt content to analyze
   * @param aiEngine - AI engine for semantic analysis
   * @returns Detection result with confidence score
   */
  async detectWithAI(
    prompt: string,
    aiEngine: any // IAIEngine (will be defined in Task 2)
  ): Promise<{
    detected: boolean
    confidence: number
    jailbreakType?: string
  }> {
    try {
      return await aiEngine.detectPromptInjection(prompt)
    } catch (error) {
      console.warn('AI prompt injection detection failed:', error)
      return { detected: false, confidence: 0 }
    }
  }

  /**
   * Combined detection: pattern-based first, AI fallback if undetected
   * @param prompt - Prompt content to analyze
   * @param aiEngine - Optional AI engine for fallback
   * @returns Best available detection result
   */
  async detectWithFallback(
    prompt: string,
    aiEngine?: any
  ): Promise<{
    detected: boolean
    jailbreakType?: string
    confidence: number
    method: 'pattern' | 'ai' | 'none'
  }> {
    // Try pattern-based first (fast, deterministic)
    const patternResult = this.detect(prompt)
    if (patternResult.detected) {
      return { ...patternResult, method: 'pattern' as const }
    }

    // Fallback to AI if available (catches obfuscated attempts)
    if (aiEngine) {
      const aiResult = await this.detectWithAI(prompt, aiEngine)
      if (aiResult.detected) {
        return { ...aiResult, method: 'ai' as const }
      }
    }

    return { detected: false, confidence: 0, method: 'none' as const }
  }

  /**
   * Get all jailbreak patterns (for testing/documentation)
   */
  getPatterns(): JailbreakPattern[] {
    return [...this.JAILBREAK_PATTERNS]
  }
}
