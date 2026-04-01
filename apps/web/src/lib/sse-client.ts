/**
 * SSE (Server-Sent Events) Client
 *
 * Client utility for connecting to SSE endpoint and receiving real-time scan progress updates
 */

export interface SSEEvent {
  type: 'scan:started' | 'scan:progress' | 'scan:complete' | 'scan:failed'
  data: ScanProgressEvent | ScanCompleteEvent | ScanFailedEvent
}

export interface ScanProgressEvent {
  jobId: string
  progress: number
  stage: string
}

export interface ScanCompleteEvent {
  jobId: string
  result: any
}

export interface ScanFailedEvent {
  jobId: string
  error: string
}

export type SSEConnectionState = 'connecting' | 'connected' | 'disconnected'

/**
 * Connect to job progress SSE endpoint
 *
 * @param jobId - Job ID to subscribe to
 * @param getToken - Optional function to get auth token (no longer needed - uses httpOnly cookies)
 * @param callbacks - Event callbacks
 * @returns Cleanup function to disconnect
 */
export function connectToJobProgress(
  jobId: string,
  callbacks: {
    onProgress?: (data: ScanProgressEvent) => void
    onComplete?: (data: ScanCompleteEvent) => void
    onError?: (data: ScanFailedEvent) => void
    onStateChange?: (state: SSEConnectionState) => void
  },
  getToken?: () => string | null  // Optional - kept for backward compatibility (unused)
): () => void {
  // Note: getToken is no longer used - httpOnly cookies are sent automatically via withCredentials
  getToken  // eslint-disable-line @typescript-eslint/no-unused-vars

  const url = new URL(`/api/ws?jobId=${encodeURIComponent(jobId)}`, window.location.origin)

  let eventSource: EventSource | null = null
  let reconnectTimeout: NodeJS.Timeout | null = null
  let reconnectAttempts = 0
  const MAX_RECONNECT_ATTEMPTS = 5

  const connect = () => {
    try {
      callbacks.onStateChange?.('connecting')

      eventSource = new EventSource(url.toString(), {
        withCredentials: true,
      })

      eventSource.onopen = () => {
        reconnectAttempts = 0
        callbacks.onStateChange?.('connected')
      }

      eventSource.onmessage = (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data)

          switch (data.type) {
            case 'scan:progress':
              callbacks.onProgress?.(data.data as ScanProgressEvent)
              break
            case 'scan:complete':
              callbacks.onComplete?.(data.data as ScanCompleteEvent)
              // Close connection on completion
              eventSource?.close()
              callbacks.onStateChange?.('disconnected')
              break
            case 'scan:failed':
              callbacks.onError?.(data.data as ScanFailedEvent)
              // Close connection on failure
              eventSource?.close()
              callbacks.onStateChange?.('disconnected')
              break
          }
        } catch (error) {
          console.error('Failed to parse SSE event:', error)
        }
      }

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error)

        // Attempt reconnection with exponential backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++
          const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000)

          reconnectTimeout = setTimeout(() => {
            eventSource?.close()
            connect()
          }, backoffDelay)
        } else {
          callbacks.onError?.({
            jobId,
            error: 'Failed to connect to server',
          })
          eventSource?.close()
          callbacks.onStateChange?.('disconnected')
        }
      }
    } catch (error) {
      console.error('Failed to create EventSource:', error)
      callbacks.onError?.({
        jobId,
        error: 'Failed to establish connection',
      })
      callbacks.onStateChange?.('disconnected')
    }
  }

  // Start connection
  connect()

  // Return cleanup function
  return () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    if (eventSource) {
      eventSource.close()
      eventSource = null
    }
    callbacks.onStateChange?.('disconnected')
  }
}

/**
 * Test SSE connection availability
 *
 * @returns Promise<boolean> - true if SSE is available
 */
export async function testSSEAvailability(): Promise<boolean> {
  return typeof EventSource !== 'undefined'
}
