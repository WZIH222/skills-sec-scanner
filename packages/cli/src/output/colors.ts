/**
 * Severity Color Scheme
 *
 * Defines color-coded severity levels for console output.
 * Uses Chalk for cross-platform terminal colors.
 */

import chalk from 'chalk'
import type { Severity } from '@skills-sec/scanner'

/**
 * Color functions for each severity level
 */
export const severityColors: Record<Severity, (text: string) => string> = {
  critical: chalk.red.bold,
  high: chalk.red,
  medium: chalk.yellow,
  low: chalk.blue,
  info: chalk.gray,
}

/**
 * Get color function for a given severity level
 *
 * @param severity - The severity level
 * @returns Chalk color function
 */
export function getColor(severity: Severity): (text: string) => string {
  return severityColors[severity] || chalk.white
}
