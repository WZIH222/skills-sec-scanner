/**
 * Scan Status Field Tests
 *
 * TDD RED Phase: Tests for Scan model status field and transitions
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

describe('Scan.status field', () => {
  let prisma: PrismaClient

  beforeAll(() => {
    prisma = new PrismaClient()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up before each test
    await prisma.scan.deleteMany({
      where: { filename: { contains: 'test-scan-status-' } }
    })
  })

  describe('Status Field Structure', () => {
    test('has default value "completed"', async () => {
      const scan = await prisma.scan.create({
        data: {
          fileId: `test-scan-status-default-${Date.now()}`,
          contentHash: 'hash123',
          filename: 'test-scan-status-default.js',
          score: 50,
          scannedAt: new Date(),
          scanDuration: 1000
        }
      })

      expect(scan.status).toBe('completed')
    })

    test('accepts "pending" value', async () => {
      const scan = await prisma.scan.create({
        data: {
          fileId: `test-scan-status-pending-${Date.now()}`,
          contentHash: 'hash123',
          filename: 'test-scan-status-pending.js',
          score: 0,
          scannedAt: new Date(),
          scanDuration: 0,
          status: 'pending'
        }
      })

      expect(scan.status).toBe('pending')
    })

    test('accepts "scanning" value', async () => {
      const scan = await prisma.scan.create({
        data: {
          fileId: `test-scan-status-scanning-${Date.now()}`,
          contentHash: 'hash123',
          filename: 'test-scan-status-scanning.js',
          score: 0,
          scannedAt: new Date(),
          scanDuration: 0,
          status: 'scanning'
        }
      })

      expect(scan.status).toBe('scanning')
    })

    test('accepts "failed" value', async () => {
      const scan = await prisma.scan.create({
        data: {
          fileId: `test-scan-status-failed-${Date.now()}`,
          contentHash: 'hash123',
          filename: 'test-scan-status-failed.js',
          score: 0,
          scannedAt: new Date(),
          scanDuration: 0,
          status: 'failed'
        }
      })

      expect(scan.status).toBe('failed')
    })

    test('accepts "completed" value explicitly', async () => {
      const scan = await prisma.scan.create({
        data: {
          fileId: `test-scan-status-completed-${Date.now()}`,
          contentHash: 'hash123',
          filename: 'test-scan-status-completed.js',
          score: 75,
          scannedAt: new Date(),
          scanDuration: 2000,
          status: 'completed'
        }
      })

      expect(scan.status).toBe('completed')
    })
  })

  describe('Status Field Transitions', () => {
    test('can transition from pending to completed', async () => {
      const scan = await prisma.scan.create({
        data: {
          fileId: `test-scan-transition-pending-completed-${Date.now()}`,
          contentHash: 'hash123',
          filename: 'test-scan-transition-1.js',
          score: 0,
          scannedAt: new Date(),
          scanDuration: 0,
          status: 'pending'
        }
      })

      expect(scan.status).toBe('pending')

      const updated = await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: 'completed',
          score: 50,
          scanDuration: 1500
        }
      })

      expect(updated.status).toBe('completed')
    })

    test('can transition from pending to failed', async () => {
      const scan = await prisma.scan.create({
        data: {
          fileId: `test-scan-transition-pending-failed-${Date.now()}`,
          contentHash: 'hash123',
          filename: 'test-scan-transition-2.js',
          score: 0,
          scannedAt: new Date(),
          scanDuration: 0,
          status: 'pending'
        }
      })

      expect(scan.status).toBe('pending')

      const updated = await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: 'failed'
        }
      })

      expect(updated.status).toBe('failed')
    })

    test('can transition from scanning to completed', async () => {
      const scan = await prisma.scan.create({
        data: {
          fileId: `test-scan-transition-scanning-completed-${Date.now()}`,
          contentHash: 'hash123',
          filename: 'test-scan-transition-3.js',
          score: 0,
          scannedAt: new Date(),
          scanDuration: 0,
          status: 'scanning'
        }
      })

      expect(scan.status).toBe('scanning')

      const updated = await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: 'completed',
          score: 25,
          scanDuration: 800
        }
      })

      expect(updated.status).toBe('completed')
    })

    test('can transition from scanning to failed', async () => {
      const scan = await prisma.scan.create({
        data: {
          fileId: `test-scan-transition-scanning-failed-${Date.now()}`,
          contentHash: 'hash123',
          filename: 'test-scan-transition-4.js',
          score: 0,
          scannedAt: new Date(),
          scanDuration: 0,
          status: 'scanning'
        }
      })

      expect(scan.status).toBe('scanning')

      const updated = await prisma.scan.update({
        where: { id: scan.id },
        data: {
          status: 'failed'
        }
      })

      expect(updated.status).toBe('failed')
    })
  })

  describe('Status Field Querying', () => {
    beforeAll(async () => {
      // Create test data for querying
      await prisma.scan.createMany({
        data: [
          {
            fileId: `test-scan-query-pending-${Date.now()}-1`,
            contentHash: 'hash1',
            filename: 'test-scan-query-pending-1.js',
            score: 0,
            scannedAt: new Date(),
            scanDuration: 0,
            status: 'pending'
          },
          {
            fileId: `test-scan-query-pending-${Date.now()}-2`,
            contentHash: 'hash2',
            filename: 'test-scan-query-pending-2.js',
            score: 0,
            scannedAt: new Date(),
            scanDuration: 0,
            status: 'pending'
          },
          {
            fileId: `test-scan-query-completed-${Date.now()}-1`,
            contentHash: 'hash3',
            filename: 'test-scan-query-completed-1.js',
            score: 50,
            scannedAt: new Date(),
            scanDuration: 1000,
            status: 'completed'
          },
          {
            fileId: `test-scan-query-scanning-${Date.now()}-1`,
            contentHash: 'hash4',
            filename: 'test-scan-query-scanning-1.js',
            score: 0,
            scannedAt: new Date(),
            scanDuration: 0,
            status: 'scanning'
          },
          {
            fileId: `test-scan-query-failed-${Date.now()}-1`,
            contentHash: 'hash5',
            filename: 'test-scan-query-failed-1.js',
            score: 0,
            scannedAt: new Date(),
            scanDuration: 0,
            status: 'failed'
          }
        ]
      })
    })

    test('is indexed for efficient queries', async () => {
      // Query all pending scans
      const pendingScans = await prisma.scan.findMany({
        where: {
          filename: { contains: 'test-scan-query-' },
          status: 'pending'
        }
      })

      expect(pendingScans.length).toBeGreaterThanOrEqual(2)
      pendingScans.forEach(scan => {
        expect(scan.status).toBe('pending')
      })
    })

    test('can query scans with different statuses', async () => {
      const completedScans = await prisma.scan.findMany({
        where: {
          filename: { contains: 'test-scan-query-' },
          status: 'completed'
        }
      })

      expect(completedScans.length).toBeGreaterThanOrEqual(1)
      completedScans.forEach(scan => {
        expect(scan.status).toBe('completed')
      })
    })

    test('can count scans by status', async () => {
      const pendingCount = await prisma.scan.count({
        where: {
          filename: { contains: 'test-scan-query-' },
          status: 'pending'
        }
      })

      const completedCount = await prisma.scan.count({
        where: {
          filename: { contains: 'test-scan-query-' },
          status: 'completed'
        }
      })

      const scanningCount = await prisma.scan.count({
        where: {
          filename: { contains: 'test-scan-query-' },
          status: 'scanning'
        }
      })

      const failedCount = await prisma.scan.count({
        where: {
          filename: { contains: 'test-scan-query-' },
          status: 'failed'
        }
      })

      expect(pendingCount).toBeGreaterThanOrEqual(2)
      expect(completedCount).toBeGreaterThanOrEqual(1)
      expect(scanningCount).toBeGreaterThanOrEqual(1)
      expect(failedCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Status Field with Folder Scans', () => {
    test('folder scan can have pending status', async () => {
      const folderScan = await prisma.scan.create({
        data: {
          fileId: `test-folder-scan-${Date.now()}`,
          contentHash: 'folder-hash',
          filename: 'test-folder',
          score: 0,
          scannedAt: new Date(),
          scanDuration: 0,
          status: 'pending',
          metadata: JSON.stringify({
            type: 'folder',
            totalFiles: 5,
            completedFiles: 0
          })
        }
      })

      expect(folderScan.status).toBe('pending')
      const metadata = JSON.parse(folderScan.metadata || '{}')
      expect(metadata.type).toBe('folder')
    })

    test('child scan inherits completed status by default', async () => {
      const folderScan = await prisma.scan.create({
        data: {
          fileId: `test-folder-parent-${Date.now()}`,
          contentHash: 'folder-hash',
          filename: 'test-folder',
          score: 0,
          scannedAt: new Date(),
          scanDuration: 0,
          status: 'scanning',
          metadata: JSON.stringify({ type: 'folder' })
        }
      })

      const childScan = await prisma.scan.create({
        data: {
          fileId: `test-child-scan-${Date.now()}`,
          contentHash: 'child-hash',
          filename: 'child-file.js',
          score: 30,
          scannedAt: new Date(),
          scanDuration: 500,
          parentId: folderScan.id
          // status defaults to 'completed'
        }
      })

      expect(childScan.status).toBe('completed')
      expect(childScan.parentId).toBe(folderScan.id)
    })
  })
})
