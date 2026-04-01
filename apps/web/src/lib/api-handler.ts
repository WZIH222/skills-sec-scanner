import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  errorResponse,
  handlePrismaError,
  generateRequestId,
  successResponse,
} from './api-response'
import { logger } from './logger'

/**
 * Handler context with request metadata
 */
export interface HandlerContext {
  requestId: string
  userId?: string
  startTime: number
}

/**
 * Typed handler function with context
 */
export type ApiHandler<T = any> = (
  request: NextRequest,
  context: HandlerContext
) => Promise<NextResponse<T>>

/**
 * Validation schema for request body
 */
export type ValidationSchema<T> = z.ZodSchema<T>

/**
 * Wrap API handler with error handling, logging, and response formatting
 */
export function withApiHandler<T = any>(
  handler: ApiHandler<T>,
  options?: {
    requireAuth?: boolean
    validateBody?: ValidationSchema<any>
    logRequest?: boolean
  }
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest) => {
    const requestId = generateRequestId()
    const startTime = Date.now()
    const { pathname } = request.nextUrl

    try {
      // Extract user ID from headers (set by middleware)
      const userId = request.headers.get('x-user-id') || undefined

      // Log request
      if (options?.logRequest !== false) {
        logger.logRequest(requestId, request.method, pathname, userId)
      }

      // Create handler context
      const context: HandlerContext = {
        requestId,
        userId,
        startTime,
      }

      // Validate request body if schema provided
      if (options?.validateBody) {
        try {
          const body = await request.json()
          const validatedBody = options.validateBody.parse(body)
          // Store validated body for handler to use
          ;(request as any).validatedBody = validatedBody
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.warn('Validation failed', {
              requestId,
              errors: error.errors,
            })
            return errorResponse(
              400,
              'Invalid request data',
              'VALIDATION_ERROR',
              requestId,
              { errors: error.errors }
            )
          }
          throw error
        }
      }

      // Call handler
      const response = await handler(request, context)

      // Log response
      const duration = Date.now() - startTime
      const responseClone = response.clone() as NextResponse
      const statusCode = responseClone.status

      if (options?.logRequest !== false) {
        logger.logResponse(requestId, request.method, pathname, statusCode, duration)
      }

      return response
    } catch (error: any) {
      const duration = Date.now() - startTime

      // Handle Prisma errors
      if (error?.code?.startsWith('P')) {
        logger.error('Prisma error', error, { requestId })
        const prismaError = handlePrismaError(error, requestId)
        logger.logResponse(requestId, request.method, pathname, prismaError.status, duration)
        return prismaError
      }

      // Handle known API errors
      if (error?.statusCode) {
        logger.warn('API error', {
          requestId,
          statusCode: error.statusCode,
          message: error.message,
        })
        const apiError = errorResponse(
          error.statusCode,
          error.message,
          error.name || 'API_ERROR',
          requestId
        )
        logger.logResponse(requestId, request.method, pathname, error.statusCode, duration)
        return apiError
      }

      // Log unexpected errors
      logger.error('Unhandled error', error, {
        requestId,
        method: request.method,
        path: pathname,
      })

      // Return internal server error
      const serverError = errorResponse(
        500,
        'An unexpected error occurred',
        'INTERNAL_SERVER_ERROR',
        requestId
      )
      logger.logResponse(requestId, request.method, pathname, 500, duration)
      return serverError
    }
  }
}

/**
 * Wrap GET handler
 */
export function withGetHandler<T = any>(
  handler: ApiHandler<T>,
  options?: Omit<Parameters<typeof withApiHandler>[1], 'validateBody'>
) {
  return withApiHandler<T>(handler, options)
}

/**
 * Wrap POST handler with body validation
 */
export function withPostHandler<T = any>(
  handler: ApiHandler<T>,
  options?: Parameters<typeof withApiHandler>[1]
) {
  return withApiHandler<T>(handler, options)
}

/**
 * Wrap PUT handler with body validation
 */
export function withPutHandler<T = any>(
  handler: ApiHandler<T>,
  options?: Parameters<typeof withApiHandler>[1]
) {
  return withApiHandler<T>(handler, options)
}

/**
 * Wrap DELETE handler
 */
export function withDeleteHandler<T = any>(
  handler: ApiHandler<T>,
  options?: Omit<Parameters<typeof withApiHandler>[1], 'validateBody'>
) {
  return withApiHandler<T>(handler, options)
}

/**
 * Custom API error class
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public name: string = 'API_ERROR'
  ) {
    super(message)
    this.name = name
  }
}

/**
 * Common API errors
 */
export const ApiErrors = {
  unauthorized: (message: string = 'Unauthorized') =>
    new ApiError(401, message, 'UNAUTHORIZED'),
  forbidden: (message: string = 'Forbidden') =>
    new ApiError(403, message, 'FORBIDDEN'),
  notFound: (resource: string = 'Resource') =>
    new ApiError(404, `${resource} not found`, 'NOT_FOUND'),
  conflict: (message: string) =>
    new ApiError(409, message, 'CONFLICT'),
  validation: (message: string, details?: any) => {
    const error = new ApiError(400, message, 'VALIDATION_ERROR')
    ;(error as any).details = details
    return error
  },
  internal: (message: string = 'Internal server error') =>
    new ApiError(500, message, 'INTERNAL_SERVER_ERROR'),
}
