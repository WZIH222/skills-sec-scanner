/**
 * Severity Color Scheme
 *
 * Defines color-coded severity levels for console output.
 * Uses Chalk for cross-platform terminal colors.
 */
import chalk from 'chalk';
/**
 * Color functions for each severity level
 */
export const severityColors = {
    critical: chalk.red.bold,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.blue,
    info: chalk.gray,
};
/**
 * Get color function for a given severity level
 *
 * @param severity - The severity level
 * @returns Chalk color function
 */
export function getColor(severity) {
    return severityColors[severity] || chalk.white;
}
