/**
 * JSON Export Functionality
 *
 * Exports scan results to JSON files with automatic directory creation
 * and proper error handling.
 */
import type { ScanResult } from '@skills-sec/scanner';
/**
 * Export scan result to JSON file
 *
 * @param result - Scan result to export
 * @param outputPath - Path where JSON file should be written
 * @throws Error if file cannot be written (e.g., permission denied)
 */
export declare function exportJson(result: ScanResult, outputPath: string): Promise<void>;
//# sourceMappingURL=export.d.ts.map