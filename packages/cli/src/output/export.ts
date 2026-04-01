/**
 * JSON Export Functionality
 *
 * Exports scan results to JSON files with automatic directory creation
 * and proper error handling.
 */

import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import type { ScanResult } from '@skills-sec/scanner'
import chalk from 'chalk'

/**
 * Export data structure for JSON output
 */
interface ExportData {
  filename?: string
  findings: Array<{
    ruleId: string
    severity: string
    message: string
    line: number
    column: number
    code?: string
    explanation?: string
  }>
  score: number
  scannedAt: string | Date
  scanDuration: number
  aiAnalysis?: boolean
  aiProvider?: string
}

/**
 * Export scan result to JSON file
 *
 * @param result - Scan result to export
 * @param outputPath - Path where JSON file should be written
 * @throws Error if file cannot be written (e.g., permission denied)
 */
export async function exportJson(result: ScanResult, outputPath: string): Promise<void> {
  // Create export data structure
  const exportData: ExportData = {
    findings: result.findings.map(finding => ({
      ruleId: finding.ruleId,
      severity: finding.severity,
      message: finding.message,
      line: finding.location.line,
      column: finding.location.column,
      code: finding.code,
      explanation: finding.explanation,
    })),
    score: result.score,
    scannedAt: result.metadata.scannedAt,
    scanDuration: result.metadata.scanDuration,
    aiAnalysis: result.metadata.aiAnalysis,
    aiProvider: result.metadata.aiProvider,
  }

  try {
    // Ensure directory exists
    const dir = dirname(outputPath)
    await mkdir(dir, { recursive: true })

    // Write JSON file with 2-space indentation
    const json = JSON.stringify(exportData, null, 2)
    await writeFile(outputPath, json, 'utf-8')

    // Log success
    console.log(chalk.dim(`Results exported to ${outputPath}`))
  } catch (error) {
    // Handle permission errors
    if (error instanceof Error && (error as any).code === 'EACCES') {
      throw new Error(`Permission denied: Cannot write to ${outputPath}`)
    }
    throw error
  }
}
