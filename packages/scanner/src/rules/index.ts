/**
 * Rules module exports
 *
 * Provides rule schema validation and loading functionality
 */

export { RuleSchema, validateRule, type Rule, type ValidationResult } from './schema'
export { RuleLoader, type RuleConfig } from './loader'
export { RuleSeeder, type SeederResult } from './seeder'

// Default rules directory path
export const DEFAULT_RULES_DIR = './src/rules/core'
