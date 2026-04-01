/**
 * SARIF Export Functionality
 *
 * Converts scan results to SARIF 2.1.0 format for CI/CD integration
 * and GitHub Security Tab compatibility.
 */
import type { ScanResult, Severity } from '@skills-sec/scanner';
/**
 * SARIF 2.1.0 Schema Interfaces
 */
interface SarifLog {
    version: string;
    $schema: string;
    runs: SarifRun[];
}
interface SarifRun {
    tool: SarifTool;
    results: SarifResult[];
    rules?: SarifRule[];
}
interface SarifTool {
    driver: SarifToolDriver;
}
interface SarifToolDriver {
    name: string;
    version: string;
    informationUri: string;
    rules?: SarifRule[];
}
interface SarifRule {
    id: string;
    name: string;
    shortDescription?: {
        text: string;
    };
    properties?: {
        category?: string;
        precision?: 'high' | 'medium' | 'low';
        'security-severity'?: string;
    };
}
interface SarifResult {
    ruleId: string;
    level: 'error' | 'warning' | 'note' | 'none';
    message: {
        text: string;
    };
    locations: SarifLocation[];
}
interface SarifLocation {
    physicalLocation: {
        artifactLocation: {
            uri: string;
        };
        region?: {
            startLine: number;
            startColumn?: number;
        };
    };
}
/**
 * Convert severity to SARIF level
 */
export declare function severityToLevel(severity: Severity): SarifResult['level'];
/**
 * Convert severity to SARIF security-severity string
 * GitHub Security Tab uses this for severity ranking
 */
export declare function severityToSecuritySeverity(severity: Severity): string;
/**
 * Convert ScanResult to SARIF 2.1.0 format
 *
 * @param result - Scan result to convert
 * @param filename - Name of the file that was scanned
 * @returns SARIF 2.1.0 compliant log object
 */
export declare function convertToSarif(result: ScanResult, filename: string): SarifLog;
/**
 * Export scan result to SARIF file
 *
 * @param result - Scan result to export
 * @param outputPath - Path where SARIF file should be written
 * @param filename - Name of the file that was scanned
 * @throws Error if file cannot be written (e.g., permission denied)
 */
export declare function exportSarif(result: ScanResult, outputPath: string, filename: string): Promise<void>;
export {};
//# sourceMappingURL=sarif.d.ts.map