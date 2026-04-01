/**
 * Error Message Formatter
 *
 * Formats errors for user-friendly display with color coding.
 */

import chalk from 'chalk'

export function formatError(error: unknown): string {
  if (error instanceof Error) {
    // Check for system error codes
    if ('code' in error) {
      const code = (error as any).code
      switch (code) {
        case 'ENOENT':
          return chalk.red('Error: File not found')
        case 'EACCES':
          return chalk.red('Error: Permission denied')
        case 'EINVAL':
          return chalk.red('Error: Invalid file format')
      }
    }
    return chalk.red(`Error: ${error.message}`)
  }
  return chalk.red(`Error: ${String(error)}`)
}
