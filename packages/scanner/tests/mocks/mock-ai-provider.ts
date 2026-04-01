/**
 * Mock AI Provider for testing AI-powered analysis
 * Implements IAIProvider interface for reliable unit testing without external API dependencies
 */

/**
 * AI analysis result structure
 * Based on expected interface from Phase 2 RESEARCH.md
 */
export interface AIAnalysisResult {
  findings: Array<{
    ruleId: string
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
    message: string
    explanation: string
    confidence: number
  }>
  promptInjectionDetected?: boolean
  jailbreakType?: 'DAN' | 'role-reversal' | 'ignore-instructions' | 'none'
}

/**
 * Finding interface (matching core Finding type)
 */
export interface Finding {
  ruleId: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  message: string
  location: { line: number; column: number }
  code?: string
}

/**
 * Parameters for AI code analysis
 */
export interface AnalyzeCodeParams {
  code: string
  filename?: string
  findings: Finding[]
}

/**
 * Result of prompt injection detection
 */
export interface PromptInjectionResult {
  detected: boolean
  jailbreakType?: string
  confidence: number
}

/**
 * Mock AI Provider implementation
 * Enables unit testing of AI engine without actual API calls
 *
 * @example
 * ```ts
 * // Create mock that returns predefined response
 * const mock = new MockAIProvider(false, {
 *   findings: [{ ruleId: 'AI-001', severity: 'high', message: 'Test', explanation: 'Test explanation', confidence: 90 }],
 *   promptInjectionDetected: false
 * })
 *
 * // Create mock that simulates failure
 * const failingMock = new MockAIProvider(true)
 * ```
 */
export class MockAIProvider {
  private callCount: number = 0
  private lastCallParams?: AnalyzeCodeParams
  private lastPromptInjectionCheck?: string

  /**
   * Create a new MockAIProvider
   *
   * @param shouldFail - If true, all methods will throw errors (simulates API failure)
   * @param mockResponse - Predefined response to return from analyzeCode()
   * @param mockPromptInjectionResult - Predefined response for detectPromptInjection()
   * @param mockIsAvailable - Override isAvailable() return value
   */
  constructor(
    private shouldFail: boolean = false,
    private mockResponse?: AIAnalysisResult,
    private mockPromptInjectionResult?: PromptInjectionResult,
    private mockIsAvailable: boolean = true
  ) {}

  /**
   * Analyze code for security threats using AI
   *
   * @param params - Code analysis parameters
   * @returns AI analysis result with findings and confidence scores
   * @throws Error if shouldFail is true (simulates API failure)
   */
  async analyzeCode(params: AnalyzeCodeParams): Promise<AIAnalysisResult> {
    this.callCount++
    this.lastCallParams = params

    if (this.shouldFail) {
      throw new Error('Mock AI provider: Simulated API failure')
    }

    // Return mock response or default empty result
    return (
      this.mockResponse || {
        findings: [],
        promptInjectionDetected: false,
        jailbreakType: 'none',
      }
    )
  }

  /**
   * Detect prompt injection patterns in text
   *
   * @param prompt - Text to check for prompt injection
   * @returns Detection result with jailbreak type and confidence
   * @throws Error if shouldFail is true (simulates API failure)
   */
  async detectPromptInjection(prompt: string): Promise<PromptInjectionResult> {
    this.lastPromptInjectionCheck = prompt

    if (this.shouldFail) {
      throw new Error('Mock AI provider: Simulated API failure')
    }

    // Return mock result or default not detected
    return (
      this.mockPromptInjectionResult || {
        detected: false,
        confidence: 0,
      }
    )
  }

  /**
   * Check if AI provider is available
   *
   * @returns true if available, false if shouldFail is true
   */
  async isAvailable(): Promise<boolean> {
    return this.mockIsAvailable && !this.shouldFail
  }

  /**
   * Get the number of times analyzeCode was called
   * Useful for verifying that AI was/wasn't invoked in tests
   */
  getCallCount(): number {
    return this.callCount
  }

  /**
   * Get the parameters from the last analyzeCode call
   */
  getLastCallParams(): AnalyzeCodeParams | undefined {
    return this.lastCallParams
  }

  /**
   * Get the last prompt checked for injection
   */
  getLastPromptInjectionCheck(): string | undefined {
    return this.lastPromptInjectionCheck
  }

  /**
   * Reset call tracking
   * Useful for test isolation
   */
  reset(): void {
    this.callCount = 0
    this.lastCallParams = undefined
    this.lastPromptInjectionCheck = undefined
  }

  /**
   * Update mock response after construction
   * Useful for testing different scenarios in the same test
   */
  setMockResponse(response: AIAnalysisResult): void {
    this.mockResponse = response
  }

  /**
   * Update prompt injection mock result
   */
  setMockPromptInjectionResult(result: PromptInjectionResult): void {
    this.mockPromptInjectionResult = result
  }

  /**
   * Toggle failure mode
   */
  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail
  }
}

// Export as default for convenience
export default MockAIProvider
