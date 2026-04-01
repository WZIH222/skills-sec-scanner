/**
 * Integration tests for Scan Repository (PostgreSQL storage)
 *
 * These tests require a running PostgreSQL instance.
 * They should be skipped if DATABASE_URL is not set.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaService } from '../../../src/storage/database/client'
import { ScanRepository } from '../../../src/storage/database/scan-repository'
import { ScanResult, Finding, Severity } from '../../../src/types'

// Check if database is available
const DATABASE_URL = process.env.DATABASE_URL || process.env.TEST_DATABASE_URL
const dbAvailable = !!DATABASE_URL

describe.skipIf(!dbAvailable)('ScanRepository - PostgreSQL Integration', () => {
  let prisma: PrismaService
  let repository: ScanRepository

  beforeAll(async () => {
    prisma = PrismaService.getInstance()
    repository = new ScanRepository(prisma)

    // Clean up any existing test data
    await cleanupTestData(prisma)
  })

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData(prisma)

    // Close connection
    await prisma.$disconnect()
  })

  /**
   * Test 1: ScanRepository creates scan with findings in database
   */
  it('should create scan with findings in database', async () => {
    const scanData = {
      fileId: `test-file-${Date.now()}`,
      contentHash: 'hash-123',
      filename: 'test.js',
      result: {
        findings: [
          {
            ruleId: 'test-rule-1',
            severity: 'critical' as Severity,
            message: 'Test critical finding',
            location: { line: 10, column: 5 },
            code: 'eval(userInput)',
          },
          {
            ruleId: 'test-rule-2',
            severity: 'high' as Severity,
            message: 'Test high finding',
            location: { line: 20, column: 10 },
            code: 'fetch(data)',
          },
        ],
        score: 85,
        metadata: {
          scannedAt: new Date(),
          scanDuration: 150,
        },
      } as ScanResult,
    }

    await repository.create(scanData)

    // Verify the scan was created
    const retrieved = await repository.findByFileId(scanData.fileId)
    expect(retrieved).toBeDefined()
    expect(retrieved?.findings).toHaveLength(2)
    expect(retrieved?.score).toBe(85)
    expect(retrieved?.findings[0].ruleId).toBe('test-rule-1')
  })

  /**
   * Test 2: ScanRepository finds scan by fileId
   */
  it('should find scan by fileId', async () => {
    const fileId = `test-file-${Date.now()}`
    const scanData = {
      fileId,
      contentHash: 'hash-find-by-id',
      filename: 'test2.js',
      result: {
        findings: [
          {
            ruleId: 'test-rule',
            severity: 'medium' as Severity,
            message: 'Test finding',
            location: { line: 5, column: 1 },
          },
        ],
        score: 30,
        metadata: {
          scannedAt: new Date(),
          scanDuration: 100,
        },
      } as ScanResult,
    }

    await repository.create(scanData)

    const retrieved = await repository.findByFileId(fileId)
    expect(retrieved).toBeDefined()
    expect(retrieved?.findings).toHaveLength(1)
    expect(retrieved?.findings[0].severity).toBe('medium')
  })

  /**
   * Test 3: ScanRepository finds scan by contentHash (for cache)
   */
  it('should find scan by contentHash', async () => {
    const contentHash = `hash-cache-${Date.now()}`
    const scanData1 = {
      fileId: 'file-1',
      contentHash,
      filename: 'cached.js',
      result: {
        findings: [],
        score: 0,
        metadata: {
          scannedAt: new Date(),
          scanDuration: 50,
        },
      } as ScanResult,
    }

    await repository.create(scanData1)

    const retrieved = await repository.findByContentHash(contentHash)
    expect(retrieved).toBeDefined()
    expect(retrieved?.score).toBe(0)
  })

  /**
   * Test 4: ScanRepository deletes old scans by retention date
   */
  it('should delete old scans by retention date', async () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 10) // 10 days ago

    // Create an old scan manually by setting scannedAt
    const oldScanData = {
      fileId: `old-file-${Date.now()}`,
      contentHash: 'old-hash',
      filename: 'old.js',
      result: {
        findings: [],
        score: 0,
        metadata: {
          scannedAt: oldDate,
          scanDuration: 100,
        },
      } as ScanResult,
    }

    await repository.create(oldScanData)

    // Delete scans older than 7 days
    const deletedCount = await repository.deleteOldScans(7)

    // Verify the old scan was deleted
    const retrieved = await repository.findByFileId(oldScanData.fileId)
    expect(retrieved).toBeNull()

    // At least one scan should have been deleted
    expect(deletedCount).toBeGreaterThanOrEqual(1)
  })

  /**
   * Test 5: ScanRepository handles missing scans gracefully
   */
  it('should return null for non-existent fileId', async () => {
    const retrieved = await repository.findByFileId('non-existent-file-id')
    expect(retrieved).toBeNull()
  })

  /**
   * Test 6: ScanRepository handles missing contentHash gracefully
   */
  it('should return null for non-existent contentHash', async () => {
    const retrieved = await repository.findByContentHash('non-existent-hash')
    expect(retrieved).toBeNull()
  })
})

/**
 * Helper function to clean up test data
 */
async function cleanupTestData(prisma: PrismaService): Promise<void> {
  try {
    // Delete test findings first (foreign key constraint)
    await prisma.finding.deleteMany({
      where: {
        scan: {
          fileId: {
            startsWith: 'test-file-',
          },
        },
      },
    })

    // Delete test scans
    await prisma.scan.deleteMany({
      where: {
        fileId: {
          startsWith: 'test-file-',
        },
      },
    })

    // Delete old file scans
    await prisma.finding.deleteMany({
      where: {
        scan: {
          fileId: {
            startsWith: 'old-file-',
          },
        },
      },
    })

    await prisma.scan.deleteMany({
      where: {
        fileId: {
          startsWith: 'old-file-',
        },
      },
    })
  } catch (error) {
    // Ignore cleanup errors
    console.error('Cleanup error:', error)
  }
}
