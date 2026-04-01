/**
 * Integration tests for Taint Tracker (Data Flow Analysis)
 *
 * Tests taint tracking functionality to detect when user input
 * reaches dangerous sinks like eval(), fetch(), fs operations.
 */

import { describe, it, expect } from 'vitest'
import { TSESTree } from '@typescript-eslint/typescript-estree'
import { parse } from '@typescript-eslint/parser'
import { TaintTracker } from '../../../src/analyzer/data-flow'
import { Finding } from '../../../src/types'

describe('TaintTracker - Data Flow Analysis', () => {
  /**
   * Test 1: Detects function parameter reaching eval() - Critical finding
   */
  it('should detect function parameter reaching eval() - Critical severity', () => {
    const code = `
      function processUserInput(userInput) {
        eval(userInput);
      }
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()
    const findings: Finding[] = tracker.analyze(ast as TSESTree.Program)

    expect(findings).toHaveLength(1)
    expect(findings[0].ruleId).toBe('taint-data-flow')
    expect(findings[0].severity).toBe('critical')
    expect(findings[0].message).toContain('eval')
    expect(findings[0].message).toContain('userInput')
  })

  /**
   * Test 2: Detects user input reaching fetch() - High finding
   */
  it('should detect user input reaching fetch() - High severity', () => {
    const code = `
      function sendToApi(data) {
        fetch('https://api.example.com', {
          method: 'POST',
          body: JSON.stringify(data)
        });
      }
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()
    const findings: Finding[] = tracker.analyze(ast as TSESTree.Program)

    expect(findings).toHaveLength(1)
    expect(findings[0].ruleId).toBe('taint-data-flow')
    expect(findings[0].severity).toBe('high')
    expect(findings[0].message).toContain('fetch')
    expect(findings[0].message).toContain('data')
  })

  /**
   * Test 3: Detects parameter reaching fs.writeFile() - High finding
   */
  it('should detect parameter reaching fs.writeFile() - High severity', () => {
    const code = `
      const fs = require('fs');
      function saveContent(content) {
        fs.writeFile('/tmp/output.txt', content, (err) => {
          if (err) console.error(err);
        });
      }
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()
    const findings: Finding[] = tracker.analyze(ast as TSESTree.Program)

    // Filter to only fs.writeFile findings (ignore other sinks)
    const fsWriteFindings = findings.filter(f => f.message.includes('fs.writeFile'))
    expect(fsWriteFindings.length).toBeGreaterThanOrEqual(1)
    const fsFinding = fsWriteFindings[0]
    expect(fsFinding.ruleId).toBe('taint-data-flow')
    expect(fsFinding.severity).toBe('high')
    expect(fsFinding.message).toContain('content')
  })

  /**
   * Test 4: Tracks data through variable reassignments
   */
  it('should track data through variable reassignments', () => {
    const code = `
      function process(input) {
        const x = input;
        const y = x;
        eval(y);
      }
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()
    const findings: Finding[] = tracker.analyze(ast as TSESTree.Program)

    expect(findings).toHaveLength(1)
    expect(findings[0].ruleId).toBe('taint-data-flow')
    expect(findings[0].severity).toBe('critical')
    expect(findings[0].message).toContain('input')
    expect(findings[0].message).toContain('eval')
  })

  /**
   * Test 5: Tracks data through function calls
   */
  it('should track data through function calls', () => {
    const code = `
      function transform(data) {
        return data.toUpperCase();
      }
      function process(input) {
        const result = transform(input);
        eval(result);
      }
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()
    const findings: Finding[] = tracker.analyze(ast as TSESTree.Program)

    // Simplified: Should detect that input reaches eval through the function call
    // Note: In real implementation, this would need inter-procedural analysis
    // For Phase 1, we may flag the potential flow
    expect(findings.length).toBeGreaterThan(0)
    const evalFinding = findings.find(f => f.message.includes('eval'))
    expect(evalFinding).toBeDefined()
  })

  /**
   * Test 6: Does NOT flag safe data (constants, literals)
   */
  it('should not flag safe constants and literals', () => {
    const code = `
      function safeFunction() {
        const CONSTANT = 'safe value';
        eval(CONSTANT);
        fetch('https://fixed-url.com');
      }
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()
    const findings: Finding[] = tracker.analyze(ast as TSESTree.Program)

    // Constants and literals should not be flagged as they are not user input
    // The CONSTANT is assigned a literal, not from a parameter
    expect(findings).toHaveLength(0)
  })

  /**
   * Test 7: Detects multiple taint flows in same function
   */
  it('should detect multiple taint flows in same function', () => {
    const code = `
      function multiThreat(userInput, filePath) {
        eval(userInput);
        fetch('https://api.com', { body: userInput });
        const fs = require('fs');
        fs.writeFile(filePath, userInput);
      }
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()
    const findings: Finding[] = tracker.analyze(ast as TSESTree.Program)

    // Should detect at least 3 flows: eval, fetch, fs.writeFile
    expect(findings.length).toBeGreaterThanOrEqual(3)

    const criticalFindings = findings.filter(f => f.severity === 'critical')
    const highFindings = findings.filter(f => f.severity === 'high')

    expect(criticalFindings.length).toBeGreaterThanOrEqual(1) // eval
    expect(highFindings.length).toBeGreaterThanOrEqual(2) // fetch + fs.writeFile
  })

  /**
   * Test 8: Detects command injection via child_process.exec
   */
  it('should detect command injection via child_process.exec', () => {
    const code = `
      const exec = require('child_process').exec;
      function runCommand(command) {
        exec(command);
      }
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()
    const findings: Finding[] = tracker.analyze(ast as TSESTree.Program)

    expect(findings).toHaveLength(1)
    expect(findings[0].ruleId).toBe('taint-data-flow')
    expect(findings[0].severity).toBe('critical')
    expect(findings[0].message).toContain('exec')
  })

  /**
   * Test 9: Handles empty code gracefully
   */
  it('should handle empty code gracefully', () => {
    const code = ``
    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()
    const findings: Finding[] = tracker.analyze(ast as TSESTree.Program)

    expect(findings).toHaveLength(0)
  })

  /**
   * Test 10: Handles code with no functions
   */
  it('should handle code with no functions', () => {
    const code = `
      const x = 42;
      console.log(x);
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()
    const findings: Finding[] = tracker.analyze(ast as TSESTree.Program)

    expect(findings).toHaveLength(0)
  })
})
