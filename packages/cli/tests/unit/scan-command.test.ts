/**
 * Unit tests for scan command implementation
 *
 * Tests verify:
 * - scanFile function reads file content from disk
 * - scanFile creates scanner via createScanner factory
 * - scanFile passes aiEnabled flag to scanner.scan()
 * - scanFile calls process.exit(1) when findings.length > 0
 * - scanFile calls process.exit(0) when findings.length === 0
 * - scanFile handles file not found errors with friendly message
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFile } from 'fs/promises'
import { scanFile } from '../../src/commands/scan.js'

// Mock the scanner module
vi.mock('@skills-sec/scanner', () => ({
  createScanner: vi.fn(),
}))

// Mock process.exit
const originalExit = process.exit
let mockExit: ReturnType<typeof vi.fn>

describe('Scan Command', () => {
  beforeEach(() => {
    mockExit = vi.fn()
    process.exit = mockExit as any
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.exit = originalExit
  })

  describe('file reading', () => {
    it('should read file content from disk', async () => {
      // This test will fail until we implement scanFile
      const { createScanner } = await import('@skills-sec/scanner')
      const mockScanner = {
        scan: vi.fn().mockResolvedValue({
          findings: [],
          score: 0,
          metadata: { scannedAt: new Date(), scanDuration: 100 },
        }),
      }
      vi.mocked(createScanner).mockResolvedValue(mockScanner as any)

      // Mock readFile
      vi.mock('fs/promises')
      vi.mocked(readFile).mockResolvedValue('const x = 1;')

      await scanFile('test.ts', {})

      expect(readFile).toHaveBeenCalledWith('test.ts', 'utf-8')
    })

    it('should handle file not found errors with friendly message', async () => {
      const error = new Error('File not found: test.ts') as any
      error.code = 'ENOENT'

      vi.mocked(readFile).mockRejectedValue(error)

      await expect(scanFile('test.ts', {})).rejects.toThrow('File not found')
    })
  })

  describe('scanner integration', () => {
    it('should create scanner via createScanner factory', async () => {
      const { createScanner } = await import('@skills-sec/scanner')
      const mockScanner = {
        scan: vi.fn().mockResolvedValue({
          findings: [],
          score: 0,
          metadata: { scannedAt: new Date(), scanDuration: 100 },
        }),
      }
      vi.mocked(createScanner).mockResolvedValue(mockScanner as any)

      vi.mocked(readFile).mockResolvedValue('const x = 1;')

      await scanFile('test.ts', {})

      expect(createScanner).toHaveBeenCalled()
    })

    it('should pass aiEnabled flag to scanner.scan()', async () => {
      const { createScanner } = await import('@skills-sec/scanner')
      const mockScanner = {
        scan: vi.fn().mockResolvedValue({
          findings: [],
          score: 0,
          metadata: { scannedAt: new Date(), scanDuration: 100 },
        }),
      }
      vi.mocked(createScanner).mockResolvedValue(mockScanner as any)

      vi.mocked(readFile).mockResolvedValue('const x = 1;')

      await scanFile('test.ts', { ai: true })

      expect(mockScanner.scan).toHaveBeenCalledWith(
        'const x = 1;',
        'test.ts',
        expect.objectContaining({ aiEnabled: true })
      )
    })
  })

  describe('exit codes', () => {
    it('should call process.exit(1) when findings.length > 0', async () => {
      const { createScanner } = await import('@skills-sec/scanner')
      const mockScanner = {
        scan: vi.fn().mockResolvedValue({
          findings: [{ ruleId: 'test', severity: 'high', message: 'Test finding', location: { line: 1, column: 1 } }],
          score: 30,
          metadata: { scannedAt: new Date(), scanDuration: 100 },
        }),
      }
      vi.mocked(createScanner).mockResolvedValue(mockScanner as any)

      vi.mocked(readFile).mockResolvedValue('const x = 1;')

      await scanFile('test.ts', {})

      expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should call process.exit(0) when findings.length === 0', async () => {
      const { createScanner } = await import('@skills-sec/scanner')
      const mockScanner = {
        scan: vi.fn().mockResolvedValue({
          findings: [],
          score: 0,
          metadata: { scannedAt: new Date(), scanDuration: 100 },
        }),
      }
      vi.mocked(createScanner).mockResolvedValue(mockScanner as any)

      vi.mocked(readFile).mockResolvedValue('const x = 1;')

      await scanFile('test.ts', {})

      expect(mockExit).toHaveBeenCalledWith(0)
    })
  })
})
