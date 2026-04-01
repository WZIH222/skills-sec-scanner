/**
 * Severity Classifier and Risk Scorer
 *
 * Provides severity classification and risk scoring functionality
 * for security findings detected during scanning.
 */

import { Finding, Severity } from '../types'

/**
 * Severity Classifier
 *
 * Groups findings by severity level
 */
export class SeverityClassifier {
  /**
   * Classify findings by severity
   *
   * @param findings - Array of findings to classify
   * @returns Map of severity -> array of findings
   */
  classify(findings: Finding[]): Map<Severity, Finding[]> {
    const classified = new Map<Severity, Finding[]>()

    for (const finding of findings) {
      const severity = finding.severity

      if (!classified.has(severity)) {
        classified.set(severity, [])
      }

      classified.get(severity)!.push(finding)
    }

    return classified
  }
}

/**
 * Risk Scorer
 *
 * Calculates aggregate risk score from findings using weighted sum
 */
export class RiskScorer {
  // Severity weights for scoring
  private static readonly WEIGHTS: Record<Severity, number> = {
    critical: 5,
    high: 3,
    medium: 2,
    low: 1,
    info: 0,
  }

  /**
   * Calculate aggregate risk score from findings
   *
   * Uses weighted sum formula: Critical×5 + High×3 + Medium×2 + Low×1
   * Score is capped at 100
   *
   * @param findings - Array of findings
   * @returns Aggregate score 0-100
   */
  calculateScore(findings: Finding[]): number {
    // Deduplicate findings: same location + same rule = merge
    const deduplicated = this.deduplicateFindings(findings)

    // Count findings by severity
    const counts = this.countBySeverity(deduplicated)

    // Calculate weighted sum
    const score =
      counts.critical * RiskScorer.WEIGHTS.critical +
      counts.high * RiskScorer.WEIGHTS.high +
      counts.medium * RiskScorer.WEIGHTS.medium +
      counts.low * RiskScorer.WEIGHTS.low

    // Cap at 100
    return Math.min(score, 100)
  }

  /**
   * Get severity level from numeric score
   *
   * @param score - Numeric score 0-100
   * @returns Severity level
   */
  getSeverityLevel(score: number): Severity {
    if (score >= 90) {
      return 'critical'
    } else if (score >= 70) {
      return 'high'
    } else if (score >= 40) {
      return 'medium'
    } else if (score >= 10) {
      return 'low'
    } else {
      return 'info'
    }
  }

  /**
   * Deduplicate findings
   *
   * Same location + same rule = merge as one finding
   *
   * @param findings - Array of findings
   * @returns Deduplicated array
   */
  private deduplicateFindings(findings: Finding[]): Finding[] {
    const unique = new Map<string, Finding>()

    for (const finding of findings) {
      // Key: ruleId + line + column
      const key = `${finding.ruleId}:${finding.location.line}:${finding.location.column}`

      if (!unique.has(key)) {
        unique.set(key, finding)
      }
      // If duplicate exists, keep first (could also merge properties)
    }

    return Array.from(unique.values())
  }

  /**
   * Count findings by severity
   *
   * @param findings - Array of findings
   * @returns Count object with severity counts
   */
  private countBySeverity(findings: Finding[]): Record<Severity, number> {
    const counts: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    }

    for (const finding of findings) {
      counts[finding.severity]++
    }

    return counts
  }
}
