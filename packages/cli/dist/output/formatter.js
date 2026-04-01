/**
 * Console Output Formatter
 *
 * Formats scan results for console display with color coding.
 */
import chalk from 'chalk';
import { getColor } from './colors.js';
export function formatResult(result, filename) {
    const lines = [];
    // Header
    lines.push(`\n${chalk.bold('Scan Results for ' + filename)}`);
    lines.push(chalk.gray('─'.repeat(50)));
    // Summary
    lines.push(`${chalk.bold('Findings:')} ${result.findings.length}`);
    lines.push(`${chalk.bold('Score:')} ${formatScore(result.score)}/100`);
    lines.push(`${chalk.bold('Duration:')} ${result.metadata.scanDuration}ms`);
    if (result.findings.length === 0) {
        lines.push(`\n${chalk.green('✓ No security findings detected')}`);
    }
    else {
        lines.push(`\n${chalk.yellow('Security Findings:')}`);
        result.findings.forEach((finding, index) => {
            lines.push(formatFinding(finding, index + 1));
        });
    }
    return lines.join('\n');
}
/**
 * Format an individual finding with color coding
 */
function formatFinding(finding, index) {
    const lines = [];
    // Severity badge and message
    const colorFn = getColor(finding.severity);
    const badge = colorFn(`[${finding.severity.toUpperCase()}]`);
    lines.push(`\n${index}. ${badge} ${finding.message}`);
    // Location
    lines.push(chalk.dim(`   Location: Line ${finding.location.line}`));
    // Code snippet
    if (finding.code) {
        lines.push(chalk.dim(`   Code: ${finding.code.trim()}`));
    }
    // AI explanation
    if (finding.explanation) {
        lines.push(chalk.dim(`   AI: ${finding.explanation}`));
    }
    return lines.join('\n');
}
/**
 * Format score with color coding
 */
function formatScore(score) {
    if (score <= 20)
        return chalk.green(score.toString());
    if (score <= 40)
        return chalk.blue(score.toString());
    if (score <= 60)
        return chalk.yellow(score.toString());
    if (score <= 80)
        return chalk.red(score.toString());
    return chalk.red.bold(score.toString());
}
