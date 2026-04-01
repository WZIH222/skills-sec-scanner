'use client'

import React from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Clock, FileText, AlertCircle, Folder, File } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getRiskLevel, getRiskColor, getScoreColor, severityColors, type SeverityCount } from '@/types/scan'

interface ResultsSummaryProps {
  score: number
  severityCounts: SeverityCount
  filename: string
  scannedAt: Date | string
  scanDuration?: number
  totalFindings: number
  fileCount?: number  // For folder scans: number of files
  files?: Array<{ id: string; filename: string; score: number; findingCount: number }>  // For folder scans
  onSeverityClick?: (severity: string) => void
  className?: string
}

export function ResultsSummary({
  score,
  severityCounts,
  filename,
  scannedAt,
  scanDuration,
  totalFindings,
  fileCount,
  files,
  onSeverityClick,
  className
}: ResultsSummaryProps) {
  const t = useTranslations('ScanDetail')
  const riskLevel = getRiskLevel(score)
  const riskColor = getRiskColor(score)
  const scoreColorClass = getScoreColor(score)

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleString()
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
  }

  const severityEntries = Object.entries(severityCounts).filter(([_, count]) => count > 0)

  return (
    <div className={cn('space-y-4', className)}>
      {/* Score Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{t('scanResults')}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <FileText className="h-4 w-4" />
                {filename}
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{score}</div>
              <div className={cn('text-sm font-medium', riskColor)}>
                {riskLevel}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Score Gauge */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('riskScore')}</span>
              <span className="font-medium">{score}/100</span>
            </div>
            <div className="relative h-3 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
              <div
                className={cn('h-full transition-all duration-500', scoreColorClass)}
                style={{ width: `${Math.min(score, 100)}%` }}
              />
            </div>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{formatDate(scannedAt)}</span>
            </div>
            {scanDuration && (
              <span>{t('duration')}: {formatDuration(scanDuration)}</span>
            )}
            <span className="font-medium">{totalFindings} {t('findings')}</span>
          </div>
        </CardContent>
      </Card>

      {/* Severity Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t('findingsBySeverity')}</CardTitle>
          <CardDescription>
            {t('clickToFilter')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {severityEntries.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-5 w-5 mr-2" />
              {t('noFindingsDetected')}
            </div>
          ) : (
            <div className="space-y-3">
              {severityEntries.map(([severity, count]) => {
                const severityKey = severity as keyof typeof severityColors
                const colors = severityColors[severityKey]
                const percentage = totalFindings > 0 ? (count / totalFindings) * 100 : 0

                return (
                  <div
                    key={severity}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800',
                      onSeverityClick && 'hover:shadow-sm'
                    )}
                    onClick={() => onSeverityClick?.(severity)}
                  >
                    <Badge
                      variant="outline"
                      className={cn('capitalize', colors.border, colors.text)}
                    >
                      {severity}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium capitalize">{severity} Severity</span>
                        <span className="text-sm text-muted-foreground">{count} found</span>
                      </div>
                      <Progress value={percentage} className="h-2" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* File List (for folder scans) */}
      {fileCount && files && files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Folder className="h-5 w-5" />
              {t('filesScanned', { count: fileCount })}
            </CardTitle>
            <CardDescription>
              {t('clickToViewFile')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {files.map((file) => {
                const scoreColorClass = getScoreColor(file.score)
                return (
                  <a
                    key={file.id}
                    href={`/scans/${file.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 min-w-0"
                  >
                    <File className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm font-medium truncate min-w-0" title={file.filename}>{file.filename}</span>
                    <Badge
                      variant="outline"
                      className={cn('text-xs shrink-0', scoreColorClass)}
                    >
                      {file.score}/100
                    </Badge>
                    <Badge
                      variant={file.findingCount > 0 ? 'destructive' : 'secondary'}
                      className="text-xs shrink-0"
                    >
                      {file.findingCount} {file.findingCount === 1 ? t('findings').replace('s', '') : t('findings')}
                    </Badge>
                  </a>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
