/**
 * TypeScript/JavaScript AST Parser
 *
 * Uses @typescript-eslint/parser to generate AST with full type information
 * and source location tracking for security analysis.
 */

import { parse } from '@typescript-eslint/parser'
import { TSESTree } from '@typescript-eslint/typescript-estree'
import { IParseResult, ParseError, ParseMetadata } from '../types'

/**
 * Parser options for TypeScript/JavaScript parsing
 */
export interface ParserOptions {
  sourceType?: 'module' | 'script'
  ecmaVersion?: 'latest' | number
  jsx?: boolean
}

/**
 * Unified parser interface for all file types
 */
export interface IParser {
  supports(filename: string): boolean
  parse(content: string, filename?: string): Promise<IParseResult>
}

/**
 * TypeScript/JavaScript AST parser
 *
 * Parses TypeScript and JavaScript files into ESTree AST format
 * with metadata about the source code and detected dependencies.
 */
export class TypeScriptParser implements IParser {
  private options: ParserOptions

  constructor(options: ParserOptions = {}) {
    this.options = {
      sourceType: options.sourceType ?? 'module',
      ecmaVersion: options.ecmaVersion ?? 'latest',
      jsx: options.jsx ?? true,
    }
  }

  /**
   * Check if this parser supports the given file
   */
  supports(filename: string): boolean {
    return /\.(ts|tsx|js|jsx)$/.test(filename)
  }

  /**
   * Parse TypeScript/JavaScript code to AST
   *
   * @param content - Source code to parse
   * @param filename - Optional filename for language detection
   * @returns Parse result with AST, metadata, errors, and dependencies
   */
  async parse(content: string, filename?: string): Promise<IParseResult> {
    const errors: ParseError[] = []
    const dependencies: string[] = []

    // Detect source type from content if not specified
    const sourceType = this.detectSourceType(content, filename)

    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        sourceType,
        jsx: this.options.jsx,
      })

      // Extract dependencies from AST
      const extractedDeps = this.extractDependencies(ast)
      dependencies.push(...extractedDeps)

      // Determine language from filename
      const language = this.detectLanguage(filename)

      const metadata: ParseMetadata = {
        language,
      }

      return {
        ast,
        metadata,
        errors,
        dependencies,
      }
    } catch (error) {
      // Handle parse errors - return partial result with errors
      const parseError: ParseError = {
        message: error instanceof Error ? error.message : 'Unknown parse error',
      }

      if (error instanceof Error && 'lineNumber' in error) {
        parseError.line = (error as any).lineNumber
        parseError.column = (error as any).column
      }

      errors.push(parseError)

      return {
        ast: null,
        metadata: {
          language: this.detectLanguage(filename),
        },
        errors,
        dependencies,
      }
    }
  }

  /**
   * Detect source type (module vs script) from content
   */
  private detectSourceType(content: string, filename?: string): 'module' | 'script' {
    // Check for import/export keywords
    const hasImportExport = /\b(import|export)\b/.test(content)

    // Check for CommonJS patterns
    const hasCommonJS = /\b(require|module\.exports|__dirname|__filename)\b/.test(content)

    if (hasImportExport) {
      return 'module'
    }

    if (hasCommonJS) {
      return 'script'
    }

    // Default to module for .ts/.tsx files
    if (filename && /\.(ts|tsx)$/.test(filename)) {
      return 'module'
    }

    return this.options.sourceType ?? 'module'
  }

  /**
   * Detect language from filename
   */
  private detectLanguage(filename?: string): string {
    if (!filename) {
      return 'javascript'
    }

    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) {
      return 'typescript'
    }

    return 'javascript'
  }

  /**
   * Extract dependencies from AST
   * Finds both ES6 imports and CommonJS requires
   */
  private extractDependencies(ast: TSESTree.Program): string[] {
    const dependencies = new Set<string>()

    // Walk through the AST body
    for (const node of ast.body) {
      // ES6 import statements
      if (node.type === 'ImportDeclaration') {
        const importDecl = node as TSESTree.ImportDeclaration
        if (importDecl.source && typeof importDecl.source.value === 'string') {
          dependencies.add(importDecl.source.value)
        }
      }

      // ES6 export from statements
      if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
        const exportDecl = node as TSESTree.ExportNamedDeclaration | TSESTree.ExportAllDeclaration
        if ('source' in exportDecl && exportDecl.source && typeof exportDecl.source.value === 'string') {
          dependencies.add(exportDecl.source.value)
        }
      }

      // CommonJS require calls
      if (node.type === 'VariableDeclaration') {
        this.extractRequiresFromVariableDeclaration(node as TSESTree.VariableDeclaration, dependencies)
      }

      // CommonJS module.exports
      if (node.type === 'ExpressionStatement') {
        this.extractRequiresFromExpressionStatement(node as TSESTree.ExpressionStatement, dependencies)
      }
    }

    return Array.from(dependencies)
  }

  /**
   * Extract require() calls from variable declarations
   */
  private extractRequiresFromVariableDeclaration(
    node: TSESTree.VariableDeclaration,
    dependencies: Set<string>
  ): void {
    for (const declarator of node.declarations) {
      if (declarator.init) {
        this.extractRequiresFromExpression(declarator.init, dependencies)
      }
    }
  }

  /**
   * Extract require() calls from expression statements
   */
  private extractRequiresFromExpressionStatement(
    node: TSESTree.ExpressionStatement,
    dependencies: Set<string>
  ): void {
    this.extractRequiresFromExpression(node.expression, dependencies)
  }

  /**
   * Extract require() calls from an expression
   */
  private extractRequiresFromExpression(expr: TSESTree.Expression, dependencies: Set<string>): void {
    // Check for require('module') pattern
    if (expr.type === 'CallExpression') {
      const callExpr = expr as TSESTree.CallExpression

      if (
        callExpr.callee.type === 'Identifier' &&
        callExpr.callee.name === 'require' &&
        callExpr.arguments.length > 0
      ) {
        const arg = callExpr.arguments[0]
        if (arg.type === 'Literal' && typeof arg.value === 'string') {
          dependencies.add(arg.value)
        }
      }
    }
  }
}
