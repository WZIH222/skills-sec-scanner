import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'
import { createHash } from 'crypto'

/**
 * POST /api/scans/[id]/findings/[findingId]/false-positive
 *
 * Mark a finding as false positive (excluded from future scans)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    // 1. Validate JWT and extract userId
    // Support both Authorization header and cookie (for client-side requests)
    const authHeader = request.headers.get('authorization')
    const cookieToken = request.cookies.get('auth-token')?.value

    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : cookieToken

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const userId = payload.userId

    // 2. Await params and get the scan and finding
    const { id, findingId } = await params
    const scan = await prisma.scan.findUnique({
      where: { id },
      include: { findings: true }
    })

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
    }

    // 3. Verify scan ownership (check if scan belongs to user)
    // Note: Scans don't have userId directly, so we'll use metadata or check findings
    // For now, we'll allow any authenticated user to mark false positives
    // In production, you'd want to add userId to Scan model or check metadata

    // 4. Get the finding
    const finding = scan.findings.find(f => f.id === findingId)
    if (!finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    // 5. Calculate codeHash from finding code
    const codeHash = createHash('sha256').update(finding.code || '').digest('hex')

    console.log('[False Positive] Upserting record:', {
      userId,
      ruleId: finding.ruleId,
      codeHash,
      filePath: scan.filename,
      lineNumber: finding.line
    })

    // 6. Create or get existing FalsePositive record (upsert)
    // If already marked as false positive, just return success
    const falsePositive = await prisma.falsePositive.upsert({
      where: {
        userId_codeHash_ruleId: {
          userId,
          codeHash,
          ruleId: finding.ruleId
        }
      },
      update: {}, // No updates needed if exists
      create: {
        userId,
        ruleId: finding.ruleId,
        codeHash,
        filePath: scan.filename, // Use scan filename as filePath
        lineNumber: finding.line
      }
    })

    console.log('[False Positive] Upserted:', falsePositive)

    // 7. Return success
    return NextResponse.json(
      {
        success: true,
        id: falsePositive.id,
        message: 'Finding marked as false positive'
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[False Positive] Error:', error)
    // Log more details for debugging
    if (error instanceof Error) {
      console.error('[False Positive] Error message:', error.message)
      console.error('[False Positive] Error stack:', error.stack)
    }
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/scans/[id]/findings/[findingId]/false-positive
 *
 * Remove false positive marking (finding will appear in future scans)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  try {
    // 1. Validate JWT and extract userId
    // Support both Authorization header and cookie (for client-side requests)
    const authHeader = request.headers.get('authorization')
    const cookieToken = request.cookies.get('auth-token')?.value

    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : cookieToken

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyToken(token)

    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const userId = payload.userId

    // 2. Await params and get the finding to calculate codeHash
    const { id, findingId } = await params
    const scan = await prisma.scan.findUnique({
      where: { id },
      include: { findings: true }
    })

    if (!scan) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 })
    }

    const finding = scan.findings.find(f => f.id === findingId)
    if (!finding) {
      return NextResponse.json({ error: 'Finding not found' }, { status: 404 })
    }

    // 3. Calculate codeHash to match FalsePositive record
    const codeHash = createHash('sha256').update(finding.code || '').digest('hex')

    // 4. Delete FalsePositive record matching userId, codeHash, and ruleId
    const deleted = await prisma.falsePositive.deleteMany({
      where: {
        userId,
        codeHash,
        ruleId: finding.ruleId
      }
    })

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: 'False positive not found' },
        { status: 404 }
      )
    }

    // 5. Return success
    return NextResponse.json({
      success: true,
      message: 'False positive removed'
    })
  } catch (error) {
    console.error('Error removing false positive:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
