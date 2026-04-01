/**
 * Unit tests for prototype-pollution-assign rule
 *
 * Tests that the rule detects Object.assign with __proto__ in arguments
 * while allowing safe Object.assign usage
 */

import { describe, it, expect } from 'vitest'
import { PatternMatcher, PatternRule } from '../../../src/analyzer/pattern-matcher'
import { TypeScriptParser } from '../../../src/parser'

describe('Prototype Pollution Assign Rule', () => {
  let patternMatcher: PatternMatcher
  let parser: TypeScriptParser

  beforeAll(() => {
    // Load the prototype-pollution-assign rule
    const rule: PatternRule = {
      id: 'prototype-pollution-assign',
      severity: 'critical',
      category: 'prototype-pollution',
      pattern: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: 'Object',
          property: 'assign'
        },
        arguments: [
          {}, // First argument (target) - don't care
          {
            type: 'ObjectExpression',
            properties: [
              {
                type: 'Property',
                key: {
                  type: 'Identifier',
                  name: '__proto__'
                }
              }
            ]
          }
        ]
      },
      message: 'Object.assign() with user input can lead to prototype pollution (RCE)'
    }

    patternMatcher = new PatternMatcher([rule])
    parser = new TypeScriptParser()
  })

  /**
   * Test 1: Object.assign with __proto__ should trigger
   */
  it('should detect Object.assign with __proto__ property', async () => {
    const code = `
      function handleUserRequest(req) {
        const config = { debug: false, admin: false };
        const merged = Object.assign(config, { __proto__: payload });
        return merged;
      }
    `

    const parseResult = await parser.parse(code, 'test.js')
    const findings = patternMatcher.findMatches(parseResult.ast as any)

    const protoFindings = findings.filter(
      f => f.ruleId === 'prototype-pollution-assign'
    )

    expect(protoFindings.length).toBeGreaterThan(0)
    expect(protoFindings[0].severity).toBe('critical')
  })

  /**
   * Test 2: Object.assign without __proto__ should NOT trigger
   */
  it('should NOT detect Object.assign without __proto__ property', async () => {
    const code = `
      function mergeConfig(target, source) {
        return Object.assign(target, { safe: 'property' });
      }
    `

    const parseResult = await parser.parse(code, 'test.js')
    const findings = patternMatcher.findMatches(parseResult.ast as any)

    const protoFindings = findings.filter(
      f => f.ruleId === 'prototype-pollution-assign'
    )

    expect(protoFindings.length).toBe(0)
  })

  /**
   * Test 3: Object.assign with Identifier argument should NOT trigger
   * (Rule only checks for __proto__ in ObjectExpression, not all Identifiers)
   */
  it('should NOT detect Object.assign with Identifier argument (too broad)', async () => {
    const code = `
      function merge(target, source) {
        return Object.assign(target, source);
      }
    `

    const parseResult = await parser.parse(code, 'test.js')
    const findings = patternMatcher.findMatches(parseResult.ast as any)

    // This rule only detects __proto__ in ObjectExpression arguments
    // Object.assign with Identifier arguments is too broad to flag
    const protoFindings = findings.filter(
      f => f.ruleId === 'prototype-pollution-assign'
    )

    expect(protoFindings.length).toBe(0)
  })

  /**
   * Test 4: Object.assign with __proto__: null should trigger
   */
  it('should detect Object.assign with direct __proto__: null assignment', async () => {
    const code = `
      const obj = {};
      Object.assign(obj, { __proto__: null });
    `

    const parseResult = await parser.parse(code, 'test.js')
    const findings = patternMatcher.findMatches(parseResult.ast as any)

    const protoFindings = findings.filter(
      f => f.ruleId === 'prototype-pollution-assign'
    )

    expect(protoFindings.length).toBeGreaterThan(0)
  })
})
