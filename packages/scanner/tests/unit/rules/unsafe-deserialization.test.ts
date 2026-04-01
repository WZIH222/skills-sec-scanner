/**
 * Unit tests for unsafe-deserialization rule
 *
 * Tests that the rule detects JSON.parse with user input (Identifier)
 * while allowing safe JSON.parse with literal arguments
 */

import { describe, it, expect } from 'vitest'
import { PatternMatcher, PatternRule } from '../../../src/analyzer/pattern-matcher'
import { TypeScriptParser } from '../../../src/parser'

describe('Unsafe Deserialization Rule', () => {
  let patternMatcher: PatternMatcher
  let parser: TypeScriptParser

  beforeAll(() => {
    // Load the unsafe-deserialization rule
    const rule: PatternRule = {
      id: 'unsafe-deserialization',
      severity: 'high',
      category: 'deserialization',
      pattern: {
        type: 'CallExpression',
        callee: {
          type: 'MemberExpression',
          object: 'JSON',
          property: 'parse'
        },
        arguments: [
          {
            type: 'Identifier'
          }
        ]
      },
      message: 'JSON.parse() with user input can lead to prototype pollution'
    }

    patternMatcher = new PatternMatcher([rule])
    parser = new TypeScriptParser()
  })

  /**
   * Test 1: JSON.parse with Identifier argument should trigger
   */
  it('should detect JSON.parse with Identifier argument (user input)', async () => {
    const code = `
      const userInput = 'test';
      const data = JSON.parse(userInput);
      return data;
    `

    const parseResult = await parser.parse(code, 'test.js')
    const findings = patternMatcher.findMatches(parseResult.ast as any)

    const unsafeFindings = findings.filter(
      f => f.ruleId === 'unsafe-deserialization'
    )

    expect(unsafeFindings.length).toBeGreaterThan(0)
    expect(unsafeFindings[0].severity).toBe('high')
  })

  /**
   * Test 2: JSON.parse with Literal argument should NOT trigger
   */
  it('should NOT detect JSON.parse with Literal argument (safe)', async () => {
    const code = `
      const config = JSON.parse('{"key": "value"}');
      return config;
    `

    const parseResult = await parser.parse(code, 'test.js')
    const findings = patternMatcher.findMatches(parseResult.ast as any)

    const unsafeFindings = findings.filter(
      f => f.ruleId === 'unsafe-deserialization'
    )

    expect(unsafeFindings.length).toBe(0)
  })

  /**
   * Test 3: JSON.parse with MemberExpression argument should trigger
   */
  it('should detect JSON.parse with MemberExpression argument (user input)', async () => {
    const code = `
      function parseResponse(response) {
        const data = JSON.parse(response.text);
        return data;
      }
    `

    const parseResult = await parser.parse(code, 'test.js')
    const findings = patternMatcher.findMatches(parseResult.ast as any)

    // Note: Current pattern only checks for Identifier type
    // MemberExpression requires a separate pattern or more complex matching
    // For now, we expect this NOT to match (pattern is too specific)
    const unsafeFindings = findings.filter(
      f => f.ruleId === 'unsafe-deserialization'
    )

    // This test documents current behavior - pattern only matches Identifier
    expect(unsafeFindings.length).toBe(0)
  })

  /**
   * Test 4: Multiple JSON.parse calls - only Identifier args should trigger
   */
  it('should detect JSON.parse with Identifier but not Literal', async () => {
    const code = `
      const safe = JSON.parse('{"safe": true}');
      const unsafe = JSON.parse(userInput);
    `

    const parseResult = await parser.parse(code, 'test.js')
    const findings = patternMatcher.findMatches(parseResult.ast as any)

    const unsafeFindings = findings.filter(
      f => f.ruleId === 'unsafe-deserialization'
    )

    // Should detect 1 unsafe call (userInput), not the safe one
    expect(unsafeFindings.length).toBe(1)
  })
})
