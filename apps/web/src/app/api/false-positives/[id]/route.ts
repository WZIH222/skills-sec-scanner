import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'

/**
 * DELETE /api/false-positives/[id]
 *
 * Delete a specific false positive by its ID
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Validate JWT and extract userId
    const authHeader = request.headers.get('Authorization')
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
    const { id } = await params

    // 2. Delete the false positive record
    const deleted = await prisma.falsePositive.deleteMany({
      where: {
        id,
        userId // Ensure user owns this record
      }
    })

    if (deleted.count === 0) {
      return NextResponse.json(
        { error: 'False positive not found or access denied' },
        { status: 404 }
      )
    }

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