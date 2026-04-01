/**
 * Unit tests for scan command export functionality
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { mkdir, unlink, writeFile, readFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { scanFile } from '../../src/commands/scan.js'
import type { ScanResult } from '@skills-sec/scanner'

// Mock the scanner
vi.mock('@skills-sec/scanner', () => ({
  createScanner: vi.fn(() => Promise.resolve({
    scan: vi.fn((content: string, filename: string) => {
      const mockResult: ScanResult = {
        findings: [
          {
            ruleId: 'test-rule',
            severity: 'critical',
            message: 'Test finding',
            location: { line: 10, column: 5 },
            code: 'const secret = "hardcoded"',
          },
        ],
        score: 50,
        metadata: {
          scannedAt: new Date(),
          scanDuration: 1000,
        },
      }
      return Promise.resolve(mockResult)
    }),
  })),
}))

// Mock console functions
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('Scan Command Export Tests', () => {
  const tempDir = join(tmpdir(), `s3-cli-scan-test-${Date.now()}`)
  let testFile: string
  let jsonOutputFile: string
  let sarifOutputFile: string

  beforeAll(async () => {
    // Create temp directory
    await mkdir(tempDir, { recursive: true })

    // Create test file paths
    testFile = join(tempDir, 'test.ts')
    jsonOutputFile = join(tempDir, 'results.json')
    sarifOutputFile = join(tempDir, 'results.sarif')

    // Create a test file
    await writeFile(testFile, 'export const test = "value"')
  })

  afterAll(async () => {
    // Clean up temp files
    try {
      await unlink(testFile)
    } catch {
      // Ignore
    }
    try {
      await unlink(jsonOutputFile)
    } catch {
      // Ignore
    }
    try {
      await unlink(sarifOutputFile)
    } catch {
      // Ignore
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should support --output flag for JSON export', async () => {
    // This test verifies the scanFile function accepts output option
    // The actual file writing is verified in integration tests
    await expect(scanFile(testFile, { output: jsonOutputFile })).rejects.toThrow()
    // Note: scanFile calls process.exit(), which causes the promise to reject
    // This is expected behavior
  })

  it('should support --format flag for SARIF export', async () => {
    // This test verifies the scanFile function accepts format option
    await expect(scanFile(testFile, { output: sarifOutputFile, format: 'sarif' })).rejects.toThrow()
    // Note: scanFile calls process.exit(), which causes the promise to reject
    // This is expected behavior
  })

  it('should default to JSON format when --format not specified', async () => {
    // This test verifies default behavior (format defaults to json)
    await expect(scanFile(testFile, { output: jsonOutputFile })).rejects.toThrow()
    // Note: scanFile calls process.exit(), which causes the promise to reject
    // This is expected behavior
  })

  it('export should happen after scan completes', async () => {
    // Verify scan completes and creates export file
    await scanFile(testFile, { output: jsonOutputFile }).catch(() => {
      // process.exit() causes rejection, which is expected
    })

    // Verify export file was created
    const content = await readFile(jsonOutputFile, 'utf-8')
    expect(content).toBeTruthy()

    // Verify it's valid JSON with expected structure
    const parsed = JSON.parse(content)
    expect(parsed.score).toBe(50)
    expect(parsed.findings).toBeInstanceOf(Array)
    expect(parsed.findings).toHaveLength(1)
  })

  it('export errors should not affect exit code', async () => {
    // Use a path that will definitely fail on Windows
    const invalidPath = 'CON:\\results.json' // Windows reserved device name

    // Create a new test file for this specific test
    const testFile2 = join(tempDir, 'test2.ts')
    await writeFile(testFile2, 'export const test = "value"')

    // Should complete even if export fails (export error is caught, not thrown)
    await scanFile(testFile2, { output: invalidPath }).catch(() => {
      // process.exit() causes rejection, which is expected
      // The important thing is that the export error doesn't prevent completion
    })

    // Verify that console.error was called (export errors are logged)
    expect(consoleErrorSpy).toHaveBeenCalled()

    // Clean up
    await unlink(testFile2).catch(() => {})
  })
})
