#!/usr/bin/env node
/**
 * Skills Security Scanner CLI
 *
 * Command-line interface for scanning AI Skills files.
 */
import { Command } from 'commander';
import { scanFile } from './commands/scan.js';
const program = new Command();
program
    .name('s3-cli')
    .description('Security scanner for AI Skills files')
    .version('0.1.0');
program
    .command('scan <file>')
    .description('Scan a Skills file for security threats')
    .option('-a, --ai', 'Enable AI analysis (default: disabled)')
    .option('-v, --verbose', 'Show detailed output')
    .option('-o, --output <file>', 'Export results to file')
    .option('--format <type>', 'Export format: json or sarif (default: json)')
    .action(async (file, options) => {
    try {
        await scanFile(file, options);
    }
    catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
});
program.parseAsync(process.argv).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
