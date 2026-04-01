/**
 * Policy Repository
 *
 * Handles database queries for fetching user and organization policies.
 * Provides policy resolution logic to determine the effective policy mode
 * for a user based on their organization settings.
 *
 * Follows the same pattern as ScanRepository and FalsePositiveFilter.
 */

import type { PrismaClient } from '@prisma/client'
import { PolicyMode, type PolicyResolution } from '../policy/policy-types'

/**
 * PolicyRepository handles policy database queries
 *
 * Resolves the effective policy mode for a user by querying their
 * organization's policy settings. Falls back to MODERATE mode if
 * no organization or policy is configured.
 */
export class PolicyRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Resolve the effective policy mode for a user
   *
   * Query hierarchy:
   * 1. Fetch user with organization and policy relations
   * 2. Extract organization policy mode (default to MODERATE)
   * 3. Check for user override (not yet implemented in schema)
   * 4. Return effective mode (user can only be stricter, not more permissive)
   *
   * @param userId - User ID to resolve policy for
   * @returns Policy resolution with effective mode and metadata
   */
  async resolvePolicyForUser(userId: string): Promise<PolicyResolution> {
    try {
      // Query user with organization and policy
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          organization: {
            include: {
              policy: true
            }
          }
        }
      })

      // Handle missing user or organization
      if (!user) {
        console.warn(`[PolicyRepository] User not found: ${userId}`)
        return this.createDefaultResolution(userId, '')
      }

      if (!user.organization) {
        console.warn(`[PolicyRepository] User ${userId} has no organization`)
        return this.createDefaultResolution(userId, '')
      }

      // Extract organization policy mode (default to MODERATE)
      const orgMode = (user.organization.policy?.mode as PolicyMode) || PolicyMode.MODERATE

      // User override logic (when schema supports it)
      // For now, user override is not implemented in the schema
      const userOverride = undefined
      const hasOverride = false

      // User can only be STRICTER than org, not more permissive
      const strictness = { STRICT: 3, MODERATE: 2, PERMISSIVE: 1 }
      const effectiveMode =
        userOverride && strictness[userOverride] >= strictness[orgMode]
          ? userOverride
          : orgMode

      return {
        effectiveMode,
        orgMode,
        hasOverride,
        userId,
        organizationId: user.organizationId || ''
      }
    } catch (error) {
      // Handle database errors with fallback to MODERATE
      console.error(`[PolicyRepository] Error resolving policy for user ${userId}:`, error)
      return this.createDefaultResolution(userId, '')
    }
  }

  /**
   * Create a default policy resolution (MODERATE mode)
   *
   * Used as fallback when user, organization, or policy is not found.
   *
   * @param userId - User ID
   * @param organizationId - Organization ID (empty if none)
   * @returns Default policy resolution with MODERATE mode
   */
  private createDefaultResolution(
    userId: string,
    organizationId: string
  ): PolicyResolution {
    return {
      effectiveMode: PolicyMode.MODERATE,
      orgMode: PolicyMode.MODERATE,
      hasOverride: false,
      userId,
      organizationId
    }
  }
}
