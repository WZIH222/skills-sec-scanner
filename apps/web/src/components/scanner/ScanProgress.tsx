'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useWebSocket } from '@/hooks/useWebSocket'
import { X, Loader2, Wifi, WifiOff } from 'lucide-react'

interface ScanProgressProps {
  jobId: string
  getToken?: () => string | null  // Optional - now uses httpOnly cookies
  getStatus?: (jobId: string) => Promise<any>
  onCancel?: () => void
}

/**
 * ScanProgress Component
 *
 * Displays real-time scan progress using SSE (Server-Sent Events)
 * with automatic fallback to polling if SSE is unavailable.
 */
export function ScanProgress({
  jobId,
  getToken,
  getStatus,
  onCancel,
}: ScanProgressProps) {
  const router = useRouter()

  const {
    progress,
    stage,
    connectionState,
    connectionType,
    status,
    error,
    isComplete,
    isFailed,
    result,
  } = useWebSocket(jobId, getToken, getStatus, {
    enableFallback: true,
    pollInterval: 2000,
  })

  // Auto-redirect to results page after completion
  useEffect(() => {
    if (isComplete && result?.id) {
      const redirectTimer = setTimeout(() => {
        router.push(`/scans/${result.id}`)
      }, 1000)

      return () => clearTimeout(redirectTimer)
    }
  }, [isComplete, result, router])

  const handleCancel = async () => {
    if (onCancel) {
      onCancel()
    }
  }

  if (!status && !error) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {connectionState === 'connecting' ? 'Connecting...' : 'Initializing scan...'}
          </p>
        </div>
      </Card>
    )
  }

  if (isFailed) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-destructive">Scan Failed</h3>
              <p className="text-sm text-muted-foreground">Job ID: {jobId}</p>
            </div>
          </div>

          {/* Error Message */}
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      </Card>
    )
  }

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `~${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `~${mins}m ${secs}s`
  }

  // Calculate estimated time remaining
  const calculateEstimatedTime = (): number | null => {
    if (!status || status.progress <= 0 || status.progress >= 100) {
      return null
    }

    const elapsed = Date.now() - (status.processedOn || Date.now())
    const rate = status.progress / elapsed
    const remaining = (100 - status.progress) / rate

    return Math.round(remaining / 1000) // seconds
  }

  const estimatedTime = calculateEstimatedTime()

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {isComplete ? 'Scan Complete!' : 'Scanning in progress...'}
            </h3>
            <p className="text-sm text-muted-foreground">Job ID: {jobId}</p>
          </div>

          <div className="flex items-center space-x-2">
            {/* Connection Status Badge */}
            <Badge
              variant={connectionType === 'sse' ? 'default' : 'secondary'}
              className="flex items-center space-x-1"
            >
              {connectionType === 'sse' ? (
                <>
                  <Wifi className="h-3 w-3" />
                  <span className="text-xs">Live</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  <span className="text-xs">Polling</span>
                </>
              )}
            </Badge>

            {/* Cancel Button */}
            {!isComplete && !isFailed && onCancel && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCancel}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{stage}</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Estimated Time */}
        {estimatedTime !== null && estimatedTime > 0 && !isComplete && (
          <p className="text-xs text-muted-foreground">
            Estimated time remaining: {formatTime(estimatedTime)}
          </p>
        )}

        {/* Status Indicators */}
        <div className="flex items-center space-x-2 text-sm">
          {status?.state === 'waiting' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Queued...</span>
            </>
          )}
          {status?.state === 'active' && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-primary">Processing...</span>
            </>
          )}
          {isComplete && (
            <>
              <span className="text-green-500">✓</span>
              <span className="text-green-500 font-medium">
                Redirecting to results...
              </span>
            </>
          )}
        </div>

        {/* Connection Status */}
        {connectionState === 'connecting' && (
          <p className="text-xs text-muted-foreground">
            {connectionType === 'sse' ? 'Connecting to live updates...' : 'Connecting...'}
          </p>
        )}
      </div>
    </Card>
  )
}
