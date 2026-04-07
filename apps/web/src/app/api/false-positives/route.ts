import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'
import { parsePageParams, assertUUID } from '@/lib/api-utils'

/**
 * GET /api/false-positives
 *
 * List user's false positive exclusions with pagination
 */
export async function GET(request: NextRequest) {
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
    assertUUID(userId, 'userId')

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url)
    const { page, limit } = parsePageParams(searchParams)
    const skip = (page - 1) * limit

    // 3. Query user's false positives with pagination
    const [falsePositives, totalCount] = await Promise.all([
      prisma.falsePositive.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.falsePositive.count({
        where: { userId }
      })
    ])

    // 4. Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit)

    // 5. Return paginated results
    return NextResponse.json({
      falsePositives,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })
  } catch (error) {
    console.error('Error listing false positives:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/false-positives
 *
 * Delete all false positives for the current user (bulk delete)
 */
export async function DELETE(request: NextRequest) {
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

    // 2. Delete all false positives for the user
    const deleted = await prisma.falsePositive.deleteMany({
      where: { userId }
    })

    return NextResponse.json({
      success: true,
      message: `Removed ${deleted.count} false positive(s)`
    })
  } catch (error) {
    console.error('Error clearing false positives:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
