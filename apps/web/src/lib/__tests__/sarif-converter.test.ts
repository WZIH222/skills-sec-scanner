/**
 * Unit tests for convertToJson() function
 *
 * Test suite for JSON export functionality
 */

import { describe, it, expect } from 'vitest'
import { convertToJson, ScanResult, Finding } from '../sarif-converter'

describe('convertToJson', () => {
  describe('basic functionality', () => {
    it('should convert scan with all fields to properly formatted JSON with 2-space indentation', () => {
      const scan: ScanResult = {
        id: 'scan-123',
        fileId: 'file-123',
        contentHash: 'abc123',
        filename: 'test.js',
        score: 45,
        scannedAt: '2025-01-01T00:00:00Z',
        scanDuration: 1500,
        findings: [],
      }

      const json = convertToJson(scan)

      // Should be valid JSON
      expect(() => JSON.parse(json)).not.toThrow()

      // Should have 2-space indentation
      const lines = json.split('\n')
      if (lines.length > 1) {
        // Check that first nested line has 2 spaces
        expect(lines[1]).toMatch(/^  /)
      }
    })

    it('should include all finding properties in JSON output', () => {
      const finding: Finding = {
        id: 'finding-1',
        scanId: 'scan-123',
        ruleId: 'injection',
        severity: 'high',
        message: 'SQL injection vulnerability',
        line: 10,
        column: 5,
        code: 'query.execute(input)',
        aiExplanation: 'This query uses user input without sanitization',
      }

      const scan: ScanResult = {
        id: 'scan-123',
        fileId: 'file-123',
        contentHash: 'abc123',
        filename: 'test.js',
        score: 45,
        scannedAt: '2025-01-01T00:00:00Z',
        scanDuration: 1500,
        findings: [finding],
      }

      const json = convertToJson(scan)
      const parsed = JSON.parse(json) as ScanResult

      expect(parsed.findings).toHaveLength(1)
      expect(parsed.findings[0]).toMatchObject({
        id: 'finding-1',
        ruleId: 'injection',
        severity: 'high',
        message: 'SQL injection vulnerability',
        line: 10,
        column: 5,
        code: 'query.execute(input)',
        aiExplanation: 'This query uses user input without sanitization',
      })
    })

    it('should convert scan with empty findings array to valid JSON', () => {
      const scan: ScanResult = {
        id: 'scan-123',
        fileId: 'file-123',
        contentHash: 'abc123',
        filename: 'test.js',
        score: 0,
        scannedAt: '2025-01-01T00:00:00Z',
        scanDuration: 500,
        findings: [],
      }

      const json = convertToJson(scan)
      const parsed = JSON.parse(json) as ScanResult

      expect(parsed.findings).toEqual([])
      expect(parsed.score).toBe(0)
    })
  })

  describe('special characters handling', () => {
    it('should handle Unicode characters correctly', () => {
      const finding: Finding = {
        id: 'finding-1',
        scanId: 'scan-123',
        ruleId: 'test',
        severity: 'medium',
        message: '测试消息', // Chinese characters
        line: 1,
        column: 1,
      }

      const scan: ScanResult = {
        id: 'scan-123',
        fileId: 'file-123',
        contentHash: 'abc123',
        filename: '测试.js', // Chinese filename
        score: 10,
        scannedAt: '2025-01-01T00:00:00Z',
        scanDuration: 500,
        findings: [finding],
      }

      const json = convertToJson(scan)
      const parsed = JSON.parse(json) as ScanResult

      expect(parsed.filename).toBe('测试.js')
      expect(parsed.findings[0].message).toBe('测试消息')
    })

    it('should handle emojis correctly', () => {
      const finding: Finding = {
        id: 'finding-1',
        scanId: 'scan-123',
        ruleId: 'test',
        severity: 'high',
        message: 'Critical issue 🚨',
        line: 1,
        column: 1,
      }

      const scan: ScanResult = {
        id: 'scan-123',
        fileId: 'file-123',
        contentHash: 'abc123',
        filename: 'test.js',
        score: 50,
        scannedAt: '2025-01-01T00:00:00Z',
        scanDuration: 500,
        findings: [finding],
      }

      const json = convertToJson(scan)
      const parsed = JSON.parse(json) as ScanResult

      expect(parsed.findings[0].message).toBe('Critical issue 🚨')
    })

    it('should handle SQL injection patterns with proper escaping', () => {
      const finding: Finding = {
        id: 'finding-1',
        scanId: 'scan-123',
        ruleId: 'injection',
        severity: 'critical',
        message: "'; DROP TABLE users; --",
        line: 10,
        column: 5,
        code: "query.execute(\"'; DROP TABLE users; --\")",
      }

      const scan: ScanResult = {
        id: 'scan-123',
        fileId: 'file-123',
        contentHash: 'abc123',
        filename: 'test.js',
        score: 100,
        scannedAt: '2025-01-01T00:00:00Z',
        scanDuration: 500,
        findings: [finding],
      }

      const json = convertToJson(scan)

      // Should be valid JSON without breaking structure
      expect(() => JSON.parse(json)).not.toThrow()

      const parsed = JSON.parse(json) as ScanResult
      expect(parsed.findings[0].message).toBe("'; DROP TABLE users; --")
      expect(parsed.findings[0].code).toBe("query.execute(\"'; DROP TABLE users; --\")")
    })
  })

  describe('large datasets', () => {
    it('should complete conversion for scan with 1000 findings without timeout', () => {
      const findings: Finding[] = []
      for (let i = 0; i < 1000; i++) {
        findings.push({
          id: `finding-${i}`,
          scanId: 'scan-123',
          ruleId: 'test-rule',
          severity: i % 4 === 0 ? 'critical' : i % 2 === 0 ? 'high' : 'medium',
          message: `Test finding ${i}`,
          line: i + 1,
          column: 1,
          code: `const test${i} = ${i}`,
        })
      }

      const scan: ScanResult = {
        id: 'scan-123',
        fileId: 'file-123',
        contentHash: 'abc123',
        filename: 'large-test.js',
        score: 2500,
        scannedAt: '2025-01-01T00:00:00Z',
        scanDuration: 5000,
        findings,
      }

      const startTime = Date.now()
      const json = convertToJson(scan)
      const duration = Date.now() - startTime

      // Should complete quickly (< 1 second)
      expect(duration).toBeLessThan(1000)

      // Should be valid JSON
      const parsed = JSON.parse(json) as ScanResult
      expect(parsed.findings).toHaveLength(1000)
    })
  })

  describe('JSON structure validation', () => {
    it('should produce JSON that can be parsed back to ScanResult', () => {
      const originalScan: ScanResult = {
        id: 'scan-123',
        fileId: 'file-123',
        contentHash: 'abc123def456',
        filename: 'test.js',
        score: 75,
        scannedAt: '2025-01-01T00:00:00Z',
        scanDuration: 2000,
        findings: [
          {
            id: 'finding-1',
            scanId: 'scan-123',
            ruleId: 'injection',
            severity: 'critical',
            message: 'SQL injection',
            line: 5,
            column: 10,
            code: 'query.execute(userInput)',
            aiExplanation: 'User input used directly in query',
          },
          {
            id: 'finding-2',
            scanId: 'scan-123',
            ruleId: 'file-access',
            severity: 'high',
            message: 'File system access',
            line: 15,
            column: 8,
          },
        ],
        metadata: '{"userId":"user-123"}',
      }

      const json = convertToJson(originalScan)
      const parsedScan = JSON.parse(json) as ScanResult

      // Verify all fields match
      expect(parsedScan.id).toBe(originalScan.id)
      expect(parsedScan.fileId).toBe(originalScan.fileId)
      expect(parsedScan.contentHash).toBe(originalScan.contentHash)
      expect(parsedScan.filename).toBe(originalScan.filename)
      expect(parsedScan.score).toBe(originalScan.score)
      expect(parsedScan.scannedAt).toBe(originalScan.scannedAt)
      expect(parsedScan.scanDuration).toBe(originalScan.scanDuration)
      expect(parsedScan.findings).toHaveLength(originalScan.findings.length)

      // Verify findings structure
      expect(parsedScan.findings[0]).toMatchObject({
        id: 'finding-1',
        ruleId: 'injection',
        severity: 'critical',
        message: 'SQL injection',
        line: 5,
        column: 10,
        code: 'query.execute(userInput)',
        aiExplanation: 'User input used directly in query',
      })
    })

    it('should handle findings with optional fields (code, aiExplanation)', () => {
      const findings: Finding[] = [
        {
          id: 'finding-1',
          scanId: 'scan-123',
          ruleId: 'rule-with-code',
          severity: 'high',
          message: 'Has code',
          line: 1,
          column: 1,
          code: 'const x = 1',
        },
        {
          id: 'finding-2',
          scanId: 'scan-123',
          ruleId: 'rule-with-ai',
          severity: 'medium',
          message: 'Has AI explanation',
          line: 2,
          column: 1,
          aiExplanation: 'AI analysis here',
        },
        {
          id: 'finding-3',
          scanId: 'scan-123',
          ruleId: 'rule-with-both',
          severity: 'low',
          message: 'Has both',
          line: 3,
          column: 1,
          code: 'console.log("test")',
          aiExplanation: 'AI for console.log',
        },
        {
          id: 'finding-4',
          scanId: 'scan-123',
          ruleId: 'rule-without-either',
          severity: 'info',
          message: 'Minimal finding',
          line: 4,
          column: 1,
        },
      ]

      const scan: ScanResult = {
        id: 'scan-123',
        fileId: 'file-123',
        contentHash: 'abc123',
        filename: 'test.js',
        score: 20,
        scannedAt: '2025-01-01T00:00:00Z',
        scanDuration: 1000,
        findings,
      }

      const json = convertToJson(scan)
      const parsed = JSON.parse(json) as ScanResult

      expect(parsed.findings[0].code).toBe('const x = 1')
      expect(parsed.findings[0].aiExplanation).toBeUndefined()

      expect(parsed.findings[1].aiExplanation).toBe('AI analysis here')
      expect(parsed.findings[1].code).toBeUndefined()

      expect(parsed.findings[2].code).toBe('console.log("test")')
      expect(parsed.findings[2].aiExplanation).toBe('AI for console.log')

      expect(parsed.findings[3].code).toBeUndefined()
      expect(parsed.findings[3].aiExplanation).toBeUndefined()
    })
  })
})
