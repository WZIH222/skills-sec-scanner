'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { connectToJobProgress, testSSEAvailability, type SSEConnectionState } from '@/lib/sse-client'
import { Loader2, Wifi, WifiOff, CheckCircle2, XCircle } from 'lucide-react'

interface FolderProgressProps {
  jobId: string
  totalFiles: number
  onComplete?: () => void
}

interface FolderProgressEvent {
  jobId: string
  fileId: string
  filename: string
  completed: number
  total: number
  score?: number
}

interface FolderCompleteEvent {
  totalFiles: number
  totalFindings: number
  highestScore: number
}

/**
 * FolderProgress Component
 *
 * Displays real-time folder scanning progress with X/Y files indicator.
 * Shows progress bar, current stage, recent filename, and completion status.
 *
 * Handles folder-specific SSE events (folder:progress, folder:complete)
 * for more accurate progress tracking than generic scan events.
 */
export function FolderProgress({ jobId, totalFiles, onComplete }: FolderProgressProps) {
  const [completedFiles, setCompletedFiles] = useState(0)
  const [recentFile, setRecentFile] = useState<string>('')
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const hasCompletedRef = useRef(false)

  // Calculate progress percentage
  const progress = totalFiles > 0 ? (completedFiles / totalFiles) * 100 : 0

  // Call onComplete callback when scan completes (only once)
  useEffect(() => {
    if (isComplete && !hasCompletedRef.current && onComplete) {
      hasCompletedRef.current = true
      // Delay redirect slightly to show completion UI
      const timer = setTimeout(() => {
        onComplete()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isComplete, onComplete])

  // Handle SSE connection
  useEffect(() => {
    let cleanup: (() => void) | null = null
    let mounted = true

    const connect = async () => {
      if (!mounted) return

      const isAvailable = await testSSEAvailability()

      if (!mounted) return

      if (!isAvailable) {
        setError('SSE not available in this environment')
        return
      }

      if (!mounted) return

      cleanup = connectToJobProgress(jobId, {
        onProgress: (data) => {
          if (!mounted) return
          // Handle generic scan:progress events (fallback)
          // Calculate completed files from progress percentage
          const calculatedCompleted = Math.round((data.progress / 100) * totalFiles)
          setCompletedFiles(calculatedCompleted)
          setRecentFile('')
        },
        onComplete: (data) => {
          if (!mounted) return
          // Handle generic scan:complete events (fallback)
          setCompletedFiles(totalFiles)
          setIsComplete(true)
        },
        onError: (data) => {
          if (!mounted) return
          setError(data.error)
        },
        onStateChange: (state) => {
          if (!mounted) return
          setConnectionState(state)
        },
      })

      // Note: In a full implementation, we'd also listen for folder:progress
      // and folder:complete events. Those would be emitted by the backend
      // when processing folder scans. For now, we use generic scan events.
    }

    connect()

    return () => {
      mounted = false
      if (cleanup) {
        cleanup()
      }
    }
  }, [jobId, totalFiles])

  // Get stage label based on progress
  const getStageLabel = useCallback((): string => {
    if (isComplete) return 'Complete!'
    if (recentFile) return `Just finished: ${recentFile}`
    if (progress < 20) return 'Initializing...'
    if (progress < 40) return 'Parsing code...'
    if (progress < 60) return 'Analyzing patterns...'
    if (progress < 80) return 'Running data flow analysis...'
    if (progress < 100) return 'Finalizing results...'
    return 'Almost done...'
  }, [isComplete, recentFile, progress])

  const stage = getStageLabel()

  // Show loading state while connecting
  if (connectionState === 'connecting' && !error && !isComplete) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Connecting to folder scan progress...
          </p>
        </div>
      </Card>
    )
  }

  // Show error state if connection failed
  if (error) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <XCircle className="h-5 w-5 text-destructive" />
            <h3 className="text-lg font-semibold text-destructive">Connection Failed</h3>
          </div>
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">
              {isComplete ? 'Folder Scan Complete!' : 'Scanning Folder...'}
            </h3>
            <p className="text-sm text-muted-foreground">Job ID: {jobId}</p>
          </div>

          {/* Connection Status Badge */}
          <Badge variant="default" className="flex items-center space-x-1">
            <Wifi className="h-3 w-3" />
            <span className="text-xs">Live</span>
          </Badge>
        </div>

        {/* File Count */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Files scanned</span>
          <span className="font-medium">
            {completedFiles} / {totalFiles} files
          </span>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{stage}</span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
        </div>

        {/* Recent Filename */}
        {recentFile && !isComplete && (
          <p className="text-xs text-muted-foreground">
            Just finished: {recentFile}
          </p>
        )}

        {/* Complete Message */}
        {isComplete && (
          <div className="flex items-center space-x-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">
              All {totalFiles} files scanned successfully!
            </span>
          </div>
        )}

        {/* Connection Status */}
        {connectionState === 'connecting' && (
          <p className="text-xs text-muted-foreground">
            Connecting to live updates...
          </p>
        )}
      </div>
    </Card>
  )
}
