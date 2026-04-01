/**
 * Core type definitions for the Skills Security Scanner
 *
 * These types define the structure of scan results, findings, and parse results
 * used throughout the scanning pipeline.
 */

// Rule types (for user-extensible rules - Phase 5)
export * from './rule-types'

/**
 * Severity levels for security findings
 * Ordered from most critical to informational
 */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

/**
 * Location in source code
 */
export interface Location {
  line: number
  column: number
}

/**
 * Individual security finding detected during scanning
 */
export interface Finding {
  ruleId: string
  severity: Severity
  message: string
  location: Location
  code?: string // Optional code snippet showing the issue
  // AI-generated metadata
  explanation?: string // Natural language explanation (3-5 sentences)
  confidence?: number // AI confidence score 0-100
  aiAnalyzed?: boolean // Whether AI analyzed this finding
}

/**
 * Scan metadata containing timing information
 */
export interface ScanMetadata {
  scannedAt: Date | string
  scanDuration: number // milliseconds
  // AI analysis metadata
  aiAnalysis?: boolean // Whether AI was used for this scan
  aiProvider?: string // Which AI provider was used (openai, anthropic, custom)
}

/**
 * Complete scan result containing all findings and aggregate score
 */
export interface ScanResult {
  id?: string // Database ID (returned after storage)
  fileId?: string // Unique file identifier (added after storage)
  findings: Finding[]
  score: number // 0-100 aggregate risk score
  metadata: ScanMetadata
  policyResult?: import('../policy').PolicyResult // Policy enforcement result (Phase 3.4)
}

/**
 * Error that occurred during parsing
 */
export interface ParseError {
  message: string
  line?: number
  column?: number
}

/**
 * Metadata about parsed code
 */
export interface ParseMetadata {
  language: string
  format?: string
}

/**
 * Result of parsing a Skills file
 */
export interface IParseResult {
  ast: unknown
  metadata: ParseMetadata
  errors: ParseError[]
  dependencies: string[]
}

/**
 * Options for configuring a scan
 */
export interface ScanOptions {
  enabledRules?: string[]
  aiEnabled?: boolean
  userId?: string // User ID for false positive filtering (Phase 3)
  policyMode?: import('../policy').PolicyMode // Policy mode for enforcement (Phase 3.4)
  skipStorage?: boolean // Skip database storage (for folder child files)
}
