/**
 * AST Pattern Matcher
 *
 * Matches AST nodes against security pattern rules to detect
 * suspicious code patterns like eval(), exec(), fetch(), fs operations.
 */

import { TSESTree } from '@typescript-eslint/typescript-estree'
import { Finding, Severity } from '../types'

/**
 * Pattern matching shape — a recursive tagged union of AST node patterns
 */
export type PatternPattern =
  | { type: 'CallExpression'; callee?: PatternPattern; arguments?: PatternPattern[] }
  | { type: 'MemberExpression'; object?: PatternPattern | string; property?: PatternPattern | string }
  | { type: 'Literal'; value?: unknown; prefix?: string }
  | { type: 'Identifier'; name: string }
  | { type: 'AssignmentExpression'; left?: PatternPattern; right?: PatternPattern }
  | { type: 'ObjectExpression'; properties: PatternPattern[] }
  | { type: 'Property'; key: PatternPattern }
  | { type: 'IdentifierShorthand'; name: string }

/**
 * Pattern rule for AST matching
 */
export interface PatternRule {
  id: string
  severity: Severity
  category: string
  pattern: PatternPattern
  message: string
}

/**
 * AST Pattern Matcher
 *
 * Traverses the AST and matches nodes against pattern rules
 * to generate security findings.
 */
export class PatternMatcher {
  private sourceCode?: string

  constructor(private rules: PatternRule[], sourceCode?: string) {
    this.sourceCode = sourceCode
  }

  /**
   * Find all pattern matches in the AST
   *
   * @param ast - The AST to analyze
   * @returns Array of findings
   */
  findMatches(ast: TSESTree.Program): Finding[] {
    const findings: Finding[] = []

    // DEBUG: Log rule count
    if (process.env.DEBUG_PATTERN_MATCHER === 'true') {
      console.log(`[PatternMatcher] Checking ${this.rules.length} rules`)
      console.log(`[PatternMatcher] Rule IDs:`, this.rules.map(r => r.id))
    }

    // Traverse the AST
    this.traverse(ast, (node) => {
      // Check each rule against this node
      for (const rule of this.rules) {
        if (this.matchesPattern(node, rule.pattern)) {
          if (process.env.DEBUG_PATTERN_MATCHER === 'true') {
            console.log(`[PatternMatcher] Matched rule ${rule.id} for node type ${node.type}`)
          }
          findings.push({
            ruleId: rule.id,
            severity: rule.severity,
            message: rule.message,
            location: this.extractLocation(node),
            code: this.extractCodeSnippet(node, ast),
          })
        }
      }
    })

    return findings
  }

  /**
   * Traverse AST recursively and visit each node
   */
  private traverse(node: TSESTree.Node, visitor: (node: TSESTree.Node) => void): void {
    // DEBUG: Log VariableDeclarator.init visits
    if (process.env.DEBUG_PATTERN_MATCHER === 'true' && node.type === 'VariableDeclarator') {
      console.log(`[PatternMatcher] Visiting VariableDeclarator node`)
      const declarator = node as any
      if (declarator.init) {
        console.log(`[PatternMatcher] VariableDeclarator.init type: ${declarator.init.type}`)
        if (declarator.init.type === 'Literal' && declarator.init.value) {
          console.log(`[PatternMatcher] VariableDeclarator.init.value: ${declarator.init.value}`)
        }
      }
    }

    visitor(node)

    // Get visitor keys from typescript-estree
    const visitorKeys = (node as any).visitorKeys || this.getDefaultVisitorKeys(node.type)

    for (const key of visitorKeys) {
      const child = (node as any)[key]

      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === 'object' && item.type) {
            this.traverse(item, visitor)
          }
        }
      } else if (child && typeof child === 'object' && child.type) {
        this.traverse(child, visitor)
      }
    }
  }

  /**
   * Get default visitor keys for a node type
   * This is a simplified version of the full visitor keys
   */
  private getDefaultVisitorKeys(nodeType: string): string[] {
    const keyMap: Record<string, string[]> = {
      Program: ['body'],
      ExpressionStatement: ['expression'],
      AssignmentExpression: ['left', 'right'],
      CallExpression: ['callee', 'arguments'],
      MemberExpression: ['object', 'property'],
      Identifier: [],
      Literal: [],
      VariableDeclaration: ['declarations'],
      VariableDeclarator: ['id', 'init'],
      FunctionDeclaration: ['id', 'params', 'body'],
      BlockStatement: ['body'],
      ReturnStatement: ['argument'],
      IfStatement: ['test', 'consequent', 'alternate'],
      ForStatement: ['init', 'test', 'update', 'body'],
      WhileStatement: ['test', 'body'],
    }

    return keyMap[nodeType] || []
  }

  /**
   * Check if a node matches a pattern
   */
  private matchesPattern(node: TSESTree.Node, pattern: PatternPattern): boolean {
    if (!pattern) {
      return false
    }

    // Identifier shorthand pattern (e.g., { name: 'eval' } matches any Identifier named 'eval')
    if (pattern.type === 'IdentifierShorthand') {
      if (node.type === 'Identifier') {
        const identifier = node as TSESTree.Identifier
        return identifier.name === pattern.name
      }
      return false
    }

    if (!pattern.type) {
      return false
    }

    // Check node type
    if (node.type !== pattern.type) {
      return false
    }

    // For CallExpression, check callee and arguments
    if (pattern.type === 'CallExpression') {
      return this.matchesCallExpression(node as TSESTree.CallExpression, pattern)
    }

    // For AssignmentExpression, check left and right
    if (pattern.type === 'AssignmentExpression') {
      return this.matchesAssignmentExpression(node as TSESTree.AssignmentExpression, pattern)
    }

    // For MemberExpression, check object and property
    if (pattern.type === 'MemberExpression' && (pattern.object || pattern.property)) {
      return this.matchesMemberExpression(node as TSESTree.MemberExpression, pattern)
    }

    // For Identifier, check name
    if (pattern.type === 'Identifier') {
      if (node.type === 'Identifier') {
        const identifier = node as TSESTree.Identifier
        return identifier.name === pattern.name
      }
      return false
    }

    // For Literal, check prefix and value
    if (pattern.type === 'Literal') {
      const literal = node as TSESTree.Literal

      // Check prefix if specified
      if (pattern.prefix && literal.value != null) {
        const valueStr = literal.value.toString()
        if (!valueStr.startsWith(pattern.prefix)) {
          return false
        }
      }

      // Check exact value if specified
      if (pattern.value !== undefined) {
        return literal.value === pattern.value
      }

      // Default: match any Literal if no prefix or value specified
      return true
    }

    // For ObjectExpression, check properties
    if (pattern.type === 'ObjectExpression' && pattern.properties) {
      return this.matchesObjectExpression(node as TSESTree.ObjectExpression, pattern.properties)
    }

    // For Property, check key
    if (pattern.type === 'Property' && pattern.key) {
      return this.matchesProperty(node as TSESTree.Property, pattern.key)
    }

    // DEBUG: Log unexpected pattern matches
    if (process.env.DEBUG_PATTERN_MATCHER === 'true') {
      console.log(`[matchesPattern] Unexpected match: node.type=${node.type}, pattern.type=${pattern.type}`)
    }

    return true
  }

  /**
   * Match AssignmentExpression (left and right)
   */
  private matchesAssignmentExpression(node: TSESTree.AssignmentExpression, pattern: PatternPattern): boolean {
    if (pattern.type !== 'AssignmentExpression') return false
    // Check left if specified
    if (pattern.left) {
      const left = node.left

      // Check left.type
      if (pattern.left.type && left.type !== pattern.left.type) {
        return false
      }

      // For MemberExpression left, check object and property
      if (left.type === 'MemberExpression' && pattern.left.type === 'MemberExpression') {
        if (!this.matchesMemberExpression(left, pattern.left)) {
          return false
        }
      }
    }

    // Note: We don't check right in this implementation
    // Future enhancement could add right-side pattern matching

    return true
  }

  /**
   * Match CallExpression (callee and arguments)
   */
  private matchesCallExpression(node: TSESTree.CallExpression, pattern: PatternPattern): boolean {
    if (pattern.type !== 'CallExpression') return false
    // Check callee if specified
    if (pattern.callee) {
      const callee = node.callee

      // Simple identifier match (e.g., eval, fetch)
      if (callee.type === 'Identifier' && pattern.callee.type === 'Identifier') {
        if (callee.name !== pattern.callee.name) {
          return false
        }
      }
      // MemberExpression match (e.g., fs.writeFile, process.env)
      else if (callee.type === 'MemberExpression' && pattern.callee.type === 'MemberExpression') {
        if (!this.matchesMemberExpression(callee, pattern.callee)) {
          return false
        }
      } else {
        return false
      }
    }

    // Check arguments if specified
    if (pattern.arguments && Array.isArray(pattern.arguments)) {
      const args = node.arguments

      for (let i = 0; i < pattern.arguments.length; i++) {
        const argPattern = pattern.arguments[i]

        // If pattern is empty object {}, match any argument
        if (Object.keys(argPattern).length === 0) {
          continue
        }

        // If index is out of bounds, no match
        if (i >= args.length) {
          return false
        }

        // DEBUG: Log argument matching
        if (process.env.DEBUG_PATTERN_MATCHER === 'true') {
          console.log(`[matchesCallExpression] Checking arg ${i}: node.type=${args[i].type}, pattern.type=${argPattern.type}`)
        }

        // Match argument pattern
        if (!this.matchesPattern(args[i], argPattern)) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Match MemberExpression
   */
  private matchesMemberExpression(node: TSESTree.MemberExpression, pattern: PatternPattern): boolean {
    if (pattern.type !== 'MemberExpression') return false
    const computed = node.computed

    // Check object
    if (pattern.object !== undefined) {
      if (typeof pattern.object === 'string') {
        if (node.object.type === 'Identifier' && node.object.name !== pattern.object) {
          return false
        }
      } else if (typeof pattern.object === 'object' && pattern.object !== null) {
        if (!this.matchesPattern(node.object, pattern.object)) {
          return false
        }
      }
    }

    // Check property
    if (pattern.property !== undefined) {
      if (typeof pattern.property === 'string') {
        if (node.property.type === 'Identifier' && node.property.name !== pattern.property) {
          return false
        }
      } else if (typeof pattern.property === 'object' && pattern.property !== null) {
        if (!this.matchesPattern(node.property, pattern.property)) {
          return false
        }
      }
    }

    return true
  }

  /**
   * Match ObjectExpression (check if any property matches pattern)
   */
  private matchesObjectExpression(node: TSESTree.ObjectExpression, patternProperties: PatternPattern[]): boolean {
    // If pattern specifies properties, check if ANY property matches
    for (const propPattern of patternProperties) {
      for (const prop of node.properties) {
        if (this.matchesPattern(prop as TSESTree.Node, propPattern)) {
          return true // Found a matching property
        }
      }
    }
    return patternProperties.length === 0 // Empty pattern matches any ObjectExpression
  }

  /**
   * Match Property (check key)
   */
  private matchesProperty(node: TSESTree.Property, keyPattern: PatternPattern): boolean {
    if (!node.key) {
      return false
    }

    return this.matchesPattern(node.key, keyPattern)
  }

  /**
   * Extract location from AST node
   */
  private extractLocation(node: TSESTree.Node) {
    if (!node.loc) {
      return { line: 0, column: 0 }
    }

    return {
      line: node.loc.start.line,
      column: node.loc.start.column,
    }
  }

  /**
   * Extract code snippet from AST node
   */
  private extractCodeSnippet(node: TSESTree.Node, ast: TSESTree.Program): string | undefined {
    if (!node.loc || !node.range || !this.sourceCode) {
      return undefined
    }

    // Extract the actual code from source using range
    const [start, end] = node.range
    const code = this.sourceCode.substring(start, end)

    // Limit snippet length
    const maxLength = 100
    if (code.length > maxLength) {
      return code.substring(0, maxLength) + '...'
    }

    return code
  }
}
