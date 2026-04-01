import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyToken, verifyPassword, hashPassword } from '@/lib/auth'
import { prisma } from '@skills-sec/database'

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

/**
 * POST /api/auth/password
 *
 * Change user password with current password verification
 */
export async function POST(request: NextRequest) {
  try {
    // Extract Bearer token from Authorization header or auth-token cookie
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

    // Verify JWT
    const payload = await verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    // Parse and validate body
    const body = await request.json()
    const validation = passwordChangeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = validation.data

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, passwordHash: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash)
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword)

    // Update user's password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    })

    return NextResponse.json(
      { message: 'Password updated successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Password change error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
