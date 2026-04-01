/**
 * Simple logging utility for Next.js API routes
 *
 * In production, this should be replaced with a proper logging service
 * (e.g., Winston, Pino, or cloud provider logging)
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export interface LogContext {
  requestId?: string
  userId?: string
  path?: string
  method?: string
  statusCode?: number
  duration?: number
  [key: string]: any
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  private formatMessage(
    level: LogLevel,
    message: string,
    context?: LogContext
  ): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` ${JSON.stringify(context)}` : ''
    return `[${timestamp}] [${level}] ${message}${contextStr}`
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context))
    }
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage(LogLevel.INFO, message, context))
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, context))
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    const errorContext = {
      ...context,
      ...(error && {
        error: {
          message: error.message,
          stack: this.isDevelopment ? error.stack : undefined,
          name: error.name,
          code: error.code,
        },
      }),
    }
    console.error(this.formatMessage(LogLevel.ERROR, message, errorContext))
  }

  /**
   * Log incoming request
   */
  logRequest(requestId: string, method: string, path: string, userId?: string): void {
    this.info('Incoming request', {
      requestId,
      method,
      path,
      ...(userId && { userId }),
    })
  }

  /**
   * Log outgoing response
   */
  logResponse(
    requestId: string,
    method: string,
    path: string,
    statusCode: number,
    duration: number
  ): void {
    const level = statusCode >= 500 ? LogLevel.ERROR : statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO
    const message = `Outgoing response (${statusCode})`

    if (level === LogLevel.ERROR) {
      this.error(message, undefined, {
        requestId,
        method,
        path,
        statusCode,
        duration,
      })
    } else if (level === LogLevel.WARN) {
      this.warn(message, {
        requestId,
        method,
        path,
        statusCode,
        duration,
      })
    } else {
      this.info(message, {
        requestId,
        method,
        path,
        statusCode,
        duration,
      })
    }
  }

  /**
   * Log API error
   */
  logApiError(
    requestId: string,
    error: Error | any,
    context?: {
      method?: string
      path?: string
      userId?: string
      statusCode?: number
    }
  ): void {
    this.error('API error', error, {
      requestId,
      ...context,
    })
  }
}

// Export singleton instance
export const logger = new Logger()
