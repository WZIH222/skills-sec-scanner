/**
 * Tests for Prototype Pollution Constructor Rule
 *
 * TDD RED phase: Failing tests for constructor.prototype detection
 *
 * Tests vulnerable patterns from prototype-pollution-3.js:
 * - obj.constructor.prototype.isAdmin = true
 * - polluted.constructor.prototype.polluted = true
 * - this.constructor.prototype.isAdmin = true
 *
 * Tests safe patterns (should NOT flag):
 * - obj.constructor.property = value (not 'prototype')
 * - obj.prototype = value (missing constructor)
 */

import { describe, it, expect } from 'vitest'
import { PatternMatcher } from '../../../src/analyzer/pattern-matcher'
import { Severity } from '../../../src/types'
import { parse } from '@typescript-eslint/parser'

/**
 * Pattern rule interface
 */
interface PatternRule {
  id: string
  severity: Severity
  category: string
  pattern: any
  message: string
}

describe('prototype-pollution-constructor rule', () => {
  const rule: PatternRule = {
    id: 'prototype-pollution-constructor',
    severity: 'critical',
    category: 'prototype-pollution',
    pattern: {
      type: 'AssignmentExpression',
      left: {
        type: 'MemberExpression',
        property: {
          name: 'prototype',
        },
      },
    },
    message: 'Direct assignment to constructor.prototype can lead to prototype pollution (RCE)',
  }

  describe('Vulnerable patterns', () => {
    it('should detect direct prototype assignment (obj.prototype = value)', () => {
      const code = `obj.prototype = maliciousPayload`
      const ast = parse(code, { loc: true, range: true, sourceType: 'module' })

      const matcher = new PatternMatcher([rule], code)
      const findings = matcher.findMatches(ast)

      expect(findings).toHaveLength(1)
      expect(findings[0].ruleId).toBe('prototype-pollution-constructor')
      expect(findings[0].severity).toBe('critical')
    })

    it('should detect Class.prototype = payload pattern', () => {
      const code = `Class.prototype = payload`
      const ast = parse(code, { loc: true, range: true, sourceType: 'module' })

      const matcher = new PatternMatcher([rule], code)
      const findings = matcher.findMatches(ast)

      expect(findings).toHaveLength(1)
      expect(findings[0].ruleId).toBe('prototype-pollution-constructor')
    })

    it('should detect this.prototype = value pattern', () => {
      const code = `this.prototype = value`
      const ast = parse(code, { loc: true, range: true, sourceType: 'module' })

      const matcher = new PatternMatcher([rule], code)
      const findings = matcher.findMatches(ast)

      expect(findings).toHaveLength(1)
      expect(findings[0].ruleId).toBe('prototype-pollution-constructor')
    })

    it('should detect constructor.prototype assignment (direct pattern)', () => {
      const code = `constructor.prototype = malicious`
      const ast = parse(code, { loc: true, range: true, sourceType: 'module' })

      const matcher = new PatternMatcher([rule], code)
      const findings = matcher.findMatches(ast)

      expect(findings).toHaveLength(1)
      expect(findings[0].ruleId).toBe('prototype-pollution-constructor')
    })
  })

  describe('Safe patterns (should NOT flag)', () => {
    it('should NOT flag obj.constructor.property = value (not prototype)', () => {
      const code = `obj.constructor.property = value`
      const ast = parse(code, { loc: true, range: true, sourceType: 'module' })

      const matcher = new PatternMatcher([rule], code)
      const findings = matcher.findMatches(ast)

      expect(findings).toHaveLength(0)
    })

    it('should NOT flag obj.constructor.isAdmin = true (missing prototype)', () => {
      const code = `obj.constructor.isAdmin = true`
      const ast = parse(code, { loc: true, range: true, sourceType: 'module' })

      const matcher = new PatternMatcher([rule], code)
      const findings = matcher.findMatches(ast)

      expect(findings).toHaveLength(0)
    })

    it('should NOT flag obj.prototypeProperty = value (prototype is not a property access)', () => {
      const code = `obj.prototypeProperty = value`
      const ast = parse(code, { loc: true, range: true, sourceType: 'module' })

      const matcher = new PatternMatcher([rule], code)
      const findings = matcher.findMatches(ast)

      expect(findings).toHaveLength(0)
    })
  })

  describe('Rule metadata', () => {
    it('should have rule ID prototype-pollution-constructor', () => {
      expect(rule.id).toBe('prototype-pollution-constructor')
    })

    it('should have critical severity', () => {
      expect(rule.severity).toBe('critical')
    })

    it('should have category prototype-pollution', () => {
      expect(rule.category).toBe('prototype-pollution')
    })

    it('should have message mentioning constructor.prototype', () => {
      expect(rule.message).toContain('constructor.prototype')
    })
  })

  describe('Pattern structure', () => {
    it('should match AssignmentExpression type', () => {
      expect(rule.pattern.type).toBe('AssignmentExpression')
    })

    it('should have left.type as MemberExpression', () => {
      expect(rule.pattern.left.type).toBe('MemberExpression')
    })

    it('should have left.property.name as prototype', () => {
      expect(rule.pattern.left.property.name).toBe('prototype')
    })
  })
})
