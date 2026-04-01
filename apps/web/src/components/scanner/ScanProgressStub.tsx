'use client'

import React, { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { JobStatus } from '@/lib/scanner-client'
import { X, Loader2 } from 'lucide-react'

interface ScanProgressStubProps {
  jobId: string
  onComplete: (result: any) => void
  onError: (error: string) => void
  onCancel?: () => void
  getStatus: (jobId: string) => Promise<JobStatus>
}

/**
 * ScanProgressStub Component
 *
 * Displays scan progress with polling-based updates
 * Temporary component - will be replaced with WebSocket version in Plan 02a
 */
export function ScanProgressStub({
  jobId,
  onComplete,
  onError,
  onCancel,
  getStatus,
}: ScanProgressStubProps) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [estimatedTime, setEstimatedTime] = useState<number>(0)

  useEffect(() => {
    let mounted = true
    let interval: NodeJS.Timeout | null = null

    const pollStatus = async () => {
      try {
        const jobStatus = await getStatus(jobId)

        if (!mounted) return

        setStatus(jobStatus)

        // Calculate estimated time remaining
        if (jobStatus.progress > 0 && jobStatus.progress < 100) {
          const elapsed = Date.now() - (jobStatus.processedOn || Date.now())
          const rate = jobStatus.progress / elapsed
          const remaining = (100 - jobStatus.progress) / rate
          setEstimatedTime(Math.round(remaining / 1000)) // seconds
        }

        // Check if completed
        if (jobStatus.state === 'completed') {
          if (interval) clearInterval(interval)
          onComplete(jobStatus.result)
        } else if (jobStatus.state === 'failed') {
          if (interval) clearInterval(interval)
          onError(jobStatus.failedReason || 'Scan failed')
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to get scan status'
          onError(errorMessage)
        }
        if (interval) clearInterval(interval)
      }
    }

    // Initial poll
    pollStatus()

    // Poll every 2 seconds
    interval = setInterval(pollStatus, 2000)

    return () => {
      mounted = false
      if (interval) clearInterval(interval)
    }
  }, [jobId, getStatus, onComplete, onError])

  if (!status) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Initializing scan...</p>
        </div>
      </Card>
    )
  }

  const getStageLabel = (progress: number): string => {
    if (progress < 20) return 'Parsing code...'
    if (progress < 40) return 'Analyzing patterns...'
    if (progress < 60) return 'Running data flow analysis...'
    if (progress < 80) return 'Calculating risk scores...'
    if (progress < 100) return 'Finalizing results...'
    return 'Complete!'
  }

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `~${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `~${mins}m ${secs}s`
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Scanning in progress...</h3>
            <p className="text-sm text-muted-foreground">
              Job ID: {jobId}
            </p>
          </div>
          {onCancel && status.state !== 'completed' && status.state !== 'failed' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {getStageLabel(status.progress)}
            </span>
            <span className="font-medium">{status.progress}%</span>
          </div>
          <Progress value={status.progress} />
        </div>

        {/* Estimated Time */}
        {estimatedTime > 0 && status.state === 'active' && (
          <p className="text-xs text-muted-foreground">
            Estimated time remaining: {formatTime(estimatedTime)}
          </p>
        )}

        {/* Status Indicators */}
        <div className="flex items-center space-x-2 text-sm">
          {status.state === 'waiting' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Queued...</span>
            </>
          )}
          {status.state === 'active' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-primary">Processing...</span>
            </>
          )}
          {status.state === 'completed' && (
            <>
              <span className="text-green-500">✓</span>
              <span className="text-green-500">Complete!</span>
            </>
          )}
          {status.state === 'failed' && (
            <>
              <span className="text-destructive">✕</span>
              <span className="text-destructive">Failed</span>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
