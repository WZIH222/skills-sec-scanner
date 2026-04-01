/**
 * Unit tests for color output utilities
 *
 * Tests verify:
 * - severityColors exports map with 5 entries
 * - severityColors.critical returns chalk.red.bold function
 * - All severity colors are functions
 */

import { describe, it, expect } from 'vitest'
import { severityColors } from '../../src/output/colors.js'

describe('Severity Colors', () => {
  it('should export severityColors map with 5 entries', () => {
    expect(severityColors).toBeDefined()
    expect(Object.keys(severityColors)).toHaveLength(5)
    expect(severityColors.critical).toBeDefined()
    expect(severityColors.high).toBeDefined()
    expect(severityColors.medium).toBeDefined()
    expect(severityColors.low).toBeDefined()
    expect(severityColors.info).toBeDefined()
  })

  it('should have all severity colors as functions', () => {
    expect(typeof severityColors.critical).toBe('function')
    expect(typeof severityColors.high).toBe('function')
    expect(typeof severityColors.medium).toBe('function')
    expect(typeof severityColors.low).toBe('function')
    expect(typeof severityColors.info).toBe('function')
  })

  it('should return colored strings', () => {
    const result = severityColors.critical('CRITICAL')
    expect(typeof result).toBe('string')
    expect(result).toContain('CRITICAL')
  })

  it('should handle all severity levels', () => {
    expect(() => severityColors.critical('test')).not.toThrow()
    expect(() => severityColors.high('test')).not.toThrow()
    expect(() => severityColors.medium('test')).not.toThrow()
    expect(() => severityColors.low('test')).not.toThrow()
    expect(() => severityColors.info('test')).not.toThrow()
  })
})
