import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { prisma } from '@skills-sec/database'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
)

export interface JWTPayload {
  userId: string
  email: string
  iat: number
  exp: number
}

/**
 * Generate JWT token for user
 */
export async function generateToken(userId: string, email: string): Promise<string> {
  const token = await new SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(JWT_SECRET)

  return token
}

/**
 * Verify JWT token and return payload
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch (error) {
    return null
  }
}

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Create user with default organization
 */
export async function createUser(email: string, password: string, name: string) {
  const passwordHash = await hashPassword(password)

  // Create default organization and policy
  const organization = await prisma.organization.create({
    data: {
      name: `${name}'s Organization`,
      policy: {
        create: {
          mode: 'MODERATE',
        },
      },
    },
  })

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      organizationId: organization.id,
    },
    select: {
      id: true,
      email: true,
      name: true,
      organizationId: true,
      createdAt: true,
    },
  })

  return user
}

/**
 * Authenticate user with email and password
 */
export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      organization: {
        include: {
          policy: true,
        },
      },
    },
  })

  if (!user) {
    return null
  }

  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) {
    return null
  }

  // Return user without passwordHash
  const { passwordHash, ...userWithoutPassword } = user
  return userWithoutPassword
}
