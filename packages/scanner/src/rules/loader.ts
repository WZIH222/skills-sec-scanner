/**
 * Rule Loader
 *
 * Loads detection rules from JSON files with validation
 * and applies configuration overrides
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { Rule, validateRule } from './schema'
import { PatternRule } from '../analyzer/pattern-matcher'
import { Severity } from '../types'

/**
 * Rule configuration options
 */
export interface RuleConfig {
  disabledRules?: string[]
  severityOverrides?: Record<string, Severity>
}

/**
 * Rule Loader
 *
 * Loads and validates detection rules from JSON files
 */
export class RuleLoader {
  constructor(private config?: RuleConfig) {}

  /**
   * Load all rules from a directory
   *
   * @param ruleDir - Directory containing rule JSON files
   * @returns Array of pattern rules compatible with PatternMatcher
   */
  async loadRules(ruleDir: string): Promise<PatternRule[]> {
    const rules: PatternRule[] = []

    try {
      // Read all JSON files in the directory
      const files = await fs.readdir(ruleDir)
      const jsonFiles = files.filter(file => file.endsWith('.json'))

      for (const file of jsonFiles) {
        const filePath = join(ruleDir, file)

        try {
          // Read and parse the JSON file
          const content = await fs.readFile(filePath, 'utf-8')
          const jsonData = JSON.parse(content)

          // Validate against schema
          const validationResult = validateRule(jsonData)

          if (!validationResult.success) {
            throw new Error(
              `Invalid rule schema in ${file}: ${validationResult.error.errors.map(e => e.message).join(', ')}`
            )
          }

          const rule = validationResult.data

          // Check if rule is disabled
          if (this.config?.disabledRules?.includes(rule.id)) {
            continue
          }

          // Apply severity override if configured
          const severity =
            this.config?.severityOverrides?.[rule.id] || rule.severity

          // Convert Rule to PatternRule
          const patternRule: PatternRule = {
            id: rule.id,
            severity,
            category: rule.category,
            pattern: rule.pattern,
            message: rule.message,
          }

          rules.push(patternRule)
        } catch (error) {
          // Re-throw with more context
          if (error instanceof Error) {
            throw new Error(`Failed to load rule from ${file}: ${error.message}`)
          }
          throw error
        }
      }

      return rules
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`Rule directory not found: ${ruleDir}`)
      }
      throw error
    }
  }
}
