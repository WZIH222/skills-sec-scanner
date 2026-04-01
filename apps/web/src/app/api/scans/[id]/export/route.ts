import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'
import { convertToSarifJson, convertToJson } from '@/lib/sarif-converter'

/**
 * GET /api/scans/[id]/export
 *
 * Export scan result in JSON or SARIF format
 * Query params: format (json|sarif)
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

    const userId = payload.userId
    const params = await context.params
    const scanId = params.id

    // Parse format query parameter
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    if (format !== 'json' && format !== 'sarif') {
      return NextResponse.json(
        { error: 'Invalid format. Use "json" or "sarif"' },
        { status: 400 }
      )
    }

    // Query scan from database - scanId can be either the database id or fileId
    const scan = await prisma.scan.findFirst({
      where: {
        OR: [
          { id: scanId },
          { fileId: scanId },
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
        { error: 'Scan not found' },
        { status: 404 }
      )
    }

    // Verify user owns this scan (check in metadata JSON)
    let scanUserId: string | null = null
    if (scan.metadata) {
      try {
        const metadata = typeof scan.metadata === 'string' ? JSON.parse(scan.metadata) : scan.metadata
        scanUserId = metadata.userId || null
      } catch {
        // If metadata parsing fails, continue without userId check
      }
    }

    if (scanUserId && scanUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Convert scan result to appropriate format
    let content: string
    let contentType = 'application/json'
    let fileExtension: string

    if (format === 'sarif') {
      content = convertToSarifJson(scan as any)
      fileExtension = 'sarif'
    } else {
      content = convertToJson(scan as any)
      fileExtension = 'json'
    }

    // Generate filename with timestamp
    const timestamp = new Date(scan.scannedAt).toISOString().replace(/[:.]/g, '-')
    const filename = `scan-${scanId.substring(0, 8)}-${timestamp}.${fileExtension}`

    // Return file download response
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Scan export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
