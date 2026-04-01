/**
 * Frontend type definitions for scan results
 * Aligned with @skills-sec/scanner types
 */

import type { Finding, ScanResult as ScannerScanResult } from '@skills-sec/scanner'

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export interface ScanResult extends ScannerScanResult {
  id: string
  fileId: string
  filename: string
}

export interface FindingWithId extends Omit<Finding, 'location'> {
  id: string
  location: {
    line: number
    column: number
  }
  code?: string
  explanation?: string
  confidence?: number
  aiAnalyzed?: boolean
  isFalsePositive?: boolean  // Whether this finding has been marked as false positive
}

export interface FilterState {
  severities: Severity[]
  search: string
}

export interface SeverityCount {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

export const severityColors: Record<Severity, { bg: string; border: string; text: string; icon: string }> = {
  critical: {
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    icon: 'AlertCircle'
  },
  high: {
    bg: 'bg-orange-50 dark:bg-orange-950',
    border: 'border-orange-200 dark:border-orange-800',
    text: 'text-orange-700 dark:text-orange-400',
    icon: 'AlertTriangle'
  },
  medium: {
    bg: 'bg-yellow-50 dark:bg-yellow-950',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-700 dark:text-yellow-400',
    icon: 'AlertTriangle'
  },
  low: {
    bg: 'bg-blue-50 dark:bg-blue-950',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    icon: 'Info'
  },
  info: {
    bg: 'bg-gray-50 dark:bg-gray-950',
    border: 'border-gray-200 dark:border-gray-800',
    text: 'text-gray-700 dark:text-gray-400',
    icon: 'Info'
  }
}

export const getSeverityLabel = (severity: Severity): string => {
  return severity.charAt(0).toUpperCase() + severity.slice(1)
}

export const getRiskLevel = (score: number): string => {
  if (score <= 20) return 'Clean'
  if (score <= 40) return 'Low Risk'
  if (score <= 60) return 'Medium Risk'
  if (score <= 80) return 'High Risk'
  return 'Critical Risk'
}

export const getRiskColor = (score: number): string => {
  if (score <= 20) return 'text-green-600 dark:text-green-400'
  if (score <= 40) return 'text-blue-600 dark:text-blue-400'
  if (score <= 60) return 'text-yellow-600 dark:text-yellow-400'
  if (score <= 80) return 'text-orange-600 dark:text-orange-400'
  return 'text-red-600 dark:text-red-400'
}

export const getScoreColor = (score: number): string => {
  if (score <= 20) return 'bg-green-500'
  if (score <= 40) return 'bg-blue-500'
  if (score <= 60) return 'bg-yellow-500'
  if (score <= 80) return 'bg-orange-500'
  return 'bg-red-500'
}
