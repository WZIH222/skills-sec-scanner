/**
 * Unit tests for error formatting
 *
 * Tests verify:
 * - formatError returns friendly message for ENOENT (file not found)
 * - formatError returns friendly message for EACCES (permission denied)
 * - formatError returns generic message for unknown errors
 */

import { describe, it, expect } from 'vitest'
import { formatError } from '../../src/utils/errors.js'
import chalk from 'chalk'

describe('Error Formatter', () => {
  it('should return friendly message for ENOENT (file not found)', () => {
    const error = new Error('File not found') as any
    error.code = 'ENOENT'

    const result = formatError(error)
    expect(result).toContain('File not found')
  })

  it('should return friendly message for EACCES (permission denied)', () => {
    const error = new Error('Permission denied') as any
    error.code = 'EACCES'

    const result = formatError(error)
    expect(result).toContain('Permission denied')
  })

  it('should return generic message for unknown errors', () => {
    const error = new Error('Something went wrong')

    const result = formatError(error)
    expect(result).toContain('Something went wrong')
  })

  it('should handle non-Error objects', () => {
    const result = formatError('string error')
    expect(result).toContain('string error')
  })
})
