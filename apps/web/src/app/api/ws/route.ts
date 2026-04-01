import { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'
import { eventBus, type FolderProgressEvent, type FolderCompleteEvent } from '@/lib/sse-event-bus'

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
    || url.searchParams.get('token')

  if (!token) {
    return new Response('Unauthorized', { status: 401 })
  }

  const payload = await verifyToken(token)

  if (!payload) {
    return new Response('Invalid token', { status: 401 })
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

        // Clean up listeners on connection close
        const cleanup = () => {
          eventBus.removeListener('folder:progress', folderProgressHandler)
          eventBus.removeListener('folder:complete', folderCompleteHandler)
        }

        // Track if controller has been closed to prevent double-close
        let isClosed = false

        // Safe close function that prevents double-close
        const safeClose = () => {
          if (!isClosed) {
            isClosed = true
            cleanup()
            clearTimeout(timeout)
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
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  })
}
