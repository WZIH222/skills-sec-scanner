/**
 * Severity Color Scheme
 *
 * Defines color-coded severity levels for console output.
 * Uses Chalk for cross-platform terminal colors.
 */
import type { Severity } from '@skills-sec/scanner';
/**
 * Color functions for each severity level
 */
export declare const severityColors: Record<Severity, (text: string) => string>;
/**
 * Get color function for a given severity level
 *
 * @param severity - The severity level
 * @returns Chalk color function
 */
export declare function getColor(severity: Severity): (text: string) => string;
//# sourceMappingURL=colors.d.ts.map