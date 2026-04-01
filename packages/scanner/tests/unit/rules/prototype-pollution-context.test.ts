/**
 * Unit Tests for Prototype Pollution Context-Aware Detection (Phase 3.7 Plan 11)
 *
 * TDD RED phase: Failing tests for context-aware prototype pollution detection
 *
 * Tests that the prototype-pollution-assign rule can distinguish between
 * safe and unsafe Object.assign usage based on context patterns.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { PatternMatcher, PatternRule } from '../../../src/analyzer/pattern-matcher'
import { TypeScriptParser } from '../../../src/parser'

describe('Prototype Pollution Context-Aware Detection', () => {
  let patternMatcher: PatternMatcher
  let parser: TypeScriptParser

  beforeAll(() => {
    // Load the prototype-pollution-assign rule with safePatterns
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
      message: 'Object.assign() with __proto__ property can lead to prototype pollution (RCE)',
      safePatterns: [
        'Object.assign({}, defaults, userConfig)',
        'Object.assign({}, baseOptions, overrideOptions)',
        'Object.assign({}, obj)'
      ]
    }

    patternMatcher = new PatternMatcher([rule])
    parser = new TypeScriptParser()
  })

  /**
   * Test 1: Safe Object.assign with literal arguments not flagged
   * Given: Object.assign({}, {safe: 'property'})
   * When: PatternMatcher checks against safePatterns
   * Then: Should NOT flag (matches safe pattern or has no __proto__)
   */
  it('should NOT flag safe Object.assign with literal arguments', async () => {
    const code = `
      function mergeConfig() {
        const defaults = { debug: false, theme: 'light' };
        const userConfig = { theme: 'dark' };
        return Object.assign({}, defaults, userConfig);
      }
    `

    const parseResult = await parser.parse(code, 'test.js')
    const findings = patternMatcher.findMatches(parseResult.ast as any)

    const protoFindings = findings.filter(
      f => f.ruleId === 'prototype-pollution-assign'
    )

    // Should NOT flag safe Object.assign usage
    expect(protoFindings.length).toBe(0)
  })

  /**
   * Test 2: Safe Object.assign with identifier references to constants not flagged
   * Given: Object.assign({}, defaults, userConfig) where defaults/userConfig are local constants
   * When: PatternMatcher checks against safePatterns
   * Then: Should NOT flag (matches safe pattern)
   */
  it('should NOT flag safe Object.assign with identifier references to constants', async () => {
    const code = `
      function createOptions() {
        const baseOptions = { timeout: 5000, retries: 3 };
        const overrideOptions = { timeout: 10000 };
        return Object.assign({}, baseOptions, overrideOptions);
      }
    `

    const parseResult = await parser.parse(code, 'test.js')
    const findings = patternMatcher.findMatches(parseResult.ast as any)

    const protoFindings = findings.filter(
      f => f.ruleId === 'prototype-pollution-assign'
    )

    // Should NOT flag safe Object.assign usage
    expect(protoFindings.length).toBe(0)
  })

  /**
   * Test 3: Unsafe Object.assign with __proto__ property still flagged
   * Given: Object.assign(config, { __proto__: payload })
   * When: PatternMatcher checks against safePatterns
   * Then: Should flag (unsafe pattern with __proto__)
   */
  it('should flag unsafe Object.assign with __proto__ property', async () => {
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

    // Should flag unsafe Object.assign with __proto__
    expect(protoFindings.length).toBeGreaterThan(0)
    expect(protoFindings[0].severity).toBe('critical')
  })

  /**
   * Test 4: lodash-utility.js has 0 prototype pollution findings
   * Given: Full lodash-utility.js safe sample
   * When: PatternMatcher scans the file
   * Then: Should have 0 findings (all Object.assign usage is safe)
   */
  it('should NOT flag lodash-utility.js safe sample', async () => {
    const code = `
      const _ = require('lodash');

      function mergeConfig() {
        const defaults = { debug: false, theme: 'light', language: 'en' };
        const userConfig = { theme: 'dark', timezone: 'UTC' };
        return Object.assign({}, defaults, userConfig);
      }

      function createOptions() {
        const baseOptions = { timeout: 5000, retries: 3 };
        const overrideOptions = { timeout: 10000 };
        return _.merge({}, baseOptions, overrideOptions);
      }

      function cloneObject(obj) {
        return Object.assign({}, obj);
      }

      function pickSafeFields(data) {
        return _.pick(data, ['id', 'name', 'email']);
      }

      module.exports = { mergeConfig, createOptions, cloneObject, pickSafeFields };
    `

    const parseResult = await parser.parse(code, 'lodash-utility.js')
    const findings = patternMatcher.findMatches(parseResult.ast as any)

    const protoFindings = findings.filter(
      f => f.ruleId === 'prototype-pollution-assign'
    )

    // Should NOT flag any safe Object.assign usage
    expect(protoFindings.length).toBe(0)
  })

  /**
   * Test 5: prototype-pollution-1.js still flagged (contains __proto__)
   * Given: Adversary sample with actual __proto__ manipulation
   * When: PatternMatcher scans the file
   * Then: Should still flag (unsafe pattern detected)
   */
  it('should still flag prototype-pollution-1.js adversary sample', async () => {
    const code = `
      function vulnerable(payload) {
        const config = {};
        Object.assign(config, { __proto__: payload });
        return config;
      }
    `

    const parseResult = await parser.parse(code, 'prototype-pollution-1.js')
    const findings = patternMatcher.findMatches(parseResult.ast as any)

    const protoFindings = findings.filter(
      f => f.ruleId === 'prototype-pollution-assign'
    )

    // Should flag unsafe __proto__ usage
    expect(protoFindings.length).toBeGreaterThan(0)
    expect(protoFindings[0].severity).toBe('critical')
  })
})
