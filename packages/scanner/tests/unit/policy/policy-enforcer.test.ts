/**
 * PolicyEnforcer Tests
 *
 * TDD RED Phase: Tests for policy enforcement logic
 * These tests will fail initially and pass after implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock imports - these will be implemented in Task 1
import { PolicyEnforcer } from '../../../src/policy/policy-enforcer'
import { PolicyMode, type PolicyResult, type BlockDecision } from '../../../src/policy/policy-types'

// Mock Finding type for testing
interface MockFinding {
  ruleId: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  message: string
  location: { line: number; column: number }
  code?: string
  explanation?: string
  confidence?: number
  aiAnalyzed?: boolean
}

describe('PolicyEnforcer', () => {
  describe('STRICT mode', () => {
    it('Test 1: STRICT mode blocks when ANY critical/high findings present', () => {
      const enforcer = new PolicyEnforcer(true)

      const findings: MockFinding[] = [
        {
          ruleId: 'TEST-001',
          severity: 'critical',
          message: 'Critical security issue',
          location: { line: 1, column: 1 },
          code: 'eval(userInput)',
          aiAnalyzed: true,
          confidence: 85
        }
      ]

      const result = enforcer.enforce(findings, 50, PolicyMode.STRICT)

      expect(result.mode).toBe(PolicyMode.STRICT)
      expect(result.blockDecision).toBe('BLOCK')
      expect(result.warnings).toContain('Blocked by STRICT policy')
    })

    it('Test 2: STRICT mode requires AI confirmation (confidence > 70) for findings', () => {
      const enforcer = new PolicyEnforcer(true)

      const findings: MockFinding[] = [
        {
          ruleId: 'TEST-002',
          severity: 'medium',
          message: 'Medium issue with low confidence',
          location: { line: 2, column: 1 },
          code: 'console.log(foo)',
          aiAnalyzed: true,
          confidence: 50 // Below threshold
        }
      ]

      const result = enforcer.enforce(findings, 30, PolicyMode.STRICT)

      // Low confidence findings should be filtered out in STRICT mode
      expect(result.findings).toHaveLength(0)
      expect(result.blockDecision).toBe('ALLOW') // No threats after filtering
    })

    it('Test 3: STRICT mode allows when no critical/high findings', () => {
      const enforcer = new PolicyEnforcer(PolicyMode.STRICT, true)

      const findings: MockFinding[] = [
        {
          ruleId: 'TEST-003',
          severity: 'low',
          message: 'Low severity issue',
          location: { line: 3, column: 1 },
          code: 'var x = 1',
          aiAnalyzed: true,
          confidence: 75
        }
      ]

      const result = enforcer.enforce(findings, 10, PolicyMode.STRICT)

      expect(result.blockDecision).toBe('ALLOW')
      expect(result.findings).toHaveLength(1)
    })
  })

  describe('MODERATE mode', () => {
    it('Test 4: MODERATE mode allows all findings but warns on critical/high', () => {
      const enforcer = new PolicyEnforcer(true)

      const findings: MockFinding[] = [
        {
          ruleId: 'TEST-004',
          severity: 'critical',
          message: 'Critical issue',
          location: { line: 1, column: 1 },
          code: 'dangerous()'
        }
      ]

      const result = enforcer.enforce(findings, 50, PolicyMode.MODERATE)

      expect(result.mode).toBe(PolicyMode.MODERATE)
      expect(result.blockDecision).toBe('ALLOW')
      expect(result.warnings).toContain('High-risk findings detected - review recommended')
      expect(result.findings).toHaveLength(1) // All findings included
    })

    it('Test 5: MODERATE mode never blocks (blockDecision always ALLOW)', () => {
      const enforcer = new PolicyEnforcer(true)

      const findings: MockFinding[] = [
        {
          ruleId: 'TEST-005',
          severity: 'high',
          message: 'High severity issue',
          location: { line: 2, column: 1 }
        }
      ]

      const result = enforcer.enforce(findings, 40, PolicyMode.MODERATE)

      expect(result.blockDecision).toBe('ALLOW')
    })

    it('Test 6: MODERATE mode adds no warnings for low/medium findings', () => {
      const enforcer = new PolicyEnforcer(true)

      const findings: MockFinding[] = [
        {
          ruleId: 'TEST-006',
          severity: 'medium',
          message: 'Medium issue',
          location: { line: 3, column: 1 }
        }
      ]

      const result = enforcer.enforce(findings, 20, PolicyMode.MODERATE)

      expect(result.warnings).toHaveLength(0)
      expect(result.blockDecision).toBe('ALLOW')
    })
  })

  describe('PERMISSIVE mode', () => {
    it('Test 7: PERMISSIVE mode allows all findings with no warnings', () => {
      const enforcer = new PolicyEnforcer(true)

      const findings: MockFinding[] = [
        {
          ruleId: 'TEST-007',
          severity: 'critical',
          message: 'Critical issue',
          location: { line: 1, column: 1 },
          code: 'eval()'
        },
        {
          ruleId: 'TEST-008',
          severity: 'high',
          message: 'High issue',
          location: { line: 2, column: 1 }
        }
      ]

      const result = enforcer.enforce(findings, 100, PolicyMode.PERMISSIVE)

      expect(result.mode).toBe(PolicyMode.PERMISSIVE)
      expect(result.blockDecision).toBe('ALLOW')
      expect(result.warnings).toHaveLength(0)
      expect(result.findings).toHaveLength(2) // All findings included
    })
  })

  describe('AI availability handling', () => {
    it('Test 8: Policy enforcement respects AI availability (logs warning when AI unavailable in STRICT)', () => {
      const enforcer = new PolicyEnforcer(false)

      const findings: MockFinding[] = [
        {
          ruleId: 'TEST-009',
          severity: 'medium',
          message: 'Medium issue',
          location: { line: 1, column: 1 },
          aiAnalyzed: false // No AI analysis
        }
      ]

      const consoleWarnSpy = vi.spyOn(console, 'warn')

      const result = enforcer.enforce(findings, 20, PolicyMode.STRICT)

      // When AI unavailable, should include all findings (not filtered)
      expect(result.findings).toHaveLength(1)
      // Should log warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('AI unavailable')
      )

      consoleWarnSpy.mockRestore()
    })
  })
})
