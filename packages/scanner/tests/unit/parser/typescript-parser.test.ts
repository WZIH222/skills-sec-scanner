/**
 * Tests for TypeScript/JavaScript AST parser
 *
 * TDD RED phase: Failing tests for parser functionality
 */

import { describe, it, expect } from 'vitest'
import { TypeScriptParser } from '../../../src/parser/typescript-parser'
import { IParseResult } from '../../../src/types'

describe('TypeScriptParser', () => {
  describe('parse()', () => {
    it('should parse valid TypeScript code to AST with correct metadata', async () => {
      const parser = new TypeScriptParser()
      const code = `
        interface User {
          name: string
          age: number
        }

        function greet(user: User): string {
          return \`Hello, \${user.name}\`
        }
      `

      const result: IParseResult = await parser.parse(code, 'test.ts')

      expect(result).toBeDefined()
      expect(result.ast).toBeDefined()
      expect(result.metadata).toBeDefined()
      expect(result.metadata.language).toBe('typescript')
      expect(result.errors).toHaveLength(0)
      expect(result.dependencies).toEqual([])
    })

    it('should parse JavaScript code (CommonJS) with correct sourceType', async () => {
      const parser = new TypeScriptParser()
      const code = `
        const fs = require('fs')
        const path = require('path')

        function readFile(filePath) {
          return fs.readFileSync(filePath, 'utf8')
        }

        module.exports = { readFile }
      `

      const result: IParseResult = await parser.parse(code, 'test.js')

      expect(result).toBeDefined()
      expect(result.ast).toBeDefined()
      expect(result.metadata.language).toBe('javascript')
      expect(result.dependencies).toContain('fs')
      expect(result.dependencies).toContain('path')
    })

    it('should capture parse errors without throwing (partial parsing)', async () => {
      const parser = new TypeScriptParser()
      const invalidCode = `
        function broken() {
          const x = ;
          return x
        }
      `

      const result: IParseResult = await parser.parse(invalidCode, 'broken.ts')

      expect(result).toBeDefined()
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0].message).toBeDefined()
    })

    it('should extract import statements into dependencies array', async () => {
      const parser = new TypeScriptParser()
      const code = `
        import { readFile } from 'fs'
        import express from 'express'
        import * as path from 'path'

        const app = express()
      `

      const result: IParseResult = await parser.parse(code, 'test.ts')

      expect(result.dependencies).toContain('fs')
      expect(result.dependencies).toContain('express')
      expect(result.dependencies).toContain('path')
    })

    it('should preserve source location (line, column) in AST', async () => {
      const parser = new TypeScriptParser()
      const code = `
        function test() {
          const x = 42
          return x
        }
      `

      const result: IParseResult = await parser.parse(code, 'test.ts')

      // Verify AST has loc information
      const ast = result.ast as any
      expect(ast).toBeDefined()
      expect(ast.loc).toBeDefined()
    })
  })

  describe('supports()', () => {
    it('should return true for .ts files', () => {
      const parser = new TypeScriptParser()
      expect(parser.supports('test.ts')).toBe(true)
      expect(parser.supports('component.tsx')).toBe(true)
    })

    it('should return true for .js files', () => {
      const parser = new TypeScriptParser()
      expect(parser.supports('test.js')).toBe(true)
      expect(parser.supports('component.jsx')).toBe(true)
    })

    it('should return false for non-JS/TS files', () => {
      const parser = new TypeScriptParser()
      expect(parser.supports('test.json')).toBe(false)
      expect(parser.supports('test.py')).toBe(false)
      expect(parser.supports('test.txt')).toBe(false)
    })
  })
})
