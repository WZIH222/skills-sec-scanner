import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'

/**
 * GET /api/scans/[id]/status
 *
 * Retrieve scan job status and progress
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    const params = await context.params
    const jobId = params.id
    const userId = payload?.userId

    // Query scan from database (try fileId first, then id for backward compatibility)
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

    if (!scan) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Verify user owns this scan
    const scanUserId = (scan as any).userId || (typeof scan.metadata === 'object' ? (scan.metadata as any)?.userId : null)
    if (scanUserId && scanUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Return job status (completed state for synchronous scans)
    return NextResponse.json({
      id: scan.fileId || scan.id,
      state: 'completed',
      progress: 100,
      result: {
        id: scan.fileId || scan.id,
        filename: scan.filename,
        score: scan.score,
        findings: scan.findings,
        scannedAt: scan.scannedAt,
        scanDuration: scan.scanDuration,
      },
      failedReason: null,
      processedOn: scan.scannedAt.getTime(),
      finishedOn: scan.scannedAt.getTime(),
    }, { status: 200 })
  } catch (error) {
    console.error('Job status retrieval error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
