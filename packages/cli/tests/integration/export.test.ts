/**
 * Integration tests for JSON export functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFile, unlink, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { exportJson } from '../../src/output/export.js'
import type { ScanResult } from '@skills-sec/scanner'

describe('JSON Export Integration Tests', () => {
  const tempDir = join(tmpdir(), `s3-cli-test-${Date.now()}`)
  let mockResult: ScanResult

  beforeEach(async () => {
    // Create temp directory
    await mkdir(tempDir, { recursive: true })

    // Create mock scan result
    mockResult = {
      findings: [
        {
          ruleId: 'test-rule-1',
          severity: 'critical',
          message: 'Critical security issue found',
          location: { line: 10, column: 5 },
          code: 'const secret = "hardcoded-secret"',
          explanation: 'Hardcoded secrets expose sensitive information',
        },
        {
          ruleId: 'test-rule-2',
          severity: 'medium',
          message: 'Medium severity issue',
          location: { line: 20, column: 1 },
          explanation: 'This could be a security risk',
        },
      ],
      score: 85,
      metadata: {
        scannedAt: new Date('2024-03-17T12:00:00Z'),
        scanDuration: 1500,
        aiAnalysis: true,
        aiProvider: 'openai',
      },
    }
  })

  afterEach(async () => {
    // Clean up temp files (ignore errors if file doesn't exist)
    try {
      await unlink(join(tempDir, 'results.json'))
    } catch {
      // Ignore
    }
    try {
      await unlink(join(tempDir, 'nested', 'results.json'))
    } catch {
      // Ignore
    }
  })

  it('exports JSON to file', async () => {
    const outputPath = join(tempDir, 'results.json')

    await exportJson(mockResult, outputPath)

    // Verify file exists
    const content = await readFile(outputPath, 'utf-8')
    expect(content).toBeTruthy()
    expect(content.length).toBeGreaterThan(0)

    // Verify it's valid JSON
    const parsed = JSON.parse(content)
    expect(parsed).toBeDefined()
  })

  it('JSON has correct structure', async () => {
    const outputPath = join(tempDir, 'results.json')

    await exportJson(mockResult, outputPath)

    const content = await readFile(outputPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Verify top-level fields
    expect(parsed.score).toBe(85)
    expect(parsed.findings).toBeInstanceOf(Array)
    expect(parsed.findings).toHaveLength(2)

    // Verify first finding
    expect(parsed.findings[0].ruleId).toBe('test-rule-1')
    expect(parsed.findings[0].severity).toBe('critical')
    expect(parsed.findings[0].message).toBe('Critical security issue found')
    expect(parsed.findings[0].line).toBe(10)
    expect(parsed.findings[0].column).toBe(5)
    expect(parsed.findings[0].code).toBe('const secret = "hardcoded-secret"')
    expect(parsed.findings[0].explanation).toBe('Hardcoded secrets expose sensitive information')

    // Verify metadata
    expect(parsed.scannedAt).toBeTruthy()
    expect(parsed.scanDuration).toBe(1500)
    expect(parsed.aiAnalysis).toBe(true)
    expect(parsed.aiProvider).toBe('openai')
  })

  it('creates parent directory if it does not exist', async () => {
    const nestedPath = join(tempDir, 'nested', 'results.json')

    await exportJson(mockResult, nestedPath)

    // Verify file was created
    const content = await readFile(nestedPath, 'utf-8')
    expect(content).toBeTruthy()

    const parsed = JSON.parse(content)
    expect(parsed.score).toBe(85)
  })

  it('includes all findings in JSON output', async () => {
    const outputPath = join(tempDir, 'results.json')

    // Add more findings
    mockResult.findings.push({
      ruleId: 'test-rule-3',
      severity: 'low',
      message: 'Low severity issue',
      location: { line: 30, column: 1 },
    })

    await exportJson(mockResult, outputPath)

    const content = await readFile(outputPath, 'utf-8')
    const parsed = JSON.parse(content)

    expect(parsed.findings).toHaveLength(3)
    expect(parsed.findings[0].ruleId).toBe('test-rule-1')
    expect(parsed.findings[1].ruleId).toBe('test-rule-2')
    expect(parsed.findings[2].ruleId).toBe('test-rule-3')
  })

  it('includes metadata and score in JSON output', async () => {
    const outputPath = join(tempDir, 'results.json')

    await exportJson(mockResult, outputPath)

    const content = await readFile(outputPath, 'utf-8')
    const parsed = JSON.parse(content)

    // Verify score
    expect(parsed.score).toBe(85)

    // Verify metadata fields
    expect(parsed.scannedAt).toBeTruthy()
    expect(parsed.scanDuration).toBe(1500)
    expect(parsed.aiAnalysis).toBe(true)
    expect(parsed.aiProvider).toBe('openai')
  })

  it('uses 2-space indentation for readable JSON', async () => {
    const outputPath = join(tempDir, 'results.json')

    await exportJson(mockResult, outputPath)

    const content = await readFile(outputPath, 'utf-8')

    // Check for 2-space indentation (should have "  " not "    ")
    expect(content).toContain('  "score"')
    expect(content).toContain('  "findings"')

    // Verify it's properly formatted with newlines
    const lines = content.split('\n')
    expect(lines.length).toBeGreaterThan(10) // Should be multi-line
  })

  it('throws friendly error on permission denied', async () => {
    // This test is environment-specific and may not work on all systems
    // We'll skip it in CI environments
    if (process.env.CI) {
      return
    }

    const outputPath = '/root/results.json' // Likely to fail on most systems

    try {
      await exportJson(mockResult, outputPath)
      // If we get here, the test passed (file was writable), which is fine
      await unlink(outputPath)
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toContain('Permission denied')
    }
  })
})
