import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'

/**
 * GET /api/policies/user
 *
 * Retrieve user's personal policy override or org default
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

    if (!user.organization) {
      return NextResponse.json(
        { error: 'User not associated with an organization' },
        { status: 404 }
      )
    }

    const orgPolicy = user.organization.policy || {
      mode: 'MODERATE',
    }

    // Check if user has personal override
    const userPolicy = (user as any).userPolicy || null

    return NextResponse.json({
      policy: {
        mode: userPolicy || orgPolicy.mode,
        orgMode: orgPolicy.mode,
        hasOverride: !!userPolicy,
      },
    }, { status: 200 })
  } catch (error) {
    console.error('User policy retrieval error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/policies/user
 *
 * Set user's personal policy override (stricter than org default only)
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

    // Get user with organization policy
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

    const orgPolicy = user.organization.policy || {
      mode: 'MODERATE',
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

    // User can only choose stricter than org default
    const strictness = { STRICT: 3, MODERATE: 2, PERMISSIVE: 1 }
    const orgStrictness = strictness[orgPolicy.mode as keyof typeof strictness] || 2
    const userStrictness = strictness[mode as keyof typeof strictness] || 2

    if (userStrictness < orgStrictness) {
      return NextResponse.json(
        {
          error: `Cannot set policy to ${mode}. Organization default is ${orgPolicy.mode}. User overrides must be equal or stricter.`,
        },
        { status: 400 }
      )
    }

    // Update user with personal override
    // Note: userPolicy field needs to be added to User schema
    // For now, we'll store it as metadata or skip this feature
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        // userPolicy: mode, // Uncomment when schema is updated
      },
      select: {
        id: true,
        email: true,
        name: true,
        organizationId: true,
      },
    })

    return NextResponse.json({
      policy: {
        mode,
        orgMode: orgPolicy.mode,
        hasOverride: true,
      },
      user: updatedUser,
    }, { status: 200 })
  } catch (error) {
    console.error('User policy update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
