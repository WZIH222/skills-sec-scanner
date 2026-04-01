/**
 * Unit Tests for Callback Parameter Detection (Phase 3.7 Plan 11)
 *
 * TDD RED phase: Failing tests for isCallbackParameter helper
 *
 * Tests the isCallbackParameter helper method that identifies error-first
 * callback parameters (like 'err' or 'error') in Node.js callbacks.
 * These parameters should NOT be marked as taint sources because they are
 * system-generated, not user input.
 */

import { describe, it, expect } from 'vitest'
import { TSESTree } from '@typescript-eslint/typescript-estree'
import { parse } from '@typescript-eslint/parser'
import { TaintTracker } from '../../../src/analyzer/data-flow'

describe('TaintTracker - Callback Parameter Detection', () => {
  /**
   * Test 1: isCallbackParameter returns true for 'err' parameter
   * Given: Arrow function with first parameter named 'err'
   * When: isCallbackParameter is called on the 'err' parameter
   * Then: Returns true (it's an error callback parameter)
   */
  it('should return true for err parameter in arrow function', () => {
    const code = `
      fs.readFile('config.json', 'utf8', (err, data) => {
        if (err) throw err;
        console.log(data);
      });
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()

    // Find the ArrowFunctionExpression and its 'err' parameter
    let arrowFunc: TSESTree.ArrowFunctionExpression | null = null
    tracker['traverse'](ast, (node: TSESTree.Node) => {
      if (node.type === 'ArrowFunctionExpression') {
        arrowFunc = node as TSESTree.ArrowFunctionExpression
      }
    })

    expect(arrowFunc).toBeDefined()
    expect(arrowFunc!.params[0].type).toBe('Identifier')

    const errParam = arrowFunc!.params[0] as TSESTree.Identifier
    expect(errParam.name).toBe('err')

    // @ts-ignore - accessing private method for testing
    expect(tracker['isCallbackParameter'](errParam, arrowFunc, 0)).toBe(true)
  })

  /**
   * Test 2: isCallbackParameter returns true for 'error' parameter
   * Given: Function expression with first parameter named 'error'
   * When: isCallbackParameter is called on the 'error' parameter
   * Then: Returns true (it's an error callback parameter)
   */
  it('should return true for error parameter in function expression', () => {
    const code = `
      fs.readFile('config.json', 'utf8', function (error, data) {
        if (error) throw error;
        console.log(data);
      });
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()

    // Find the FunctionExpression and its 'error' parameter
    let funcExpr: TSESTree.FunctionExpression | null = null
    tracker['traverse'](ast, (node: TSESTree.Node) => {
      if (node.type === 'FunctionExpression') {
        funcExpr = node as TSESTree.FunctionExpression
      }
    })

    expect(funcExpr).toBeDefined()
    expect(funcExpr!.params[0].type).toBe('Identifier')

    const errorParam = funcExpr!.params[0] as TSESTree.Identifier
    expect(errorParam.name).toBe('error')

    // @ts-ignore - accessing private method for testing
    expect(tracker['isCallbackParameter'](errorParam, funcExpr, 0)).toBe(true)
  })

  /**
   * Test 3: isCallbackParameter returns false for 'data' parameter
   * Given: Arrow function with second parameter named 'data'
   * When: isCallbackParameter is called on the 'data' parameter
   * Then: Returns false (it's not the first error parameter)
   */
  it('should return false for data parameter (second parameter)', () => {
    const code = `
      fs.readFile('config.json', 'utf8', (err, data) => {
        console.log(data);
      });
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()

    // Find the ArrowFunctionExpression and its 'data' parameter
    let arrowFunc: TSESTree.ArrowFunctionExpression | null = null
    tracker['traverse'](ast, (node: TSESTree.Node) => {
      if (node.type === 'ArrowFunctionExpression') {
        arrowFunc = node as TSESTree.ArrowFunctionExpression
      }
    })

    expect(arrowFunc).toBeDefined()
    expect(arrowFunc!.params.length).toBeGreaterThanOrEqual(2)
    expect(arrowFunc!.params[1].type).toBe('Identifier')

    const dataParam = arrowFunc!.params[1] as TSESTree.Identifier
    expect(dataParam.name).toBe('data')

    // @ts-ignore - accessing private method for testing
    expect(tracker['isCallbackParameter'](dataParam, arrowFunc, 1)).toBe(false)
  })

  /**
   * Test 4: isCallbackParameter returns false for regular function parameters
   * Given: Function declaration with parameter 'userInput'
   * When: isCallbackParameter is called on the 'userInput' parameter
   * Then: Returns false (it's a regular function parameter, not a callback)
   */
  it('should return false for regular function parameters', () => {
    const code = `
      function processInput(userInput) {
        return userInput.toUpperCase();
      }
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()

    // Find the FunctionDeclaration and its 'userInput' parameter
    let funcDecl: TSESTree.FunctionDeclaration | null = null
    tracker['traverse'](ast, (node: TSESTree.Node) => {
      if (node.type === 'FunctionDeclaration') {
        funcDecl = node as TSESTree.FunctionDeclaration
      }
    })

    expect(funcDecl).toBeDefined()
    expect(funcDecl!.params[0].type).toBe('Identifier')

    const userInputParam = funcDecl!.params[0] as TSESTree.Identifier
    expect(userInputParam.name).toBe('userInput')

    // @ts-ignore - accessing private method for testing
    expect(tracker['isCallbackParameter'](userInputParam, funcDecl, 0)).toBe(false)
  })

  /**
   * Test 5: isCallbackParameter checks if parameter is first in callback function
   * Given: Arrow function with 'err' as first parameter (index 0)
   * When: isCallbackParameter is called on the 'err' parameter
   * Then: Returns true (it's the first parameter in callback)
   */
  it('should check if parameter is first in callback function (index 0)', () => {
    const code = `
      fs.readFile('config.json', 'utf8', (err, data) => {
        console.log(data);
      });
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()

    // Find the ArrowFunctionExpression
    let arrowFunc: TSESTree.ArrowFunctionExpression | null = null
    tracker['traverse'](ast, (node: TSESTree.Node) => {
      if (node.type === 'ArrowFunctionExpression') {
        arrowFunc = node as TSESTree.ArrowFunctionExpression
      }
    })

    expect(arrowFunc).toBeDefined()
    expect(arrowFunc!.params).toBeDefined()
    expect(arrowFunc!.params.length).toBeGreaterThan(0)

    // Check that 'err' is the first parameter (index 0)
    const firstParam = arrowFunc!.params[0]
    expect(firstParam.type).toBe('Identifier')
    expect((firstParam as TSESTree.Identifier).name).toBe('err')

    // Verify isCallbackParameter returns true for first parameter
    // @ts-ignore - accessing private method for testing
    expect(tracker['isCallbackParameter'](firstParam, arrowFunc, 0)).toBe(true)
  })

  /**
   * Test 6: isCallbackParameter checks if parent function is passed as callback
   * Given: Arrow function passed as third argument to fs.readFile
   * When: isCallbackParameter is called on the 'err' parameter
   * Then: Returns true (parent function is a callback argument)
   */
  it('should check if parent function is passed as callback argument', () => {
    const code = `
      fs.readFile('config.json', 'utf8', (err, data) => {
        if (err) throw err;
        console.log(data);
      });
    `

    const ast = parse(code, { sourceType: 'module', range: true, loc: true })
    const tracker = new TaintTracker()

    // Find CallExpression (fs.readFile)
    let callExpr: TSESTree.CallExpression | null = null
    tracker['traverse'](ast, (node: TSESTree.Node) => {
      if (node.type === 'CallExpression') {
        const call = node as TSESTree.CallExpression
        if (call.callee.type === 'MemberExpression') {
          const member = call.callee as TSESTree.MemberExpression
          if (member.property.type === 'Identifier' && member.property.name === 'readFile') {
            callExpr = call
          }
        }
      }
    })

    expect(callExpr).toBeDefined()
    expect(callExpr!.arguments.length).toBeGreaterThanOrEqual(3)

    // Third argument should be the callback (ArrowFunctionExpression)
    const thirdArg = callExpr!.arguments[2]
    expect(thirdArg.type).toBe('ArrowFunctionExpression')

    // First parameter of callback should be 'err'
    const callback = thirdArg as TSESTree.ArrowFunctionExpression
    expect(callback.params[0].type).toBe('Identifier')
    expect((callback.params[0] as TSESTree.Identifier).name).toBe('err')

    // Verify isCallbackParameter returns true
    // @ts-ignore - accessing private method for testing
    expect(tracker['isCallbackParameter'](callback.params[0], callback, 0)).toBe(true)
  })
})
