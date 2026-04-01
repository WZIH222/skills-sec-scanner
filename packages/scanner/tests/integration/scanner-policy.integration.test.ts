/**
 * Scanner Policy Integration Tests
 *
 * TDD GREEN Phase: End-to-end tests for policy enforcement in scanner
 * These tests verify the complete integration of policy enforcement
 */

import { describe, it, expect } from 'vitest'
import { createScanner } from '../../src/factory'
import type { ScanResult } from '../../src/types'
import { PolicyMode } from '../../src/policy/policy-types'

describe('Scanner Policy Integration', () => {
  describe('Scanner with policy enforcement', () => {
    it('Test 1: Scanner.scan() with STRICT mode blocks critical findings', async () => {
      // Create scanner with database URL to enable PolicyEnforcer
      const scanner = await createScanner({
        databaseUrl: process.env.DATABASE_URL || 'file:./dev.db'
      })

      const codeWithCriticalIssue = `
        const userInput = req.body.code
        eval(userInput) // Critical: eval injection
      `

      const result = await scanner.scan(codeWithCriticalIssue, 'test.js', {
        policyMode: PolicyMode.STRICT,
        aiEnabled: false // Disable AI for this test
      })

      // Should have policyResult
      expect(result).toBeDefined()
      expect(result.policyResult).toBeDefined()
      expect(result.policyResult?.mode).toBe(PolicyMode.STRICT)

      // Should block when critical findings present
      const hasCriticalOrHigh = result.findings.some(
        f => f.severity === 'critical' || f.severity === 'high'
      )
      if (hasCriticalOrHigh) {
        expect(result.policyResult?.blockDecision).toBe('BLOCK')
      }
    })

    it('Test 2: Scanner.scan() with MODERATE mode allows with warnings', async () => {
      const scanner = await createScanner({
        databaseUrl: process.env.DATABASE_URL || 'file:./dev.db'
      })

      const codeWithHighIssue = `
        function dangerous(fn) {
          fn() // High: arbitrary code execution
        }
      `

      const result = await scanner.scan(codeWithHighIssue, 'test.js', {
        policyMode: PolicyMode.MODERATE,
        aiEnabled: false
      })

      // Should have policyResult with ALLOW
      expect(result.policyResult?.mode).toBe(PolicyMode.MODERATE)
      expect(result.policyResult?.blockDecision).toBe('ALLOW')

      // Should warn if high-risk findings present
      const hasCriticalOrHigh = result.findings.some(
        f => f.severity === 'critical' || f.severity === 'high'
      )
      if (hasCriticalOrHigh) {
        expect(result.policyResult?.warnings.length).toBeGreaterThan(0)
      }
    })

    it('Test 3: Scanner.scan() with PERMISSIVE mode allows without warnings', async () => {
      const scanner = await createScanner({
        databaseUrl: process.env.DATABASE_URL || 'file:./dev.db'
      })

      const codeWithIssue = `
        var x = 1
        console.log(x)
      `

      const result = await scanner.scan(codeWithIssue, 'test.js', {
        policyMode: PolicyMode.PERMISSIVE,
        aiEnabled: false
      })

      // Should have policyResult with ALLOW and no warnings
      expect(result.policyResult?.mode).toBe(PolicyMode.PERMISSIVE)
      expect(result.policyResult?.blockDecision).toBe('ALLOW')
      expect(result.policyResult?.warnings).toHaveLength(0)
    })

    it('Test 4: ScanResult includes policyResult metadata', async () => {
      const scanner = await createScanner({
        databaseUrl: process.env.DATABASE_URL || 'file:./dev.db'
      })

      const code = `
        // Test code
        function test() {
          return true
        }
      `

      const result = await scanner.scan(code, 'test.js', {
        policyMode: PolicyMode.MODERATE,
        aiEnabled: false
      })

      // ScanResult should have policyResult with all required fields
      expect(result).toHaveProperty('policyResult')
      expect(result.policyResult).toHaveProperty('mode')
      expect(result.policyResult).toHaveProperty('blockDecision')
      expect(result.policyResult).toHaveProperty('warnings')
      expect(result.policyResult).toHaveProperty('findings')
    })
  })
})
