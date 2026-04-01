import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'
import { convertToSarifJson } from '@/lib/sarif-converter'

/**
 * GET /api/scans/[id]/sarif
 *
 * Export scan result in SARIF 2.1.0 format
 * Returns SARIF JSON with proper Content-Type for CI/CD integration
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

    // Query scan from database
    const scan = await prisma.scan.findFirst({
      where: {
        OR: [
          { fileId: scanId },
          { id: scanId },
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

    // Verify user owns this scan (check in metadata or userId field)
    const scanUserId = (scan as any).userId || (typeof scan.metadata === 'object' ? (scan.metadata as any)?.userId : null)
    if (scanUserId && scanUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Convert scan result to SARIF 2.1.0 format
    const sarifJson = convertToSarifJson(scan as any)

    // Generate filename with timestamp
    const timestamp = new Date(scan.scannedAt).toISOString().replace(/[:.]/g, '-')
    const filename = `scan-${scan.id.substring(0, 8)}-${timestamp}.sarif`

    // Return SARIF with proper Content-Type
    return new NextResponse(sarifJson, {
      status: 200,
      headers: {
        'Content-Type': 'application/sarif+json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('SARIF export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
