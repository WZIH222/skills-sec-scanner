'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  connectToJobProgress,
  type ScanProgressEvent,
  type ScanCompleteEvent,
  type ScanFailedEvent,
  type SSEConnectionState,
  testSSEAvailability,
} from '@/lib/sse-client'
import type { JobStatus } from '@/lib/scanner-client'

interface UseWebSocketOptions {
  /** Fallback to polling if SSE unavailable */
  enableFallback?: boolean
  /** Polling interval for fallback (ms) */
  pollInterval?: number
}

interface UseWebSocketReturn {
  /** Current progress (0-100) */
  progress: number
  /** Current stage label */
  stage: string
  /** Connection state */
  connectionState: SSEConnectionState
  /** Connection type ('sse' or 'polling') */
  connectionType: 'sse' | 'polling'
  /** Current job status */
  status: JobStatus | null
  /** Error message if any */
  error: string | null
  /** Whether scan is complete */
  isComplete: boolean
  /** Whether scan failed */
  isFailed: boolean
  /** Last scan result */
  result: any | null
}

/**
 * useWebSocket Hook
 *
 * Connects to SSE endpoint for real-time scan progress updates.
 * Falls back to polling if SSE is unavailable.
 *
 * @param jobId - Job ID to subscribe to
 * @param getToken - Function to get auth token
 * @param getStatus - Function to get job status (for polling fallback)
 * @param options - Configuration options
 * @returns Scan progress state
 */
export function useWebSocket(
  jobId: string | null,
  getToken?: () => string | null,  // Optional - now uses httpOnly cookies
  getStatus?: (jobId: string) => Promise<JobStatus>,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const { enableFallback = true, pollInterval = 2000 } = options

  const [progress, setProgress] = useState<number>(0)
  const [stage, setStage] = useState<string>('')
  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected')
  const [connectionType, setConnectionType] = useState<'sse' | 'polling'>('sse')
  const [status, setStatus] = useState<JobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isComplete, setIsComplete] = useState<boolean>(false)
  const [isFailed, setIsFailed] = useState<boolean>(false)
  const [result, setResult] = useState<any>(null)

  const cleanupRef = useRef<(() => void) | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef<boolean>(true)

  // Cleanup function
  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      if (cleanupRef.current) {
        cleanupRef.current()
        cleanupRef.current = null
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [])

  // Polling fallback function
  const startPolling = useCallback(async () => {
    if (!getStatus || !jobId) return

    setConnectionType('polling')
    setConnectionState('connected')

    const poll = async () => {
      if (!mountedRef.current || !jobId) return

      try {
        const jobStatus = await getStatus(jobId)

        if (!mountedRef.current) return

        setStatus(jobStatus)
        setProgress(jobStatus.progress)
        setStage(getStageLabel(jobStatus.progress))

        if (jobStatus.state === 'completed') {
          setIsComplete(true)
          setResult(jobStatus.result)
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
        } else if (jobStatus.state === 'failed') {
          setIsFailed(true)
          setError(jobStatus.failedReason || 'Scan failed')
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current)
            pollIntervalRef.current = null
          }
        }
      } catch (err) {
        if (mountedRef.current) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to get scan status'
          setError(errorMessage)
          setIsFailed(true)
        }
      }
    }

    // Initial poll
    poll()

    // Set up recurring polling
    pollIntervalRef.current = setInterval(poll, pollInterval)
  }, [jobId, getStatus, pollInterval])

  // Main effect: connect to SSE or fall back to polling
  useEffect(() => {
    if (!jobId) {
      // Reset state when no job ID
      setProgress(0)
      setStage('')
      setConnectionState('disconnected')
      setConnectionType('sse')
      setStatus(null)
      setError(null)
      setIsComplete(false)
      setIsFailed(false)
      setResult(null)
      return
    }

    // Test SSE availability
    testSSEAvailability().then((available) => {
      if (!available || !enableFallback) {
        // Fall back to polling
        startPolling()
        return
      }

      // Connect via SSE
      setConnectionType('sse')

      const cleanup = connectToJobProgress(jobId, {
        onProgress: (data: ScanProgressEvent) => {
          if (!mountedRef.current) return
          setProgress(data.progress)
          setStage(data.stage)
          setStatus({
            id: data.jobId,
            state: 'active',
            progress: data.progress,
            result: null,
            failedReason: null,
            processedOn: null,
            finishedOn: null,
          })
        },
        onComplete: (data: ScanCompleteEvent) => {
          if (!mountedRef.current) return
          setProgress(100)
          setStage('Complete!')
          setIsComplete(true)
          setResult(data.result)
          setStatus({
            id: data.jobId,
            state: 'completed',
            progress: 100,
            result: data.result,
            failedReason: null,
            processedOn: null,
            finishedOn: Date.now(),
          })
        },
        onError: (data: ScanFailedEvent) => {
          if (!mountedRef.current) return
          setIsFailed(true)
          setError(data.error)
          setStatus({
            id: data.jobId,
            state: 'failed',
            progress: 0,
            result: null,
            failedReason: data.error,
            processedOn: null,
            finishedOn: Date.now(),
          })

          // If connection error, try falling back to polling
          if (data.error.includes('connect') && enableFallback && getStatus) {
            console.warn('SSE connection failed, falling back to polling')
            startPolling()
          }
        },
        onStateChange: (state) => {
          if (!mountedRef.current) return
          setConnectionState(state)
        },
      })

      cleanupRef.current = cleanup
    })
  }, [jobId, getToken, enableFallback, getStatus, startPolling])

  return {
    progress,
    stage,
    connectionState,
    connectionType,
    status,
    error,
    isComplete,
    isFailed,
    result,
  }
}

/**
 * Get stage label based on progress percentage
 */
function getStageLabel(progress: number): string {
  if (progress < 20) return 'Parsing code...'
  if (progress < 40) return 'Analyzing patterns...'
  if (progress < 60) return 'Running data flow analysis...'
  if (progress < 80) return 'Calculating risk scores...'
  if (progress < 100) return 'Finalizing results...'
  return 'Complete!'
}
