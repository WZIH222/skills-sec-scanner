/**
 * Tests for AI Analysis Prompt Builder
 *
 * These tests verify the prompt generation for AI security analysis.
 */

import { describe, it, expect } from 'vitest'
import { buildAnalysisPrompt } from '../../../src/ai-engine/prompts/analysis-prompt'
import type { Finding } from '../../../src/types'

describe('Analysis Prompt Builder', () => {
  /**
   * Test 1: buildAnalysisPrompt generates prompt with code
   */
  it('should generate prompt with code snippet', () => {
    const code = 'const x = eval(userInput)'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('const x = eval(userInput)')
    expect(prompt).toContain('security expert')
  })

  /**
   * Test 2: buildAnalysisPrompt includes existing findings
   */
  it('should include existing static findings in prompt', () => {
    const code = 'const x = 1'
    const findings: Finding[] = [
      {
        ruleId: 'no-eval',
        severity: 'critical',
        message: 'eval() is dangerous',
        location: { line: 1, column: 0 },
      },
    ]

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('no-eval')
    expect(prompt).toContain('eval() is dangerous')
    expect(prompt).toContain('critical')
  })

  /**
   * Test 3: buildAnalysisPrompt handles no findings gracefully
   */
  it('should handle empty findings array', () => {
    const code = 'const x = 1'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('No static findings detected')
  })

  /**
   * Test 4: buildAnalysisPrompt specifies JSON output format
   */
  it('should specify JSON output format in prompt', () => {
    const code = 'const x = 1'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('JSON')
    expect(prompt).toContain('findings')
    expect(prompt).toContain('explanation')
    expect(prompt).toContain('confidence')
  })

  /**
   * Test 5: buildAnalysisPrompt specifies explanation length requirements
   */
  it('should specify explanation length (3-5 sentences, 50-500 chars)', () => {
    const code = 'const x = 1'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('3-5 sentences')
    expect(prompt).toContain('50')
    expect(prompt).toContain('500')
  })

  /**
   * Test 6: buildAnalysisPrompt specifies confidence score range
   */
  it('should specify confidence score range (0-100)', () => {
    const code = 'const x = 1'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('0-100')
  })

  /**
   * Test 7: buildAnalysisPrompt includes prompt injection detection instruction
   */
  it('should include prompt injection detection instruction', () => {
    const code = 'const x = 1'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('prompt injection')
    expect(prompt).toContain('jailbreak')
  })

  /**
   * Test 8: buildAnalysisPrompt formats multiple findings correctly
   */
  it('should format multiple findings correctly', () => {
    const code = 'const x = 1'
    const findings: Finding[] = [
      {
        ruleId: 'no-eval',
        severity: 'critical',
        message: 'eval() is dangerous',
        location: { line: 1, column: 0 },
      },
      {
        ruleId: 'no-console',
        severity: 'low',
        message: 'console.log in production',
        location: { line: 2, column: 0 },
      },
    ]

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('- no-eval')
    expect(prompt).toContain('- no-console')
  })

  /**
   * Test 9: buildAnalysisPrompt includes severity levels in findings
   */
  it('should include severity levels in findings', () => {
    const code = 'const x = 1'
    const findings: Finding[] = [
      {
        ruleId: 'test-rule',
        severity: 'high',
        message: 'Test message',
        location: { line: 1, column: 0 },
      },
    ]

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toMatch(/test-rule.*severity.*high/i)
  })

  /**
   * Test 10: buildAnalysisPrompt handles complex code snippets
   */
  it('should handle complex code with special characters', () => {
    const code = `
      function process(input) {
        const result = eval(input)
        return result
      }
    `
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('eval(input)')
  })

  /**
   * Test 11: buildAnalysisPrompt includes prototype pollution description
   */
  it('should include prototype pollution threat description', () => {
    const code = 'const x = 1'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('Prototype pollution')
    expect(prompt).toContain('Object.assign')
    expect(prompt).toContain('__proto__')
  })

  /**
   * Test 12: buildAnalysisPrompt includes DOM XSS description
   */
  it('should include DOM XSS threat description', () => {
    const code = 'const x = 1'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('DOM XSS')
    expect(prompt).toContain('innerHTML')
    expect(prompt).toContain('location/search')
  })

  /**
   * Test 13: buildAnalysisPrompt includes unsafe deserialization description
   */
  it('should include unsafe deserialization threat description', () => {
    const code = 'const x = 1'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('Unsafe deserialization')
    expect(prompt).toContain('JSON.parse')
    expect(prompt).toContain('reviver')
  })

  /**
   * Test 14: buildAnalysisPrompt includes path traversal description
   */
  it('should include path traversal threat description', () => {
    const code = 'const x = 1'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('Path traversal')
    expect(prompt).toContain('fs operations')
  })

  /**
   * Test 15: buildAnalysisPrompt includes sensitive data description
   */
  it('should include sensitive data exposure threat description', () => {
    const code = 'const x = 1'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('Sensitive data exposure')
    expect(prompt).toContain('API keys')
    expect(prompt).toContain('tokens')
    expect(prompt).toContain('credentials')
  })

  /**
   * Test 16: buildAnalysisPrompt includes bidirectional severity adjustment
   */
  it('should include bidirectional severity adjustment instructions', () => {
    const code = 'const x = 1'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('Bidirectional severity adjustment')
    expect(prompt).toContain('Upgrade Medium→High')
    expect(prompt).toContain('Downgrade High→Medium')
    expect(prompt).toContain('context confirms exploitability')
    expect(prompt).toContain('context shows safe usage')
  })

  /**
   * Test 17: buildAnalysisPrompt includes existing threat descriptions
   */
  it('should include existing threat descriptions for backward compatibility', () => {
    const code = 'const x = 1'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    expect(prompt).toContain('[existing threats: injection, file-access, credentials, network]')
  })

  /**
   * Test 18: buildAnalysisPrompt has valid TASK section structure
   */
  it('should have valid TASK section with numbered items', () => {
    const code = 'const x = 1'
    const findings: Finding[] = []

    const prompt = buildAnalysisPrompt(code, findings)

    // Check for TASK section
    expect(prompt).toContain('TASK:')

    // Check for numbered sections
    expect(prompt).toMatch(/1\.\s+Review the code for security threats/)
    expect(prompt).toMatch(/2\.\s+For each threat found/)
    expect(prompt).toMatch(/3\.\s+Bidirectional severity adjustment/)
    expect(prompt).toMatch(/4\.\s+Check for prompt injection/)
    expect(prompt).toMatch(/5\.\s+Return JSON/)
  })
})
