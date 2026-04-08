import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from './auth'
import { logger, LogLevel } from './logger'
import { RateLimiter, getRateLimitIdentifier, rateLimiters } from './rate-limiter'
import { generateRequestId } from './api-response'
import { getAllowedOrigins } from './cors-validator'

/**
 * Enhanced authentication middleware
 */
export async function authMiddleware(request: NextRequest): Promise<{
  isAuthenticated: boolean
  userId?: string
  email?: string
  error?: NextResponse
}> {
  // Extract token from Authorization header or cookie
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : request.cookies.get('auth-token')?.value

  if (!token) {
    return {
      isAuthenticated: false,
      error: NextResponse.json(
        { error: 'Unauthorized', statusCode: 401 },
        { status: 401 }
      ),
    }
  }

  // Verify token
  const payload = await verifyToken(token)

  if (!payload) {
    return {
      isAuthenticated: false,
      error: NextResponse.json(
        { error: 'Invalid token', statusCode: 401 },
        { status: 401 }
      ),
    }
  }

  return {
    isAuthenticated: true,
    userId: payload.userId,
    email: payload.email,
  }
}

/**
 * Rate limiter interface (avoiding circular type issues)
 */
interface IRateLimiter {
  isRateLimited(identifier: string): Promise<boolean>
  getRemainingRequests(identifier: string): Promise<number>
  getResetTime(identifier: string): Promise<number | null>
  maxRequests: number
}

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  limiter: IRateLimiter
): Promise<{ isAllowed: boolean; error?: NextResponse }> {
  const identifier = getRateLimitIdentifier(request as any)
  const isRateLimited = await limiter.isRateLimited(identifier)

  if (isRateLimited) {
    const remaining = await limiter.getRemainingRequests(identifier)
    const resetTime = await limiter.getResetTime(identifier)
    const retryAfter = resetTime ? Math.ceil((resetTime - Date.now()) / 1000) : 60

    return {
      isAllowed: false,
      error: NextResponse.json(
        {
          error: 'Too many requests',
          statusCode: 429,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': limiter['maxRequests'].toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': resetTime?.toString() || '',
          },
        }
      ),
    }
  }

  return { isAllowed: true }
}

/**
 * Request logging middleware
 */
export function loggingMiddleware(request: NextRequest): {
  requestId: string
  startTime: number
} {
  const requestId = generateRequestId()
  const startTime = Date.now()

  logger.logRequest(
    requestId,
    request.method,
    request.nextUrl.pathname,
    request.headers.get('x-user-id') || undefined
  )

  return { requestId, startTime }
}

/**
 * CORS middleware (additional layer on top of next.config.mjs)
 */
export function corsMiddleware(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin')
  const allowedOrigins = getAllowedOrigins()

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': origin && allowedOrigins.includes(origin) ? origin : 'null',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  return null
}
