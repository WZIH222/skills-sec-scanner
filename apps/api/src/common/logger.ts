import { Logger, LoggerService } from '@nestjs/common'

/**
 * Redact patterns for sensitive environment variables and tokens.
 * Applied before any log emission to prevent secret leakage.
 */
const REDACT_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /(JWT_SECRET)=[^\s&]*/gi, replacement: '$1=[REDACTED]' },
  { pattern: /(OPENAI_API_KEY)=[^\s&]*/gi, replacement: '$1=[REDACTED]' },
  { pattern: /(ANTHROPIC_API_KEY)=[^\s&]*/gi, replacement: '$1=[REDACTED]' },
  { pattern: /(DATABASE_URL)=[^\s&]*/gi, replacement: '$1=[REDACTED]' },
  { pattern: /(REDIS_URL)=[^\s&]*/gi, replacement: '$1=[REDACTED]' },
  { pattern: /Bearer [^\s]*/gi, replacement: 'Bearer [REDACTED]' },
]

/**
 * AppLogger - NestJS LoggerService with secret redaction.
 *
 * - All messages pass through redactSecrets() before emission
 * - error.stack is suppressed from stdout/stderr in production
 * - Uses NestJS built-in Logger as the base class
 */
export class AppLogger extends Logger implements LoggerService {
  /**
   * Redact sensitive values from log input.
   * Handles environment variables and Bearer tokens.
   */
  redactSecrets(input: string): string {
    let result = input
    for (const { pattern, replacement } of REDACT_PATTERNS) {
      result = result.replace(pattern, replacement)
    }
    return result
  }

  /**
   * Log error messages.
   * In production: message is redacted, stack trace is NOT passed to super.error()
   * In development: full error details including stack are passed to super.error()
   */
  error(message: string, ...optionalParams: any[]): void {
    const redactedMessage = this.redactSecrets(message)
    const stack = optionalParams[0]
    const isProduction = process.env.NODE_ENV !== 'development'

    if (isProduction && stack instanceof Error && stack.stack) {
      // In production: log internally but do NOT pass stack to stdout/stderr
      // The stack is available server-side via the Error object itself
      super.error(redactedMessage)
    } else if (stack instanceof Error) {
      super.error(redactedMessage, stack.stack)
    } else {
      super.error(redactedMessage, ...optionalParams)
    }
  }

  /**
   * Log informational messages with redaction.
   */
  log(message: string, ...optionalParams: any[]): void {
    super.log(this.redactSecrets(message), ...optionalParams)
  }

  /**
   * Log warning messages with redaction.
   */
  warn(message: string, ...optionalParams: any[]): void {
    super.warn(this.redactSecrets(message), ...optionalParams)
  }

  /**
   * Log debug messages with redaction.
   */
  debug(message: string, ...optionalParams: any[]): void {
    super.debug(this.redactSecrets(message), ...optionalParams)
  }

  /**
   * Log verbose messages with redaction.
   */
  verbose(message: string, ...optionalParams: any[]): void {
    super.verbose(this.redactSecrets(message), ...optionalParams)
  }
}

/**
 * Singleton instance for use across the application.
 * Use this in filters and services that need centralized logging.
 */
export const appLogger = new AppLogger()
