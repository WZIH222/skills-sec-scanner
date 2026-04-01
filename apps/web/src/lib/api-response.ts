import { NextResponse } from 'next/server'

/**
 * Standard API response format
 */
export interface ApiResponse<T = any> {
  data?: T
  error?: string
  statusCode: number
  timestamp: string
  requestId?: string
}

/**
 * Standard error response format
 */
export interface ApiErrorResponse {
  statusCode: number
  message: string
  error: string
  timestamp: string
  requestId?: string
  details?: any
}

/**
 * Generate a request ID for tracing
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Create a successful API response
 */
export function successResponse<T>(
  data: T,
  statusCode: number = 200,
  requestId?: string
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      data,
      statusCode,
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
    },
    { status: statusCode }
  )
}

/**
 * Create an error response
 */
export function errorResponse(
  statusCode: number,
  message: string,
  errorType: string,
  requestId?: string,
  details?: any
): NextResponse<ApiErrorResponse> {
  return NextResponse.json(
    {
      statusCode,
      message,
      error: errorType,
      timestamp: new Date().toISOString(),
      ...(requestId && { requestId }),
      ...(details && { details }),
    },
    { status: statusCode }
  )
}

/**
 * Prisma error mapping
 */
export function handlePrismaError(error: any, requestId?: string): NextResponse {
  // Prisma unique constraint violation
  if (error.code === 'P2002') {
    const fields = error.meta?.target?.join(', ') || 'field'
    return errorResponse(
      409,
      `A record with this ${fields} already exists`,
      'CONFLICT_ERROR',
      requestId,
      { field: error.meta?.target }
    )
  }

  // Prisma record not found
  if (error.code === 'P2025') {
    return errorResponse(
      404,
      'Record not found',
      'NOT_FOUND',
      requestId
    )
  }

  // Prisma foreign key constraint
  if (error.code === 'P2003') {
    return errorResponse(
      400,
      'Invalid reference to related record',
      'FOREIGN_KEY_ERROR',
      requestId,
      { field: error.meta?.field_name }
    )
  }

  // Prisma validation error
  if (error.code === 'P2006') {
    return errorResponse(
      400,
      'Invalid data provided',
      'VALIDATION_ERROR',
      requestId
    )
  }

  // Generic Prisma error
  return errorResponse(
    500,
    'Database error occurred',
    'DATABASE_ERROR',
    requestId,
    { code: error.code }
  )
}

/**
 * Validation error response
 */
export function validationError(
  message: string,
  details?: any,
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return errorResponse(400, message, 'VALIDATION_ERROR', requestId, details)
}

/**
 * Unauthorized error response
 */
export function unauthorizedError(
  message: string = 'Unauthorized',
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return errorResponse(401, message, 'UNAUTHORIZED', requestId)
}

/**
 * Forbidden error response
 */
export function forbiddenError(
  message: string = 'Forbidden',
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return errorResponse(403, message, 'FORBIDDEN', requestId)
}

/**
 * Not found error response
 */
export function notFoundError(
  resource: string = 'Resource',
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return errorResponse(404, `${resource} not found`, 'NOT_FOUND', requestId)
}

/**
 * Internal server error response
 */
export function internalServerError(
  message: string = 'Internal server error',
  requestId?: string
): NextResponse<ApiErrorResponse> {
  return errorResponse(500, message, 'INTERNAL_SERVER_ERROR', requestId)
}
