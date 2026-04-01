/**
 * SARIF Export Functionality
 *
 * Converts scan results to SARIF 2.1.0 format for CI/CD integration
 * and GitHub Security Tab compatibility.
 */

import { writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import type { ScanResult, Severity, Finding } from '@skills-sec/scanner'
import chalk from 'chalk'

/**
 * SARIF 2.1.0 Schema Interfaces
 */

interface SarifLog {
  version: string
  $schema: string
  runs: SarifRun[]
}

interface SarifRun {
  tool: SarifTool
  results: SarifResult[]
  rules?: SarifRule[]
}

interface SarifTool {
  driver: SarifToolDriver
}

interface SarifToolDriver {
  name: string
  version: string
  informationUri: string
  rules?: SarifRule[]
}

interface SarifRule {
  id: string
  name: string
  shortDescription?: {
    text: string
  }
  properties?: {
    category?: string
    precision?: 'high' | 'medium' | 'low'
    'security-severity'?: string
  }
}

interface SarifResult {
  ruleId: string
  level: 'error' | 'warning' | 'note' | 'none'
  message: {
    text: string
  }
  locations: SarifLocation[]
}

interface SarifLocation {
  physicalLocation: {
    artifactLocation: {
      uri: string
    }
    region?: {
      startLine: number
      startColumn?: number
    }
  }
}

/**
 * Convert severity to SARIF level
 */
export function severityToLevel(severity: Severity): SarifResult['level'] {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error'
    case 'medium':
      return 'warning'
    case 'low':
    case 'info':
      return 'note'
    default:
      return 'none'
  }
}

/**
 * Convert severity to SARIF security-severity string
 * GitHub Security Tab uses this for severity ranking
 */
export function severityToSecuritySeverity(severity: Severity): string {
  switch (severity) {
    case 'critical':
      return '9.0'
    case 'high':
      return '7.0'
    case 'medium':
      return '5.0'
    case 'low':
      return '3.0'
    case 'info':
      return '1.0'
    default:
      return '0.0'
  }
}

/**
 * Convert finding to SARIF result
 */
function findingToResult(finding: Finding, filename: string): SarifResult {
  // Build message text with explanation and code if available
  let messageText = finding.message
  if (finding.explanation) {
    messageText += `\n\n${finding.explanation}`
  }
  if (finding.code) {
    messageText += `\n\nCode:\n${finding.code}`
  }

  return {
    ruleId: finding.ruleId,
    level: severityToLevel(finding.severity),
    message: {
      text: messageText,
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: filename,
          },
          region: {
            startLine: finding.location.line,
            startColumn: finding.location.column,
          },
        },
      },
    ],
  }
}

/**
 * Create SARIF rule from finding
 */
function findingToRule(finding: Finding): SarifRule {
  return {
    id: finding.ruleId,
    name: finding.ruleId,
    shortDescription: {
      text: finding.message,
    },
    properties: {
      category: 'security',
      precision: 'medium',
      'security-severity': severityToSecuritySeverity(finding.severity),
    },
  }
}

/**
 * Convert ScanResult to SARIF 2.1.0 format
 *
 * @param result - Scan result to convert
 * @param filename - Name of the file that was scanned
 * @returns SARIF 2.1.0 compliant log object
 */
export function convertToSarif(result: ScanResult, filename: string): SarifLog {
  // Extract unique rules from findings
  const uniqueRules = new Map<string, SarifRule>()
  result.findings.forEach(finding => {
    if (!uniqueRules.has(finding.ruleId)) {
      uniqueRules.set(finding.ruleId, findingToRule(finding))
    }
  })

  // Convert findings to SARIF results
  const results = result.findings.map(finding => findingToResult(finding, filename))

  // Build SARIF log
  const sarifLog: SarifLog = {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [
      {
        tool: {
          driver: {
            name: 'Skills Security Scanner',
            version: '1.0.0',
            informationUri: 'https://github.com/skills-sec/skills-sec',
            rules: Array.from(uniqueRules.values()),
          },
        },
        results,
      },
    ],
  }

  return sarifLog
}

/**
 * Export scan result to SARIF file
 *
 * @param result - Scan result to export
 * @param outputPath - Path where SARIF file should be written
 * @param filename - Name of the file that was scanned
 * @throws Error if file cannot be written (e.g., permission denied)
 */
export async function exportSarif(result: ScanResult, outputPath: string, filename: string): Promise<void> {
  try {
    // Convert to SARIF
    const sarif = convertToSarif(result, filename)

    // Ensure directory exists
    const dir = dirname(outputPath)
    await mkdir(dir, { recursive: true })

    // Write SARIF file with 2-space indentation
    await writeFile(outputPath, JSON.stringify(sarif, null, 2), 'utf-8')

    // Log success
    console.log(chalk.dim(`SARIF report exported to ${outputPath}`))
  } catch (error) {
    // Handle permission errors
    if (error instanceof Error && (error as any).code === 'EACCES') {
      throw new Error(`Permission denied: Cannot write to ${outputPath}`)
    }
    throw error
  }
}
