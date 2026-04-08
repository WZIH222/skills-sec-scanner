import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { Request, Response } from 'express'
import { appLogger } from '../logger'

/**
 * Global exception filter that catches all unhandled errors.
 *
 * Security guarantees:
 * - error.stack is NEVER returned to API clients
 * - Full error details (message + stack + context) are logged server-side via appLogger
 * - HttpException response shape is preserved for NestJS-standard errors
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()

    // Determine HTTP status code
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    // Build client-safe response body
    const responseBody = this.buildResponseBody(exception, status)

    // Build server-side log context (full details, never sent to client)
    const logContext = {
      path: request.url,
      method: request.method,
      statusCode: status,
      stack: exception instanceof Error ? exception.stack : undefined,
    }

    // Log full error server-side with redaction applied automatically
    const errorMessage =
      exception instanceof Error ? exception.message : String(exception)
    appLogger.error(errorMessage, exception, logContext)

    // Send client-safe response (no stack trace)
    response.status(status).json(responseBody)
  }

  /**
   * Build a client-safe response body.
   * Never includes error.stack.
   */
  private buildResponseBody(
    exception: unknown,
    status: number
  ): Record<string, any> {
    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse()

      // Preserve NestJS HttpException response shape
      if (typeof exceptionResponse === 'string') {
        return {
          statusCode: status,
          message: exceptionResponse,
          error: exception.name,
        }
      }

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const obj = exceptionResponse as Record<string, any>
        // Ensure statusCode is present
        if (!obj.statusCode) {
          return { ...obj, statusCode: status }
        }
        // Explicitly exclude stack if somehow present
        const { stack: _stack, ...safeResponse } = obj
        return safeResponse
      }
    }

    // Unknown exceptions: generic message, no stack
    return {
      statusCode: status,
      message: 'Internal server error',
      error: 'Internal Server Error',
    }
  }
}
