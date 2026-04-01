/**
 * Scan Command Implementation
 *
 * Implements the core scanning functionality for the CLI.
 * Reads files, creates scanner, and displays results.
 */
import { readFile } from 'fs/promises';
import { createScanner } from '@skills-sec/scanner';
import ora from 'ora';
import { formatResult } from '../output/formatter.js';
import { exportJson } from '../output/export.js';
import { exportSarif } from '../output/sarif.js';
import chalk from 'chalk';
/**
 * Scan a file for security threats
 *
 * @param file - Path to the file to scan
 * @param options - Scan options
 */
export async function scanFile(file, options) {
    let spinner = null;
    try {
        // Step 1: Read file content
        const content = await readFile(file, 'utf-8');
        // Step 2: Create scanner (CLI doesn't pass databaseUrl or redisUrl)
        const scanner = await createScanner();
        // Step 3: Show spinner if AI is enabled
        if (options.ai) {
            spinner = ora('Scanning with AI...').start();
        }
        // Step 4: Call scanner
        const result = await scanner.scan(content, file, {
            aiEnabled: options.ai,
        });
        // Step 5: Stop spinner
        if (spinner) {
            if (result.findings.length > 0) {
                spinner.warn(`Found ${result.findings.length} security findings`);
            }
            else {
                spinner.succeed('No security findings detected');
            }
        }
        // Step 6: Format and print results
        console.log(formatResult(result, file));
        // Step 7: Export results if requested
        if (options.output) {
            const format = options.format || 'json';
            try {
                if (format === 'sarif') {
                    await exportSarif(result, options.output, file);
                }
                else {
                    await exportJson(result, options.output);
                }
            }
            catch (exportError) {
                console.error(chalk.yellow(`Export failed: ${exportError.message}`));
                // Export failure doesn't affect exit code
            }
        }
        // Step 8: Exit with appropriate code
        if (result.findings.length > 0) {
            process.exit(1); // Threats found
        }
        else {
            process.exit(0); // Clean scan
        }
    }
    catch (error) {
        // Stop spinner on error
        if (spinner) {
            spinner.fail('Scan failed');
        }
        // Handle file not found error
        if (error instanceof Error) {
            if (error.code === 'ENOENT') {
                throw new Error(`File not found: ${file}`);
            }
            throw error;
        }
        // Re-throw other errors
        throw error;
    }
}
