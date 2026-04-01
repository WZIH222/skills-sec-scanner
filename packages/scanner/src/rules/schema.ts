/**
 * Rule Schema Validation
 *
 * Zod schema for validating detection rule JSON files
 */

import { z } from 'zod'

/**
 * Severity levels for security findings
 */
export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info'])

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

/**
 * Recursive AST node schema for nested callee expressions.
 * Supports both flat strings (Identifier names) and nested AST objects
 * (e.g., MemberExpression with nested Identifier/object/property).
 */
const ASTNodeSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.object({
    type: z.string(),
    name: z.string().optional(),
    value: z.string().optional(),
    raw: z.string().optional(),
    object: z.union([z.string(), ASTNodeSchema]).optional(),
    property: z.union([z.string(), ASTNodeSchema]).optional(),
    callee: z.union([z.string(), ASTNodeSchema]).optional(),
    arguments: z.array(ASTNodeSchema).optional(),
    left: z.union([z.string(), ASTNodeSchema]).optional(),
    right: z.union([z.string(), ASTNodeSchema]).optional(),
    elements: z.array(ASTNodeSchema).optional(),
    properties: z.array(ASTNodeSchema).optional(),
    init: z.union([z.string(), ASTNodeSchema]).optional(),
    test: z.union([z.string(), ASTNodeSchema]).optional(),
    consequent: z.union([z.string(), ASTNodeSchema]).optional(),
    alternate: z.union([z.string(), ASTNodeSchema]).optional(),
    expression: z.union([z.string(), ASTNodeSchema]).optional(),
    body: z.union([z.string(), ASTNodeSchema, z.array(ASTNodeSchema)]).optional(),
    param: z.union([z.string(), ASTNodeSchema]).optional(),
    params: z.array(z.union([z.string(), ASTNodeSchema])).optional(),
    // Allow additional properties for other AST node types
  }).catchall(z.unknown())
)

/**
 * Callee pattern for matching function calls.
 * Supports flat strings for Identifier names and nested objects for MemberExpression.
 */
const CalleePatternSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.object({
    type: z.string(),
    name: z.string().optional(),
    object: z.union([z.string(), CalleePatternSchema, z.record(z.unknown())]).optional(),
    property: z.union([z.string(), CalleePatternSchema, z.record(z.unknown())]).optional(),
    callee: z.union([z.string(), CalleePatternSchema, z.record(z.unknown())]).optional(),
    arguments: z.array(ASTNodeSchema).optional(),
    // Allow additional properties
  }).catchall(z.unknown())
)

/**
 * Pattern for AST node matching
 */
const PatternSchema: z.ZodType<Record<string, unknown>> = z.lazy(() =>
  z.object({
    type: z.string(),
    callee: z.union([z.string(), CalleePatternSchema, z.record(z.unknown())]).optional(),
    prefix: z.string().optional(),
    left: z.union([z.string(), PatternSchema, z.record(z.unknown())]).optional(),
    right: z.union([z.string(), PatternSchema, z.record(z.unknown())]).optional(),
    object: z.union([z.string(), PatternSchema, z.record(z.unknown())]).optional(),
    property: z.union([z.string(), PatternSchema, z.record(z.unknown())]).optional(),
    value: z.string().optional(),
    raw: z.string().optional(),
    name: z.string().optional(),
    arguments: z.array(ASTNodeSchema).optional(),
    elements: z.array(ASTNodeSchema).optional(),
    properties: z.array(ASTNodeSchema).optional(),
    init: z.union([z.string(), PatternSchema, z.record(z.unknown())]).optional(),
    test: z.union([z.string(), PatternSchema, z.record(z.unknown())]).optional(),
    consequent: z.union([z.string(), PatternSchema, z.record(z.unknown())]).optional(),
    alternate: z.union([z.string(), PatternSchema, z.record(z.unknown())]).optional(),
    expression: z.union([z.string(), PatternSchema, z.record(z.unknown())]).optional(),
    body: z.union([z.string(), PatternSchema, z.record(z.unknown()), z.array(ASTNodeSchema)]).optional(),
    param: z.union([z.string(), PatternSchema, z.record(z.unknown())]).optional(),
    params: z.array(z.union([z.string(), PatternSchema, z.record(z.unknown())])).optional(),
    // Allow additional properties for other AST node types
  }).catchall(z.unknown())
)

/**
 * Detection rule schema
 */
export const RuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  severity: SeveritySchema,
  category: CategorySchema,
  enabled: z.boolean().default(true),
  pattern: z.record(z.string(), z.unknown()),
  message: z.string().min(1),
  references: z.array(z.string().url()).optional(),
})

/**
 * Type inferred from RuleSchema
 */
export type Rule = z.infer<typeof RuleSchema>

/**
 * Result type for validation
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: z.ZodError }

/**
 * Validate a rule object against the schema
 *
 * @param data - Unknown data to validate
 * @returns Validation result with data or error
 */
export function validateRule(data: unknown): ValidationResult<Rule> {
  const result = RuleSchema.safeParse(data)

  if (result.success) {
    return {
      success: true,
      data: result.data,
    }
  }

  return {
    success: false,
    error: result.error,
  }
}
