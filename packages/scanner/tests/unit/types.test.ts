import { describe, it, expect } from 'vitest'
import { z } from 'zod'

describe('Type Definitions', () => {
  describe('Severity', () => {
    it('should accept only valid severity values', () => {
      const severitySchema = z.enum(['critical', 'high', 'medium', 'low', 'info'])

      expect(() => severitySchema.parse('critical')).not.toThrow()
      expect(() => severitySchema.parse('high')).not.toThrow()
      expect(() => severitySchema.parse('medium')).not.toThrow()
      expect(() => severitySchema.parse('low')).not.toThrow()
      expect(() => severitySchema.parse('info')).not.toThrow()

      // Invalid values should throw
      expect(() => severitySchema.parse('invalid')).toThrow()
      expect(() => severitySchema.parse('')).toThrow()
      expect(() => severitySchema.parse('CRITICAL')).toThrow()
    })
  })

  describe('Finding', () => {
    it('should require all fields', () => {
      const findingSchema = z.object({
        ruleId: z.string(),
        severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
        message: z.string(),
        location: z.object({
          line: z.number(),
          column: z.number(),
        }),
        code: z.string().optional(),
      })

      // Valid finding
      const validFinding = {
        ruleId: 'test-rule',
        severity: 'high' as const,
        message: 'Test message',
        location: { line: 1, column: 5 },
        code: 'test code',
      }
      expect(() => findingSchema.parse(validFinding)).not.toThrow()

      // Missing required fields should throw
      const invalidFinding = {
        ruleId: 'test-rule',
        // missing severity
        // missing message
        location: { line: 1, column: 5 },
      }
      expect(() => findingSchema.parse(invalidFinding)).toThrow()
    })

    it('should accept optional code field', () => {
      const findingSchema = z.object({
        ruleId: z.string(),
        severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
        message: z.string(),
        location: z.object({
          line: z.number(),
          column: z.number(),
        }),
        code: z.string().optional(),
      })

      const findingWithoutCode = {
        ruleId: 'test-rule',
        severity: 'medium' as const,
        message: 'Test message',
        location: { line: 10, column: 3 },
      }
      expect(() => findingSchema.parse(findingWithoutCode)).not.toThrow()
    })
  })

  describe('ScanResult', () => {
    it('should require findings array and score number', () => {
      const scanResultSchema = z.object({
        findings: z.array(
          z.object({
            ruleId: z.string(),
            severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
            message: z.string(),
            location: z.object({
              line: z.number(),
              column: z.number(),
            }),
            code: z.string().optional(),
          })
        ),
        score: z.number().min(0).max(100),
        metadata: z.object({
          scannedAt: z.union([z.string(), z.date()]),
          scanDuration: z.number(),
        }),
      })

      // Valid scan result
      const validScanResult = {
        findings: [
          {
            ruleId: 'rule-1',
            severity: 'critical' as const,
            message: 'Critical issue',
            location: { line: 1, column: 0 },
          },
        ],
        score: 85,
        metadata: {
          scannedAt: '2025-03-10T00:00:00Z',
          scanDuration: 1500,
        },
      }
      expect(() => scanResultSchema.parse(validScanResult)).not.toThrow()

      // Invalid: score out of range
      const invalidScore = {
        findings: [],
        score: 150,
        metadata: {
          scannedAt: '2025-03-10T00:00:00Z',
          scanDuration: 1000,
        },
      }
      expect(() => scanResultSchema.parse(invalidScore)).toThrow()

      // Invalid: missing findings
      const missingFindings = {
        score: 50,
        metadata: {
          scannedAt: '2025-03-10T00:00:00Z',
          scanDuration: 1000,
        },
      }
      expect(() => scanResultSchema.parse(missingFindings)).toThrow()
    })
  })

  describe('IParseResult', () => {
    it('should contain AST, metadata, errors, and dependencies', () => {
      const parseResultSchema = z.object({
        ast: z.any(),
        metadata: z.object({
          language: z.string(),
          format: z.string().optional(),
        }),
        errors: z.array(
          z.object({
            message: z.string(),
            line: z.number().optional(),
            column: z.number().optional(),
          })
        ),
        dependencies: z.array(z.string()),
      })

      // Valid parse result
      const validParseResult = {
        ast: {},
        metadata: {
          language: 'typescript',
          format: 'ts',
        },
        errors: [],
        dependencies: ['lodash', 'axios'],
      }
      expect(() => parseResultSchema.parse(validParseResult)).not.toThrow()

      // Invalid: missing required fields
      const invalidParseResult = {
        ast: {},
        // missing metadata
        errors: [],
        dependencies: [],
      }
      expect(() => parseResultSchema.parse(invalidParseResult)).toThrow()
    })
  })
})
