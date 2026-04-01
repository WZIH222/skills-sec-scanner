/**
 * SARIF Converter
 *
 * Converts ScanResult to SARIF 2.1.0 format for CI/CD integration
 * SARIF spec: https://docs.oasis-open.org/sarif/sarif/v2.1.0/
 */

export interface ScanResult {
  id: string
  fileId: string
  contentHash: string
  filename: string
  score: number
  scannedAt: string
  scanDuration: number
  findings: Finding[]
  metadata?: string
}

export interface Finding {
  id: string
  scanId: string
  ruleId: string
  severity: string
  message: string
  line: number
  column: number
  code?: string
  aiExplanation?: string
}

/**
 * SARIF 2.1.0 Schema
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
  fullDescription?: {
    text: string
  }
  helpUri?: string
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
      endLine?: number
      endColumn?: number
    }
  }
}

/**
 * Convert severity to SARIF level
 */
function severityToLevel(severity: string): SarifResult['level'] {
  const normalizedSeverity = severity.toLowerCase()
  if (normalizedSeverity === 'critical' || normalizedSeverity === 'high') {
    return 'error'
  } else if (normalizedSeverity === 'medium') {
    return 'warning'
  } else if (normalizedSeverity === 'low' || normalizedSeverity === 'info') {
    return 'note'
  }
  return 'none'
}

/**
 * Convert severity to SARIF security-severity string
 * GitHub Security Tab uses this for severity ranking
 */
function severityToSecuritySeverity(severity: string): string {
  const normalizedSeverity = severity.toLowerCase()
  switch (normalizedSeverity) {
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
  // Build message text with AI explanation if available
  let messageText = finding.message
  if (finding.aiExplanation) {
    messageText += `\n\nAI Analysis: ${finding.aiExplanation}`
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
            startLine: finding.line,
            startColumn: finding.column || 1,
            // If we had end positions, we could add them here
            // endLine: finding.endLine || finding.line,
            // endColumn: finding.endColumn || finding.column || 1,
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
 */
export function convertToSarif(scanResult: ScanResult): SarifLog {
  // Extract unique rules from findings
  const uniqueRules = new Map<string, SarifRule>()
  scanResult.findings.forEach(finding => {
    if (!uniqueRules.has(finding.ruleId)) {
      uniqueRules.set(finding.ruleId, findingToRule(finding))
    }
  })

  // Convert findings to SARIF results
  const results = scanResult.findings.map(finding =>
    findingToResult(finding, scanResult.filename)
  )

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
 * Convert ScanResult to JSON (for export)
 */
export function convertToJson(scanResult: ScanResult): string {
  return JSON.stringify(scanResult, null, 2)
}

/**
 * Convert ScanResult to SARIF JSON (for export)
 */
export function convertToSarifJson(scanResult: ScanResult): string {
  const sarifLog = convertToSarif(scanResult)
  return JSON.stringify(sarifLog, null, 2)
}
