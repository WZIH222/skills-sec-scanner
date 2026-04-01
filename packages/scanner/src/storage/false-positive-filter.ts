/**
 * FalsePositiveFilter Service
 *
 * Manages false positive exclusions for findings.
 * Queries database for user exclusions and provides O(1) lookup.
 */

import type { PrismaClient } from '@prisma/client'

export interface FalsePositive {
  id: string
  userId: string
  ruleId: string
  codeHash: string
  filePath: string
  lineNumber: number
  createdAt: Date
  updatedAt: Date
}

export class FalsePositiveFilter {
  private exclusions: Map<string, FalsePositive> = new Map()
  private prisma: PrismaClient

  constructor(prisma: PrismaClient) {
    this.prisma = prisma
  }

  /**
   * Load exclusions for a user from database
   *
   * @param userId - User ID to load exclusions for
   * @returns Map of exclusion key (codeHash:ruleId) to FalsePositive record
   */
  async loadExclusions(userId: string): Promise<Map<string, FalsePositive>> {
    try {
      // Query database for user's false positives
      const falsePositives = await this.prisma.falsePositive.findMany({
        where: { userId }
      })

      // Build lookup map by codeHash+ruleId for O(1) matching
      this.exclusions.clear()
      for (const fp of falsePositives) {
        const key = `${fp.codeHash}:${fp.ruleId}`
        this.exclusions.set(key, fp as unknown as FalsePositive)
      }

      return this.exclusions
    } catch (error) {
      console.error('Error loading false positive exclusions:', error)
      // Return empty map on error
      return new Map()
    }
  }

  /**
   * Check if a finding is excluded (marked as false positive)
   *
   * @param userId - User ID to check exclusions for
   * @param ruleId - Rule ID that triggered the finding
   * @param codeHash - SHA-256 hash of the code snippet
   * @returns true if finding is excluded, false otherwise
   */
  isExcluded(userId: string, ruleId: string, codeHash: string): boolean {
    const key = `${codeHash}:${ruleId}`
    const excluded = this.exclusions.get(key)

    // Check if exclusion exists and belongs to the user
    if (excluded && excluded.userId === userId) {
      return true
    }

    return false
  }

  /**
   * Get all loaded exclusions
   *
   * @returns Map of exclusion key to FalsePositive record
   */
  getExclusions(): Map<string, FalsePositive> {
    return this.exclusions
  }

  /**
   * Clear all loaded exclusions
   */
  clearExclusions(): void {
    this.exclusions.clear()
  }
}
