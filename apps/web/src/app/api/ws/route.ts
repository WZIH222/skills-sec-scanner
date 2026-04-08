import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'
import { eventBus, type FolderProgressEvent, type FolderCompleteEvent } from '@/lib/sse-event-bus'
import { sseConnectionManager } from '@/lib/sse-connection'
import { RateLimiter, getRateLimitIdentifier } from '@/lib/rate-limiter'
import { getAllowedOrigins } from '@/lib/cors-validator'

/**
 * SSE Event Types
 */
interface SSEEvent {
  type: 'scan:started' | 'scan:progress' | 'scan:complete' | 'scan:failed' | 'folder:progress' | 'folder:complete'
  data: any
}

interface ScanProgressEvent {
  jobId: string
  progress: number
  stage: string
}

interface ScanCompleteEvent {
  jobId: string
  result: any
}

interface ScanFailedEvent {
  jobId: string
  error: string
}

/**
 * GET /api/ws
 *
 * Server-Sent Events endpoint for real-time scan progress updates
 *
 * Query parameters:
 * - jobId: The scan job ID to subscribe to
 * - token: Authentication token (optional, can also be in cookie or header)
 */
export async function GET(request: NextRequest) {
  // Verify authentication
  const authHeader = request.headers.get('Authorization')
  const url = new URL(request.url)
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : request.cookies?.get('auth-token')?.value

  if (!token) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = await verifyToken(token)

  if (!payload) {
    return new Response('Invalid token', { status: 401 })
  }

  // RATE-01: Apply rate limiting to SSE connection establishment
  const rateLimiter = new RateLimiter(30, 60000) // 30 SSE connects per minute
  const identifier = `sse:${payload.userId || 'anonymous'}`
  const isLimited = await rateLimiter.isRateLimited(identifier)
  if (isLimited) {
    return NextResponse.json(
      { error: 'Too many SSE connection attempts. Please wait.' },
      { status: 429 }
    )
  }

  // RATE-02: Check per-user SSE connection limit
  if (payload.userId) {
    const canConnect = await sseConnectionManager.acquireConnection(payload.userId)
    if (!canConnect) {
      return NextResponse.json(
        { error: 'Too many SSE connections. Only 1 connection allowed per user.' },
        { status: 429 }
      )
    }
  }

  // Get jobId from query parameters
  const jobId = url.searchParams.get('jobId')

  if (!jobId) {
    return new Response('Missing jobId parameter', { status: 400 })
  }

  // Query scan from database for actual results
  const scan = await prisma.scan.findFirst({
    where: {
      OR: [
        { fileId: jobId },
        { id: jobId },
      ],
    },
    include: {
      findings: {
        orderBy: { severity: 'desc' },
      },
    },
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: SSEEvent) => {
        const data = `data: ${JSON.stringify(event)}\n\n`
        controller.enqueue(encoder.encode(data))
      }

      // Check if this is a folder scan (has metadata with type: 'folder')
      const isFolderScan = scan?.metadata ? JSON.parse(scan.metadata).type === 'folder' : false

      if (isFolderScan) {
        // Folder scan: set up event listeners for real-time progress
        const folderProgressHandler = (data: FolderProgressEvent) => {
          if (data.jobId === jobId) {
            sendEvent({
              type: 'folder:progress',
              data: {
                jobId: data.jobId,
                fileId: data.fileId,
                filename: data.filename,
                completed: data.completed,
                total: data.total,
                score: data.score,
              },
            })
          }
        }

        const folderCompleteHandler = (data: FolderCompleteEvent) => {
          if (data.jobId === jobId) {
            sendEvent({
              type: 'folder:complete',
              data: {
                jobId: data.jobId,
                summary: data.summary,
              },
            })
            // Close connection after folder complete
            controller.close()
          }
        }

        // Register event handlers
        eventBus.on('folder:progress', folderProgressHandler)
        eventBus.on('folder:complete', folderCompleteHandler)

        // Refresh SSE connection TTL every 60 seconds
        if (payload.userId) {
          sseConnectionManager.refreshConnection(payload.userId)
        }
        const heartbeatInterval = setInterval(() => {
          if (payload.userId) {
            sseConnectionManager.refreshConnection(payload.userId)
          }
        }, 60000)

        // Clean up listeners on connection close
        const cleanup = () => {
          eventBus.removeListener('folder:progress', folderProgressHandler)
          eventBus.removeListener('folder:complete', folderCompleteHandler)
          clearInterval(heartbeatInterval)
          if (payload.userId) {
            sseConnectionManager.releaseConnection(payload.userId)
          }
        }

        // Track if controller has been closed to prevent double-close
        let isClosed = false

        // Safe close function that prevents double-close
        const safeClose = () => {
          if (!isClosed) {
            isClosed = true
            cleanup()
            clearTimeout(timeout)
            clearInterval(heartbeatInterval)
            try {
              controller.close()
            } catch (e) {
              // Ignore errors if controller already closed
            }
          }
        }

        // Set up timeout to close connection if no events received
        const timeout = setTimeout(() => {
          safeClose()
        }, 300000) // 5 minutes

        // Override controller.close to use safeClose
        const originalClose = controller.close.bind(controller)
        controller.close = () => safeClose()
      } else {
        // Single file scan: send immediate result
        if (scan) {
          // Send complete event with actual scan data
          sendEvent({
            type: 'scan:complete',
            data: {
              jobId,
              result: {
                id: scan.fileId || scan.id,
                filename: scan.filename,
                score: scan.score,
                findings: scan.findings,
                scannedAt: scan.scannedAt,
                scanDuration: scan.scanDuration,
              },
            },
          })
        } else {
          // Scan not found (may still be processing or invalid ID)
          sendEvent({
            type: 'scan:failed',
            data: {
              jobId,
              error: 'Scan not found',
            },
          })
        }

        // Close connection after sending event
        if (payload.userId) {
          sseConnectionManager.releaseConnection(payload.userId)
        }
        controller.close()
      }
    },
  })

  // Return SSE response with appropriate headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': (() => {
        const origin = request.headers.get('origin')
        const allowedOrigins = getAllowedOrigins()
        if (!origin || !allowedOrigins.includes(origin)) {
          // Return a dummy origin that will cause browser CORS error
          // Never return '*' or empty string which bypasses CORS security
          return 'null' // Browser will block with CORS error
        }
        return origin
      })(),
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  })
}
