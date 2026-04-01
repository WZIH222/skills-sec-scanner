/**
 * RuleSeeder
 *
 * One-time seeder that imports built-in rules from JSON files into the database.
 * Uses upsert semantics so it's safe to run multiple times (idempotent).
 * On first startup, rules are imported from JSON files into database.
 * JSON files remain intact as backup/seed data.
 */

import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { PrismaClient } from '@prisma/client'
import { RuleLoader } from './loader'
import { validateRule } from './schema'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BUILT_IN_RULES_DIR = join(__dirname, 'core')

export interface SeederResult {
  seeded: number
  skipped: number
  errors: string[]
}

export class RuleSeeder {
  /**
   * Seed built-in rules from JSON files into database
   *
   * Uses upsert to be idempotent - safe to call multiple times.
   * Only seeds rules that don't already exist in the database.
   *
   * @param prisma - Prisma client instance
   * @returns SeederResult with counts and any errors
   */
  static async seed(prisma: PrismaClient): Promise<SeederResult> {
    const result: SeederResult = { seeded: 0, skipped: 0, errors: [] }

    try {
      const files = await fs.readdir(BUILT_IN_RULES_DIR)
      const jsonFiles = files.filter(file => file.endsWith('.json'))

      for (const file of jsonFiles) {
        try {
          const content = await fs.readFile(join(BUILT_IN_RULES_DIR, file), 'utf-8')
          const jsonData = JSON.parse(content)

          const validation = validateRule(jsonData)
          if (!validation.success) {
            result.errors.push(`Invalid rule in ${file}: ${validation.error.errors.map(e => e.message).join(', ')}`)
            continue
          }

          const rule = validation.data

          // Check if rule already exists
          const existing = await prisma.rule.findUnique({ where: { id: rule.id } })
          if (existing) {
            result.skipped++
            continue
          }

          // Upsert rule into database
          await prisma.rule.upsert({
            where: { id: rule.id },
            create: {
              id: rule.id,
              name: rule.name,
              description: rule.description || '',
              severity: rule.severity,
              category: rule.category,
              pattern: JSON.stringify(rule.pattern),
              message: rule.message,
              enabled: rule.enabled,
              references: JSON.stringify(rule.references || []),
              isBuiltIn: true,
            },
            update: {
              name: rule.name,
              description: rule.description || '',
              severity: rule.severity,
              category: rule.category,
              pattern: JSON.stringify(rule.pattern),
              message: rule.message,
              enabled: rule.enabled,
              references: JSON.stringify(rule.references || []),
            },
          })
          result.seeded++
        } catch (err) {
          result.errors.push(`Failed to process ${file}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    } catch (err) {
      result.errors.push(`Failed to read rules directory: ${err instanceof Error ? err.message : String(err)}`)
    }

    console.log(`[RuleSeeder] Seeded ${result.seeded} rules, skipped ${result.skipped}`)
    if (result.errors.length > 0) {
      console.warn(`[RuleSeeder] Errors:`, result.errors)
    }
    return result
  }
}
