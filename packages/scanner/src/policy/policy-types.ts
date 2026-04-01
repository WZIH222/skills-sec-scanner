/**
 * Policy Type Definitions
 *
 * Defines the types and interfaces for security policy enforcement.
 * Policy modes control how strictly the scanner enforces security findings.
 */

/**
 * Policy enforcement modes
 *
 * STRICT: Block all threats, require AI confirmation for findings
 * MODERATE: Allow with warnings, AI review for high-risk findings
 * PERMISSIVE: Log only, no blocking or warnings
 */
export enum PolicyMode {
  STRICT = 'STRICT',
  MODERATE = 'MODERATE',
  PERMISSIVE = 'PERMISSIVE'
}

/**
 * Block decision returned by policy enforcement
 *
 * BLOCK: Scan should be blocked (execution denied)
 * ALLOW: Scan allowed to proceed
 * WARN: Scan allowed with warnings (for MODERATE mode)
 */
export type BlockDecision = 'BLOCK' | 'ALLOW' | 'WARN'

/**
 * Result of policy enforcement
 *
 * Contains the filtered findings, block decision, and any warnings
 * to be displayed to the user.
 */
export interface PolicyResult {
  /** The policy mode that was applied */
  mode: PolicyMode

  /** Findings after policy enforcement (may be filtered) */
  findings: import('../types').Finding[]

  /** Whether the scan should be blocked, allowed, or warned */
  blockDecision: BlockDecision

  /** Warnings to display to the user */
  warnings: string[]
}

/**
 * Policy resolution from database
 *
 * Represents the effective policy for a user, considering
 * organization policy and any user overrides.
 */
export interface PolicyResolution {
  /** The effective policy mode for this user */
  effectiveMode: PolicyMode

  /** The organization's default policy mode */
  orgMode: PolicyMode

  /** Whether the user has a personal override */
  hasOverride: boolean

  /** User ID */
  userId: string

  /** Organization ID (empty if no organization) */
  organizationId: string
}
