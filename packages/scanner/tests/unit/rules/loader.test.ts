/**
 * Tests for Rule Loader and Schema Validation
 *
 * TDD RED phase: Failing tests for rule loading functionality
 */

import { describe, it, expect } from 'vitest'
import { RuleLoader } from '../../../src/rules/loader'
import { RuleSchema, validateRule } from '../../../src/rules/schema'
import { PatternRule } from '../../../src/analyzer/pattern-matcher'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Get the path to the rules directory from the test file location
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const CORE_RULES_DIR = join(__dirname, '../../../src/rules/core')

describe('RuleSchema', () => {
  describe('validateRule()', () => {
    it('should validate a correct rule JSON', () => {
      const validRule = {
        id: 'eval-call',
        name: 'Detect eval() calls',
        severity: 'critical',
        category: 'injection',
        enabled: true,
        pattern: {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: 'eval',
          },
        },
        message: 'eval() allows arbitrary code execution',
        references: ['https://example.com/eval'],
      }

      const result = validateRule(validRule)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.id).toBe('eval-call')
        expect(result.data.severity).toBe('critical')
      }
    })

    it('should fail validation for rule with missing required fields', () => {
      const invalidRule = {
        id: 'incomplete-rule',
        // Missing required fields: name, severity, category, pattern, message
      }

      const result = validateRule(invalidRule)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })

    it('should fail validation for invalid severity', () => {
      const invalidRule = {
        id: 'bad-severity',
        name: 'Bad Severity',
        severity: 'urgent', // Not in enum
        category: 'injection',
        enabled: true,
        pattern: {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: 'eval',
          },
        },
        message: 'Test',
      }

      const result = validateRule(invalidRule)
      expect(result.success).toBe(false)
    })

    it('should fail validation for invalid category', () => {
      const invalidRule = {
        id: 'bad-category',
        name: 'Bad Category',
        severity: 'high',
        category: 'unknown', // Not in enum
        enabled: true,
        pattern: {
          type: 'CallExpression',
          callee: {
            type: 'Identifier',
            name: 'eval',
          },
        },
        message: 'Test',
      }

      const result = validateRule(invalidRule)
      expect(result.success).toBe(false)
    })
  })
})

describe('RuleLoader', () => {
  describe('loadRules()', () => {
    it('should load all core rules from JSON files', async () => {
      const loader = new RuleLoader()
      const rules = await loader.loadRules(CORE_RULES_DIR)

      expect(rules.length).toBeGreaterThan(0)
      expect(rules[0]).toMatchObject({
        id: expect.any(String),
        severity: expect.any(String),
        category: expect.any(String),
        pattern: expect.any(Object),
        message: expect.any(String),
      })
    })

    it('should return PatternRule[] compatible with PatternMatcher constructor', async () => {
      const loader = new RuleLoader()
      const rules = await loader.loadRules(CORE_RULES_DIR)

      // Verify structure matches PatternRule interface
      expect(rules.every(rule =>
        typeof rule.id === 'string' &&
        typeof rule.severity === 'string' &&
        typeof rule.category === 'string' &&
        typeof rule.pattern === 'object' &&
        typeof rule.message === 'string'
      )).toBe(true)
    })

    it('should respect enabled flag (skip disabled rules)', async () => {
      // This test assumes we have a disabled rule in the core directory
      const loader = new RuleLoader({
        disabledRules: ['eval-call'], // Simulate disabling this rule
      })
      const rules = await loader.loadRules(CORE_RULES_DIR)

      // Should not contain the disabled rule
      expect(rules.find(r => r.id === 'eval-call')).toBeUndefined()
    })

    it('should apply severity overrides from config', async () => {
      const loader = new RuleLoader({
        severityOverrides: {
          'eval-call': 'medium',
        },
      })
      const rules = await loader.loadRules(CORE_RULES_DIR)

      const evalRule = rules.find(r => r.id === 'eval-call')
      if (evalRule) {
        expect(evalRule.severity).toBe('medium')
      }
    })

    it('should throw detailed error if any rule fails validation', async () => {
      const loader = new RuleLoader()

      // Try to load from a directory that doesn't exist or has invalid rules
      await expect(loader.loadRules('./nonexistent-directory')).rejects.toThrow()
    })
  })
})
