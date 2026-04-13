import { NextResponse } from 'next/server'

/**
 * Parse and validate pagination query parameters.
 * @param searchParams - URLSearchParams from the request
 * @param defaults - Optional default values for page and limit
 * @returns Validated { page, limit }
 * @throws NextResponse with status 400 if values are invalid (NaN or out of bounds)
 */
export function parsePageParams(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number } = {}
): { page: number; limit: number } {
  const rawPage = searchParams.get('page')
  const rawLimit = searchParams.get('limit')

  const page = rawPage !== null ? parseInt(rawPage, 10) : (defaults.page ?? 1)
  const limit = rawLimit !== null ? parseInt(rawLimit, 10) : (defaults.limit ?? 20)

  if (Number.isNaN(page) || page < 1) {
    throw NextResponse.json({ error: 'Invalid page parameter' }, { status: 400 })
  }
  if (Number.isNaN(limit) || limit < 1 || limit > 100) {
    throw NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 })
  }

  return { page, limit }
}

/**
 * Validate that a string is a valid ID format.
 * Accepts both UUID v4 and Prisma CUID formats.
 * @param id - The string to validate
 * @param fieldName - Optional field name for error message
 * @throws NextResponse with status 400 if the string is not a valid ID
 */
export function assertUUID(id: string, fieldName: string = 'ID'): void {
  // UUID v4: 8-4-4-4-12 hex digits with version 4 at position 14
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  // Prisma CUID: 25 chars starting with 'c', followed by 24 lowercase alphanumerics
  const CUID_REGEX = /^c[0-9a-z]{24}$/i
  if (!UUID_REGEX.test(id) && !CUID_REGEX.test(id)) {
    throw NextResponse.json(
      { error: `Invalid ${fieldName}` },
      { status: 400 }
    )
  }
}
