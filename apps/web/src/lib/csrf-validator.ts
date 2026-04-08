/**
 * CSRF Validator
 *
 * Validates Origin/Referer headers on mutating requests as defense-in-depth
 * against cross-site request forgery. Per D-01 (CSRF-02).
 */

import { NextRequest, NextResponse } from 'next/server'

const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH']

/**
 * Validate Origin or Referer header against allowed origins
 *
 * Returns true if:
 * - Origin header is set and matches an allowed origin, OR
 * - Referer header is set and starts with an allowed origin
 *
 * Returns false (blocked) if:
 * - Neither Origin nor Referer is set on a mutating request, OR
 * - Origin/Referer does not match any allowed origin
 */
export function validateCsrfOrigin(request: NextRequest): { valid: boolean; error?: NextResponse } {
  // Only validate mutating requests
  if (!mutatingMethods.includes(request.method)) {
    return { valid: true }
  }

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // Get allowed origins from environment
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || []

  // If no allowed origins configured, skip validation (fail open for development)
  if (allowedOrigins.length === 0) {
    return { valid: true }
  }

  // Check Origin header
  if (origin && allowedOrigins.includes(origin)) {
    return { valid: true }
  }

  // Check Referer header (must start with an allowed origin)
  if (referer) {
    const refererOrigin = referer.split('/').slice(0, 3).join('/')
    if (allowedOrigins.some(o => refererOrigin.startsWith(o.replace(/\/$/, '')))) {
      return { valid: true }
    }
  }

  // Block request — no valid Origin or Referer
  return {
    valid: false,
    error: NextResponse.json(
      { error: 'Invalid origin. Cross-origin requests not allowed on this endpoint.' },
      { status: 403 }
    ),
  }
}
