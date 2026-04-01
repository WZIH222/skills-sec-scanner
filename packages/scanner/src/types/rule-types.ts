/**
 * Rule Type Definitions
 *
 * Unified types for both built-in rules (from JSON files) and
 * custom user rules (from database). The isBuiltIn flag distinguishes
 * the source of each rule.
 */

import { z } from 'zod'

/**
 * Severity levels for security findings
 */
export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info'])
export type Severity = z.infer<typeof SeveritySchema>

/**
 * Threat categories for detection rules
 */
export const CategorySchema = z.enum([
  'injection',
  'file-access',
  'credentials',
  'network',
  'prototype-pollution',
  'dom-xss',
  'deserialization',
  'path-traversal',
])
export type Category = z.infer<typeof CategorySchema>

/**
 * Callee pattern for matching function calls (from rules/schema.ts)
 */
const CalleePatternSchema = z.object({
  type: z.enum(['Identifier', 'MemberExpression']),
  name: z.string().optional(),
  object: z.string().optional(),
  property: z.string().optional(),
})

/**
 * Pattern for AST node matching (from rules/schema.ts)
 */
const PatternSchema = z.object({
  type: z.enum(['CallExpression', 'MemberExpression', 'Identifier', 'Literal', 'AssignmentExpression']),
  callee: CalleePatternSchema.optional(),
  prefix: z.string().optional(),
  left: z.any().optional(),
  right: z.any().optional(),
})
export type Pattern = z.infer<typeof PatternSchema>

/**
 * Built-in rule from JSON file
 */
export interface BuiltInRule {
  id: string
  name: string
  description?: string
  severity: Severity
  category: string
  pattern: Pattern
  message: string
  enabled: boolean
  references: string[]
  isBuiltIn: true
}

/**
 * Custom user rule from database
 */
export interface CustomRule {
  id: string
  userId: string
  ruleId: string
  name: string
  description?: string
  severity: Severity
  category: string
  pattern: Pattern
  message: string
  enabled: boolean
  references: string[]
  createdAt: Date
  updatedAt: Date
  isBuiltIn: false
  isAIGenerated?: boolean
}

/**
 * Unified rule view combining built-in and custom rules
 * The isBuiltIn flag indicates the source
 */
export type UnifiedRule = BuiltInRule | CustomRule

/**
 * Filters for querying rules
 */
export interface RuleFilters {
  severity?: Severity | string
  category?: string
  enabled?: boolean // undefined = all, true = enabled only, false = disabled only
  isBuiltIn?: boolean // undefined = all
}

/**
 * Result of importing rules from JSON
 */
export interface ImportResult {
  imported: number
  updated: number
  errors: string[]
}

/**
 * Data for creating a new custom rule
 */
export interface CreateRuleData {
  ruleId: string
  name: string
  description?: string
  severity: Severity
  category: string
  pattern: Pattern
  message: string
  enabled?: boolean
  references?: string[]
  isAIGenerated?: boolean
}

/**
 * Data for updating an existing custom rule
 */
export interface UpdateRuleData {
  name?: string
  description?: string
  severity?: Severity
  category?: string
  pattern?: Pattern
  message?: string
  enabled?: boolean
  references?: string[]
}

/**
 * Parse references from JSON string (stored in UserRule.references)
 *
 * @param referencesJson - JSON string of reference URLs
 * @returns Array of URL strings
 */
export function parseReferences(referencesJson: string): string[] {
  try {
    const parsed = JSON.parse(referencesJson)
    if (Array.isArray(parsed)) {
      return parsed.filter((ref): ref is string => typeof ref === 'string')
    }
    return []
  } catch {
    return []
  }
}

/**
 * Stringify references array for storage in UserRule.references
 *
 * @param references - Array of URL strings
 * @returns JSON string for database storage
 */
export function stringifyReferences(references: string[]): string {
  return JSON.stringify(references || [])
}

/**
 * Validate severity value
 */
export function isValidSeverity(value: string): value is Severity {
  return SeveritySchema.safeParse(value).success
}

/**
 * Validate category value
 */
export function isValidCategory(value: string): boolean {
  return CategorySchema.safeParse(value).success
}
