/**
 * Policy Enforcer
 *
 * Applies security policy modes to scan findings, determining which
 * findings are blocked, warned, or allowed based on severity and risk level.
 *
 * This is the core business logic for policy enforcement, following
 * the same pattern as FalsePositiveFilter but with more complex rules.
 */

import type { Finding } from '../types'
import { PolicyMode, type PolicyResult, type BlockDecision } from './policy-types'

/**
 * PolicyEnforcer applies security policy modes to scan findings
 *
 * Three enforcement modes:
 * - STRICT: Blocks critical/high findings, requires AI confirmation
 * - MODERATE: Warns on critical/high, never blocks
 * - PERMISSIVE: No blocking, no warnings
 */
export class PolicyEnforcer {
  constructor(private aiAvailable: boolean) {}

  /**
   * Enforce policy on findings
   *
   * @param findings - All findings from the scan
   * @param score - Aggregate risk score (0-100)
   * @param mode - Policy mode to apply (STRICT, MODERATE, or PERMISSIVE)
   * @returns Policy result with filtered findings and block decision
   */
  enforce(findings: Finding[], score: number, mode: PolicyMode): PolicyResult {
    switch (mode) {
      case PolicyMode.STRICT:
        return this.enforceStrict(findings, score)
      case PolicyMode.MODERATE:
        return this.enforceModerate(findings, score)
      case PolicyMode.PERMISSIVE:
        return this.enforcePermissive(findings, score)
      default:
        // Fallback to MODERATE for unknown modes
        console.warn(`Unknown policy mode: ${mode}, defaulting to MODERATE`)
        return this.enforceModerate(findings, score)
    }
  }

  /**
   * STRICT mode enforcement
   *
   * - Blocks if ANY critical/high findings present
   * - Filters findings by AI confirmation (confidence > 70) if AI available
   * - Returns BLOCK decision when threats present, ALLOW otherwise
   */
  private enforceStrict(findings: Finding[], score: number): PolicyResult {
    // Check if any critical or high severity findings exist
    const hasThreats = findings.some(
      f => f.severity === 'critical' || f.severity === 'high'
    )

    // Filter findings by AI confirmation if AI is available
    const filteredFindings = this.filterByAIConfirmation(findings)

    // Build warnings
    const warnings: string[] = []
    if (hasThreats) {
      warnings.push('Blocked by STRICT policy')
    }

    if (!this.aiAvailable && filteredFindings.length > 0) {
      warnings.push('AI unavailable - STRICT mode may have false positives')
    }

    return {
      mode: PolicyMode.STRICT,
      findings: filteredFindings,
      blockDecision: hasThreats ? 'BLOCK' : 'ALLOW',
      warnings
    }
  }

  /**
   * MODERATE mode enforcement
   *
   * - Never blocks (blockDecision always 'ALLOW')
   * - Adds warning for critical/high findings
   * - Returns all findings unfiltered
   */
  private enforceModerate(findings: Finding[], score: number): PolicyResult {
    // Check if any critical or high severity findings exist
    const hasHighRisk = findings.some(
      f => f.severity === 'critical' || f.severity === 'high'
    )

    // Build warnings
    const warnings: string[] = []
    if (hasHighRisk) {
      warnings.push('High-risk findings detected - review recommended')
    }

    return {
      mode: PolicyMode.MODERATE,
      findings, // Return all findings unfiltered
      blockDecision: 'ALLOW', // Never block in MODERATE mode
      warnings
    }
  }

  /**
   * PERMISSIVE mode enforcement
   *
   * - Never blocks (blockDecision 'ALLOW')
   * - No warnings
   * - Returns all findings unfiltered
   */
  private enforcePermissive(findings: Finding[], score: number): PolicyResult {
    return {
      mode: PolicyMode.PERMISSIVE,
      findings, // Return all findings unfiltered
      blockDecision: 'ALLOW',
      warnings: [] // No warnings in permissive mode
    }
  }

  /**
   * Filter findings by AI confirmation
   *
   * In STRICT mode, only include findings that have been analyzed by AI
   * with confidence > 70%. If AI is unavailable, include all findings
   * with a warning.
   *
   * @param findings - Findings to filter
   * @returns Filtered findings
   */
  private filterByAIConfirmation(findings: Finding[]): Finding[] {
    // If AI is not available, include all findings with a warning
    if (!this.aiAvailable) {
      console.warn('AI unavailable - STRICT mode may have false positives')
      return findings
    }

    // Filter for findings that were analyzed by AI with high confidence
    return findings.filter(
      f => f.aiAnalyzed && f.confidence !== undefined && f.confidence > 70
    )
  }
}
