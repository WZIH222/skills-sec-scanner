/**
 * Unit tests for output formatter
 *
 * Tests verify:
 * - formatResult returns string with scan summary
 * - formatResult includes color-coded severity badges
 * - formatResult handles empty findings
 * - formatResult includes code snippets when available
 * - formatResult includes AI explanations when available
 */

import { describe, it, expect } from 'vitest'
import { formatResult } from '../../src/output/formatter.js'
import type { ScanResult, Finding } from '@skills-sec/scanner'

describe('Output Formatter', () => {
  const mockResult: ScanResult = {
    findings: [],
    score: 0,
    metadata: {
      scannedAt: new Date(),
      scanDuration: 100,
    },
  }

  it('should return string', () => {
    const result = formatResult(mockResult, 'test.ts')
    expect(typeof result).toBe('string')
  })

  it('should include scan summary with findings count and score', () => {
    const result = formatResult(mockResult, 'test.ts')
    expect(result).toContain('Findings: 0')
    expect(result).toContain('Score: 0/100')
  })

  it('should handle empty findings', () => {
    const result = formatResult(mockResult, 'test.ts')
    expect(result).toContain('No security findings detected')
  })

  it('should include severity badges for findings', () => {
    const resultWithFindings: ScanResult = {
      findings: [
        {
          ruleId: 'test-rule',
          severity: 'high',
          message: 'Test finding',
          location: { line: 10, column: 5 },
        },
      ],
      score: 30,
      metadata: {
        scannedAt: new Date(),
        scanDuration: 100,
      },
    }

    const result = formatResult(resultWithFindings, 'test.ts')
    expect(result).toContain('[HIGH]')
    expect(result).toContain('Test finding')
  })

  it('should include code snippets when available', () => {
    const resultWithCode: ScanResult = {
      findings: [
        {
          ruleId: 'test-rule',
          severity: 'medium',
          message: 'Test finding',
          location: { line: 10, column: 5 },
          code: 'const x = 1;',
        },
      ],
      score: 20,
      metadata: {
        scannedAt: new Date(),
        scanDuration: 100,
      },
    }

    const result = formatResult(resultWithCode, 'test.ts')
    expect(result).toContain('const x = 1;')
  })

  it('should include AI explanations when available', () => {
    const resultWithAI: ScanResult = {
      findings: [
        {
          ruleId: 'test-rule',
          severity: 'critical',
          message: 'Test finding',
          location: { line: 10, column: 5 },
          explanation: 'This is a security risk because...',
          aiAnalyzed: true,
        },
      ],
      score: 50,
      metadata: {
        scannedAt: new Date(),
        scanDuration: 100,
        aiAnalysis: true,
        aiProvider: 'openai',
      },
    }

    const result = formatResult(resultWithAI, 'test.ts')
    expect(result).toContain('This is a security risk because...')
  })
})
