/**
 * Scan Command Implementation
 *
 * Implements the core scanning functionality for the CLI.
 * Reads files, creates scanner, and displays results.
 */
export interface ScanOptions {
    ai?: boolean;
    verbose?: boolean;
    output?: string;
    format?: 'json' | 'sarif';
}
/**
 * Scan a file for security threats
 *
 * @param file - Path to the file to scan
 * @param options - Scan options
 */
export declare function scanFile(file: string, options: ScanOptions): Promise<void>;
//# sourceMappingURL=scan.d.ts.map