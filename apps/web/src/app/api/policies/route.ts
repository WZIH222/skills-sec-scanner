import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'

/**
 * GET /api/policies
 *
 * Retrieve user's organization policy
 */
export async function GET(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : request.cookies.get('auth-token')?.value

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

    // Get user with organization and policy
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          include: {
            policy: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Auto-create organization if user doesn't have one
    if (!user.organization) {
      const newOrg = await prisma.organization.create({
        data: {
          name: `${user.name || user.email}'s Organization`,
          policy: {
            create: {
              mode: 'MODERATE',
            },
          },
        },
      })

      await prisma.user.update({
        where: { id: userId },
        data: { organizationId: newOrg.id },
      })

      // Re-fetch user with organization
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { organization: { include: { policy: true } } },
      })

      if (updatedUser?.organization) {
        user.organization = updatedUser.organization
      }
    }

    // Check if user is admin (first user in org is admin)
    const orgUsers = await prisma.user.count({
      where: { organizationId: user.organizationId },
    })
    const isAdmin = user.organization?.createdAt && user.createdAt === user.organization.createdAt ||
                    (user as any).role === 'ADMIN'

    const policy = user.organization?.policy || {
      id: '',
      mode: 'MODERATE',
      organizationId: user.organizationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    return NextResponse.json({
      policy: {
        id: policy.id,
        mode: policy.mode,
        organizationId: policy.organizationId,
      },
      canOverride: !isAdmin, // Non-admins can set personal override
      isAdmin,
    }, { status: 200 })
  } catch (error) {
    console.error('Policy retrieval error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/policies
 *
 * Update organization's policy mode (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : request.cookies.get('auth-token')?.value

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

    // Get user with organization
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          include: {
            policy: true,
          },
        },
      },
    })

    if (!user || !user.organization) {
      return NextResponse.json(
        { error: 'User or organization not found' },
        { status: 404 }
      )
    }

    // Check if user is admin
    const orgUsers = await prisma.user.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { createdAt: 'asc' },
    })
    const isAdmin = orgUsers[0]?.id === user.id || (user as any).role === 'ADMIN'

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { mode } = body

    // Validate mode
    const validModes = ['STRICT', 'MODERATE', 'PERMISSIVE']
    if (!mode || !validModes.includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid policy mode. Must be STRICT, MODERATE, or PERMISSIVE' },
        { status: 400 }
      )
    }

    // Update or create policy
    let policy
    if (user.organization.policy) {
      policy = await prisma.policy.update({
        where: { id: user.organization.policy.id },
        data: { mode },
      })
    } else {
      policy = await prisma.policy.create({
        data: {
          mode,
          organizationId: user.organizationId!,
        },
      })
    }

    return NextResponse.json({
      policy: {
        id: policy.id,
        mode: policy.mode,
        organizationId: policy.organizationId,
      },
    }, { status: 200 })
  } catch (error) {
    console.error('Policy update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
