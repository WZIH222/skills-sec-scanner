/**
 * Rule Repository
 *
 * Handles database queries for user rules and loads built-in rules.
 * Provides unified rule access combining built-in JSON rules with
 * custom user rules from the database.
 */

import type { PrismaClient, UserRule } from '@prisma/client'
import { RuleLoader } from '../rules/loader'
import { validateRule } from '../rules/schema'
import {
  type UnifiedRule,
  type RuleFilters,
  type CreateRuleData,
  type UpdateRuleData,
  type ImportResult,
  parseReferences,
  stringifyReferences,
  type BuiltInRule,
} from '../types/rule-types'

// NOTE: BUILT_IN_RULES_DIR is no longer used for loading built-in rules.
// Built-in rules are now loaded from the database via prisma.rule.findMany()
// The JSON files in packages/scanner/src/rules/core/ remain as seed/backup data.

/**
 * RuleRepository handles rule database queries and built-in rule loading
 *
 * Provides unified access to both built-in rules (from JSON files) and
 * custom user rules (from database). The isBuiltIn flag distinguishes
 * the source of each rule.
 */
export class RuleRepository {
  private ruleLoader: RuleLoader
  private builtInRulesCache: BuiltInRule[] | null = null

  constructor(
    private prisma: PrismaClient,
    private builtInRulesPath?: string
  ) {
    this.ruleLoader = new RuleLoader()
  }

  /**
   * Get all rules for a user, combining built-in and custom rules
   *
   * @param userId - User ID to fetch rules for
   * @param filters - Optional filters for severity, category, enabled, isBuiltIn
   * @returns UnifiedRule[] with isBuiltIn flag set appropriately
   */
  async getRulesForUser(userId: string, filters?: RuleFilters): Promise<UnifiedRule[]> {
    // Load built-in rules and user custom rules in parallel
    const [builtInRules, userRules] = await Promise.all([
      this.loadBuiltInRules(),
      this.prisma.userRule.findMany({
        where: { userId },
      }),
    ])

    // Convert user rules to UnifiedRule format
    const customRules: UnifiedRule[] = (userRules as UserRule[]).map((rule: UserRule) => ({
      id: rule.id,
      userId: rule.userId,
      ruleId: rule.ruleId,
      name: rule.name,
      description: rule.description || undefined,
      severity: rule.severity as BuiltInRule['severity'],
      category: rule.category,
      pattern: JSON.parse(rule.pattern),
      message: rule.message,
      enabled: rule.enabled,
      references: parseReferences(rule.references),
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      isBuiltIn: false,
    }))

    // Combine and filter
    let allRules: UnifiedRule[] = [...builtInRules, ...customRules]

    // Apply filters
    if (filters) {
      allRules = allRules.filter(rule => {
        if (filters.severity !== undefined && rule.severity !== filters.severity) {
          return false
        }
        if (filters.category !== undefined && rule.category !== filters.category) {
          return false
        }
        if (filters.enabled !== undefined && rule.enabled !== filters.enabled) {
          return false
        }
        if (filters.isBuiltIn !== undefined && rule.isBuiltIn !== filters.isBuiltIn) {
          return false
        }
        return true
      })
    }

    return allRules
  }

  /**
   * Get a single rule by ID (built-in or custom)
   *
   * @param userId - User ID who owns the rule
   * @param ruleId - Rule ID to fetch (ruleId for custom, id for built-in)
   * @returns UnifiedRule or null if not found
   */
  async getRuleById(userId: string, ruleId: string): Promise<UnifiedRule | null> {
    // First check built-in rules by their id
    const builtInRules = await this.loadBuiltInRules()
    const builtInRule = builtInRules.find(r => r.id === ruleId)
    if (builtInRule) {
      return builtInRule
    }

    // Then check custom rules
    const userRule = await this.prisma.userRule.findFirst({
      where: { userId, ruleId },
    })

    if (!userRule) {
      return null
    }

    return {
      id: userRule.id,
      userId: userRule.userId,
      ruleId: userRule.ruleId,
      name: userRule.name,
      description: userRule.description || undefined,
      severity: userRule.severity as BuiltInRule['severity'],
      category: userRule.category,
      pattern: JSON.parse(userRule.pattern),
      message: userRule.message,
      enabled: userRule.enabled,
      references: parseReferences(userRule.references),
      createdAt: userRule.createdAt,
      updatedAt: userRule.updatedAt,
      isBuiltIn: false,
    }
  }

  /**
   * Create a new custom rule for a user
   *
   * @param userId - User ID creating the rule
   * @param ruleData - Rule data for the new rule
   * @returns Created UnifiedRule
   * @throws Error if ruleId already exists for user
   */
  async createRule(userId: string, ruleData: CreateRuleData): Promise<UnifiedRule> {
    // Check for duplicate ruleId for this user
    const existing = await this.prisma.userRule.findFirst({
      where: { userId, ruleId: ruleData.ruleId },
    })
    if (existing) {
      throw new Error(`Rule with ID '${ruleData.ruleId}' already exists for this user`)
    }

    // Validate the rule pattern
    const validation = validateRule({
      id: ruleData.ruleId,
      name: ruleData.name,
      severity: ruleData.severity,
      category: ruleData.category,
      enabled: ruleData.enabled ?? true,
      pattern: ruleData.pattern,
      message: ruleData.message,
      references: ruleData.references || [],
    })
    if (!validation.success) {
      throw new Error(`Invalid rule data: ${validation.error.errors.map(e => e.message).join(', ')}`)
    }

    // RULE-10: AI-generated rules must be disabled until human review
    const isAIGenerated = ruleData.isAIGenerated ?? false
    const enabled = isAIGenerated ? false : (ruleData.enabled ?? true)

    const userRule = await this.prisma.userRule.create({
      data: {
        userId,
        ruleId: ruleData.ruleId,
        name: ruleData.name,
        description: ruleData.description,
        severity: ruleData.severity,
        category: ruleData.category,
        pattern: JSON.stringify(ruleData.pattern),
        message: ruleData.message,
        enabled: enabled, // RULE-10: forced to false for AI rules
        references: stringifyReferences(ruleData.references || []),
        isAIGenerated: isAIGenerated,
      },
    })

    return {
      id: userRule.id,
      userId: userRule.userId,
      ruleId: userRule.ruleId,
      name: userRule.name,
      description: userRule.description || undefined,
      severity: userRule.severity as BuiltInRule['severity'],
      category: userRule.category,
      pattern: ruleData.pattern,
      message: userRule.message,
      enabled: userRule.enabled,
      references: ruleData.references || [],
      createdAt: userRule.createdAt,
      updatedAt: userRule.updatedAt,
      isBuiltIn: false,
      isAIGenerated: userRule.isAIGenerated,
    }
  }

  /**
   * Update an existing custom rule
   *
   * @param userId - User ID who owns the rule
   * @param ruleId - Rule ID to update
   * @param ruleData - Updated rule data
   * @returns Updated UnifiedRule
   * @throws Error if rule is built-in or not found
   */
  async updateRule(userId: string, ruleId: string, ruleData: UpdateRuleData): Promise<UnifiedRule> {
    // Find the existing rule
    const existing = await this.prisma.userRule.findFirst({
      where: { userId, ruleId },
    })
    if (!existing) {
      throw new Error(`Rule '${ruleId}' not found for this user`)
    }

    // Build update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {}
    if (ruleData.name !== undefined) updateData.name = ruleData.name
    if (ruleData.description !== undefined) updateData.description = ruleData.description
    if (ruleData.severity !== undefined) updateData.severity = ruleData.severity
    if (ruleData.category !== undefined) updateData.category = ruleData.category
    if (ruleData.pattern !== undefined) updateData.pattern = JSON.stringify(ruleData.pattern)
    if (ruleData.message !== undefined) updateData.message = ruleData.message
    if (ruleData.enabled !== undefined) updateData.enabled = ruleData.enabled
    if (ruleData.references !== undefined) updateData.references = stringifyReferences(ruleData.references)

    const updated = await this.prisma.userRule.update({
      where: { id: existing.id },
      data: updateData,
    })

    return {
      id: updated.id,
      userId: updated.userId,
      ruleId: updated.ruleId,
      name: updated.name,
      description: updated.description || undefined,
      severity: updated.severity as BuiltInRule['severity'],
      category: updated.category,
      pattern: JSON.parse(updated.pattern),
      message: updated.message,
      enabled: updated.enabled,
      references: parseReferences(updated.references),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      isBuiltIn: false,
    }
  }

  /**
   * Delete a custom rule
   *
   * @param userId - User ID who owns the rule
   * @param ruleId - Rule ID to delete
   * @throws Error if rule is built-in or not found
   */
  async deleteRule(userId: string, ruleId: string): Promise<void> {
    // Built-in rules cannot be deleted
    const builtInRules = await this.loadBuiltInRules()
    if (builtInRules.some(r => r.id === ruleId)) {
      throw new Error('Built-in rules cannot be deleted')
    }

    const existing = await this.prisma.userRule.findFirst({
      where: { userId, ruleId },
    })
    if (!existing) {
      throw new Error(`Rule '${ruleId}' not found for this user`)
    }

    await this.prisma.userRule.delete({
      where: { id: existing.id },
    })
  }

  /**
   * Toggle rule enabled status
   *
   * For custom rules, persists the change to database.
   * For built-in rules, returns the current state (no persistence needed).
   *
   * @param userId - User ID who owns the rule
   * @param ruleId - Rule ID to toggle
   * @param enabled - New enabled state
   * @returns UnifiedRule with updated enabled state
   * @throws Error if rule not found
   */
  async toggleRule(userId: string, ruleId: string, enabled: boolean): Promise<UnifiedRule> {
    // Check if it's a built-in rule first
    const builtInRules = await this.loadBuiltInRules()
    const builtInRule = builtInRules.find(r => r.id === ruleId)
    if (builtInRule) {
      // Built-in rules can't be disabled persistently - return as-is
      return { ...builtInRule, enabled }
    }

    // Custom rule - update in database
    const existing = await this.prisma.userRule.findFirst({
      where: { userId, ruleId },
    })
    if (!existing) {
      throw new Error(`Rule '${ruleId}' not found for this user`)
    }

    const updated = await this.prisma.userRule.update({
      where: { id: existing.id },
      data: { enabled },
    })

    return {
      id: updated.id,
      userId: updated.userId,
      ruleId: updated.ruleId,
      name: updated.name,
      description: updated.description || undefined,
      severity: updated.severity as BuiltInRule['severity'],
      category: updated.category,
      pattern: JSON.parse(updated.pattern),
      message: updated.message,
      enabled: updated.enabled,
      references: parseReferences(updated.references),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      isBuiltIn: false,
    }
  }

  /**
   * Export rules as JSON array
   *
   * @param userId - User ID to export rules for
   * @param ruleIds - Optional array of specific ruleIds to export (exports all if not provided)
   * @returns JSON string of rule array
   */
  async exportRules(userId: string, ruleIds?: string[]): Promise<string> {
    const rules = await this.getRulesForUser(userId)

    // Filter to custom rules only and optionally by ruleIds
    const customRules = rules.filter(r => !r.isBuiltIn)
    const toExport = ruleIds
      ? customRules.filter(r => ruleIds.includes(r.ruleId))
      : customRules

    // Format for export (exclude internal fields)
    const exportData = toExport.map(rule => ({
      id: rule.ruleId,
      name: rule.name,
      description: rule.description,
      severity: rule.severity,
      category: rule.category,
      pattern: rule.pattern,
      message: rule.message,
      enabled: rule.enabled,
      references: rule.references,
    }))

    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Import rules from JSON array
   *
   * @param userId - User ID importing rules
   * @param rulesJson - JSON string of rules to import
   * @returns ImportResult with counts of imported, updated, and errors
   */
  async importRules(userId: string, rulesJson: string): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      updated: 0,
      errors: [],
    }

    let rules: unknown[]
    try {
      rules = JSON.parse(rulesJson)
    } catch {
      result.errors.push('Invalid JSON format')
      return result
    }

    if (!Array.isArray(rules)) {
      result.errors.push('Rules must be an array')
      return result
    }

    for (const rule of rules) {
      try {
        // Validate rule structure
        const validation = validateRule(rule)
        if (!validation.success) {
          result.errors.push(`Rule '${(rule as { id?: string }).id || 'unknown'}': ${validation.error.errors.map(e => e.message).join(', ')}`)
          continue
        }

        const validated = validation.data

        // Check if rule already exists for this user
        const existing = await this.prisma.userRule.findFirst({
          where: { userId, ruleId: validated.id },
        })

        if (existing) {
          // Update existing rule
          await this.prisma.userRule.update({
            where: { id: existing.id },
            data: {
              name: validated.name,
              description: validated.description,
              severity: validated.severity,
              category: validated.category,
              pattern: JSON.stringify(validated.pattern),
              message: validated.message,
              enabled: validated.enabled,
              references: stringifyReferences(validated.references || []),
              isAIGenerated: false, // Imported rules are not AI-generated
            },
          })
          result.updated++
        } else {
          // Create new rule
          await this.prisma.userRule.create({
            data: {
              userId,
              ruleId: validated.id,
              name: validated.name,
              description: validated.description,
              severity: validated.severity,
              category: validated.category,
              pattern: JSON.stringify(validated.pattern),
              message: validated.message,
              enabled: validated.enabled,
              references: stringifyReferences(validated.references || []),
              isAIGenerated: false, // Imported rules are not AI-generated
            },
          })
          result.imported++
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        result.errors.push(`Rule '${(rule as { id?: string }).id || 'unknown'}': ${errorMsg}`)
      }
    }

    return result
  }

  /**
   * Load built-in rules from database
   *
   * Uses caching to avoid repeated database queries.
   *
   * @returns BuiltInRule[] array
   */
  private async loadBuiltInRules(): Promise<BuiltInRule[]> {
    if (this.builtInRulesCache) {
      return this.builtInRulesCache
    }

    // Load built-in rules from database
    const dbRules = await this.prisma.rule.findMany({
      where: { isBuiltIn: true },
    })

    const rules: BuiltInRule[] = dbRules.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description || undefined,
      severity: r.severity as BuiltInRule['severity'],
      category: r.category,
      pattern: JSON.parse(r.pattern),
      message: r.message,
      enabled: r.enabled,
      references: JSON.parse(r.references || '[]'),
      isBuiltIn: true,
    }))

    this.builtInRulesCache = rules
    return rules
  }
}
