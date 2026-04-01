'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertCircle, AlertTriangle, Info, ChevronDown, ChevronRight, Flag, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CodeSnippet } from './CodeSnippet'
import { FindingWithId, severityColors, getSeverityLabel } from '@/types/scan'
import { cn } from '@/lib/utils'

interface FindingCardProps {
  finding: FindingWithId
  filename?: string
  scanId?: string  // Scan ID for API calls
  onToast?: (message: string, type: 'info' | 'success' | 'error') => void
}

export function FindingCard({ finding, filename, scanId, onToast }: FindingCardProps) {
  const t = useTranslations('ScanDetail')
  const [isOpen, setIsOpen] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  // Initialize with the finding's false positive status
  const [isMarked, setIsMarked] = useState(finding.isFalsePositive || false)
  const colors = severityColors[finding.severity]
  const SeverityIcon = finding.severity === 'critical' || finding.severity === 'high' ? AlertCircle : AlertTriangle
  const InfoIcon = finding.severity === 'info' || finding.severity === 'low' ? Info : SeverityIcon

  // Mark as false positive
  const handleMarkAsFalsePositive = async () => {
    if (!scanId || isMarked) {
      return
    }

    setIsProcessing(true)

    try {
      const response = await fetch(
        `/api/scans/${scanId}/findings/${finding.id}/false-positive`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.ok) {
        setIsMarked(true)
        onToast?.(t('markedAsFalsePositive'), 'success')
      } else {
        const error = await response.json()
        onToast?.(`${t('markAsFalsePositive')}: ${error.error}${error.details ? ` (${error.details})` : ''}`, 'error')
      }
    } catch (error) {
      console.error('Error marking false positive:', error)
      onToast?.(t('markAsFalsePositive'), 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  // Cancel false positive marking
  const handleCancelFalsePositive = async () => {
    if (!scanId || !isMarked) {
      return
    }

    setIsProcessing(true)

    try {
      const response = await fetch(
        `/api/scans/${scanId}/findings/${finding.id}/false-positive`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      if (response.ok) {
        setIsMarked(false)
        onToast?.(t('falsePositiveCancelled'), 'success')
      } else {
        const error = await response.json()
        onToast?.(`${t('cancelFalsePositive')}: ${error.error}${error.details ? ` (${error.details})` : ''}`, 'error')
      }
    } catch (error) {
      console.error('Error canceling false positive:', error)
      onToast?.(t('cancelFalsePositive'), 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card
        className={cn(
          'transition-all hover:shadow-md',
          colors.bg,
          colors.border,
          'border-l-4',
          isMarked && 'opacity-70' // Slightly dim the card when marked as false positive
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 mt-0.5"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <InfoIcon className={cn('h-5 w-5', colors.text)} />
                  <Badge variant="outline" className={cn(colors.border, colors.text)}>
                    {getSeverityLabel(finding.severity)}
                  </Badge>
                  {isMarked && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-700">
                      {t('falsePositive')}
                    </Badge>
                  )}
                  <CardTitle className="text-lg">{finding.ruleId}</CardTitle>
                </div>

                <CardDescription className={cn('text-sm', colors.text)}>
                  {finding.message}
                </CardDescription>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {filename && (
                    <span className="font-mono">{filename}</span>
                  )}
                  <span>{t('line')} {finding.location.line}</span>
                  {finding.location.column > 0 && (
                    <span>{t('column')} {finding.location.column}</span>
                  )}
                  {finding.confidence !== undefined && (
                    <span className={cn('font-medium', colors.text)}>
                      {t('aiConfidence')}: {finding.confidence}%
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isMarked ? (
                // Show cancel button when already marked
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelFalsePositive}
                  disabled={isProcessing}
                  className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/40"
                  title={t('cancelFalsePositive')}
                >
                  {isProcessing ? (
                    <>
                      <X className="h-4 w-4 mr-1 animate-spin" />
                      {t('cancel')}...
                    </>
                  ) : (
                    <>
                      <X className="h-4 w-4 mr-1" />
                      {t('cancel')}
                    </>
                  )}
                </Button>
              ) : (
                // Show mark button when not marked
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAsFalsePositive}
                  disabled={isProcessing}
                  className="text-muted-foreground hover:text-orange-600 dark:hover:text-orange-400"
                  title={t('markAsFalsePositive')}
                >
                  {isProcessing ? (
                    <>
                      <Flag className="h-4 w-4 mr-1 animate-spin" />
                      {t('markAsFalsePositive')}...
                    </>
                  ) : (
                    <>
                      <Flag className="h-4 w-4 mr-1" />
                      {t('falsePositive')}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-0">
            {/* Code Snippet */}
            {finding.code && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t('codeContext')}</h4>
                <CodeSnippet
                  code={finding.code}
                  lineNumber={finding.location.line}
                  language="typescript"
                />
              </div>
            )}

            {/* AI Explanation */}
            {finding.explanation && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">{t('aiAnalysis')}</h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {finding.explanation}
                </p>
                {finding.confidence !== undefined && (
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full transition-all', colors.text.replace('text-', 'bg-'))}
                        style={{ width: `${finding.confidence}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {finding.confidence}% {t('aiConfidence').toLowerCase()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
