import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'

/**
 * GET /api/scans/[id]
 *
 * Retrieve scan result by scan ID
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

    // Query scan from database (try fileId first, then id for backward compatibility)
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
        // Include child files for folder scans
        files: {
          include: {
            findings: {
              orderBy: { severity: 'desc' },
            },
          },
        },
      },
    })

    if (!scan) {
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      )
    }

    // Verify user owns this scan (userId stored in metadata JSON string)
    const authMetadata = scan.metadata ? JSON.parse(scan.metadata) : {}
    const scanUserId = authMetadata.userId
    if (!scanUserId || scanUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Query user's false positives to mark findings
    const userFalsePositives = await prisma.falsePositive.findMany({
      where: { userId },
      select: {
        ruleId: true,
        codeHash: true,
      },
    })

    // Create a Set for quick lookup: "ruleId:codeHash"
    const falsePositiveSet = new Set(
      userFalsePositives.map(fp => `${fp.ruleId}:${fp.codeHash}`)
    )

    // Add isFalsePositive flag to each finding
    const { createHash } = await import('crypto')

    // Check if this is a folder scan
    const metadata = scan.metadata ? JSON.parse(scan.metadata) : {}
    const isFolderScan = metadata.type === 'folder'

    let findingsWithStatus = scan.findings
    let responseScan: any = { ...scan }

    if (isFolderScan && scan.files && scan.files.length > 0) {
      // Folder scan: aggregate findings from all child files
      const allFindings: any[] = []

      for (const file of scan.files) {
        for (const finding of file.findings) {
          const codeHash = createHash('sha256').update(finding.code || '').digest('hex')
          const isFalsePositive = falsePositiveSet.has(`${finding.ruleId}:${codeHash}`)

          allFindings.push({
            ...finding,
            isFalsePositive,
            // Add file context for folder scans
            filename: file.filename,
            fileId: file.id,
          })
        }
      }

      findingsWithStatus = allFindings

      // Add folder metadata to response
      responseScan = {
        ...scan,
        findings: allFindings,
        fileCount: scan.files.length,
        files: scan.files.map(f => ({
          id: f.id,
          filename: f.filename,
          score: f.score,
          findingCount: f.findings.length,
        })),
      }
    } else {
      // Single file scan: add isFalsePositive flag
      findingsWithStatus = scan.findings.map(finding => {
        const codeHash = createHash('sha256').update(finding.code || '').digest('hex')
        const isFalsePositive = falsePositiveSet.has(`${finding.ruleId}:${codeHash}`)
        return {
          ...finding,
          isFalsePositive,
        }
      })

      responseScan = {
        ...scan,
        findings: findingsWithStatus,
      }
    }

    return NextResponse.json(responseScan, { status: 200 })
  } catch (error) {
    console.error('Scan retrieval error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/scans/[id]
 *
 * Delete a scan by scan ID
 */
export async function DELETE(
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

    // Query scan to verify ownership (try fileId first, then id for backward compatibility)
    const scan = await prisma.scan.findFirst({
      where: {
        OR: [
          { fileId: scanId },
          { id: scanId },
        ],
      },
    })

    if (!scan) {
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      )
    }

    // Verify user owns this scan (userId stored in metadata JSON string)
    const authMetadata = scan.metadata ? JSON.parse(scan.metadata) : {}
    const scanUserId = authMetadata.userId
    if (!scanUserId || scanUserId !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Delete scan (findings will be cascade deleted)
    await prisma.scan.delete({
      where: { id: scan.id }, // Use the actual database ID from the found scan
    })

    return NextResponse.json(
      { message: 'Scan deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Scan deletion error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
