/**
 * Unit Tests for Folder Worker
 *
 * Tests the BullMQ worker for processing individual file scans in folder uploads:
 * - File scanning and child scan record creation
 * - Folder progress tracking and metadata updates
 * - Progress event emission
 * - Folder finalization when all files complete
 * - Failed scan handling and retry logic
 *
 * Note: These tests mock Prisma and Scanner to isolate worker logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Job } from 'bullmq'

// Mock modules before importing
vi.mock('@skills-sec/database', () => ({
  prisma: {
    scan: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@skills-sec/scanner', () => ({
  createScanner: vi.fn(),
}))

import { prisma } from '@skills-sec/database'
import { createScanner } from '@skills-sec/scanner'
import { processFolderFile } from '../../../src/workers/folder-worker'

// Get mocked functions
const mockPrisma = prisma as any
const mockCreateScanner = createScanner as any

describe('processFolderFile', () => {
  const mockJob = {
    id: 'test-job-1',
    data: {
      folderScanId: 'folder-scan-123',
      content: 'console.log("test")',
      filename: 'test.ts',
      userId: 'user-123',
      aiEnabled: true,
      policyMode: 'MODERATE',
    },
  } as unknown as Job

  const mockScanResult = {
    fileId: 'file-456',
    score: 25,
    findings: [
      {
        ruleId: 'console-log',
        severity: 'low',
        message: 'Console.log statement',
        location: { line: 1, column: 1 },
      },
    ],
    metadata: {
      scannedAt: new Date(),
      scanDuration: 100,
      aiAnalysis: true,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should scan file content and create child scan record', async () => {
    // Arrange
    const mockScanner = {
      scan: vi.fn().mockResolvedValue(mockScanResult),
    }
    mockCreateScanner.mockResolvedValue(mockScanner)

    mockPrisma.scan.findUnique.mockResolvedValue({
      id: 'folder-scan-123',
      metadata: JSON.stringify({ totalFiles: 3, completedFiles: 0 }),
    })

    mockPrisma.scan.create.mockResolvedValue({
      id: 'child-scan-1',
    })

    mockPrisma.scan.update.mockResolvedValue({
      id: 'folder-scan-123',
    })

    // Act
    const result = await processFolderFile(mockJob)

    // Assert
    expect(mockScanner.scan).toHaveBeenCalledWith(
      'console.log("test")',
      'test.ts',
      {
        userId: 'user-123',
        aiEnabled: true,
        policyMode: 'MODERATE',
      }
    )

    expect(mockPrisma.scan.create).toHaveBeenCalledWith({
      data: {
        fileId: 'file-456',
        filename: 'test.ts',
        score: 25,
        status: 'completed',
        scannedAt: expect.any(Date),
        scanDuration: 100,
        parentId: 'folder-scan-123',
        metadata: JSON.stringify({
          userId: 'user-123',
          findingsCount: 1,
        }),
      },
    })

    expect(result).toEqual(mockScanResult)
  })

  it('should update folder progress metadata', async () => {
    // Arrange
    const mockScanner = {
      scan: vi.fn().mockResolvedValue(mockScanResult),
    }
    mockCreateScanner.mockResolvedValue(mockScanner)

    mockPrisma.scan.findUnique.mockResolvedValue({
      id: 'folder-scan-123',
      metadata: JSON.stringify({ totalFiles: 3, completedFiles: 1 }),
    })

    mockPrisma.scan.create.mockResolvedValue({ id: 'child-scan-1' })

    const updateCalls: any[] = []
    mockPrisma.scan.update.mockImplementation((params: any) => {
      updateCalls.push(params)
      return Promise.resolve({ id: 'folder-scan-123' })
    })

    // Act
    await processFolderFile(mockJob)

    // Assert
    expect(updateCalls).toHaveLength(1) // Only progress update (not finalizing yet)

    // First call should update completedFiles from 1 to 2
    const progressUpdate = updateCalls[0]
    const metadata = JSON.parse(progressUpdate.data.metadata)
    expect(metadata.completedFiles).toBe(2)
    expect(metadata.totalFiles).toBe(3)
  })

  it('should emit progress event after each file', async () => {
    // Arrange
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const mockScanner = {
      scan: vi.fn().mockResolvedValue(mockScanResult),
    }
    mockCreateScanner.mockResolvedValue(mockScanner)

    mockPrisma.scan.findUnique.mockResolvedValue({
      id: 'folder-scan-123',
      metadata: JSON.stringify({ totalFiles: 3, completedFiles: 0 }),
    })

    mockPrisma.scan.create.mockResolvedValue({ id: 'child-scan-1' })
    mockPrisma.scan.update.mockResolvedValue({ id: 'folder-scan-123' })

    // Act
    await processFolderFile(mockJob)

    // Assert
    const progressCalls = consoleSpy.mock.calls.filter(call =>
      call[0] && call[0].includes && call[0].includes('[FolderWorker] Progress:')
    )
    expect(progressCalls.length).toBeGreaterThan(0)
    expect(progressCalls[0][0]).toContain('1/3')
    expect(progressCalls[0][0]).toContain('test.ts')

    consoleSpy.mockRestore()
  })

  it('should finalize folder scan when all files complete', async () => {
    // Arrange
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const mockScanner = {
      scan: vi.fn().mockResolvedValue(mockScanResult),
    }
    mockCreateScanner.mockResolvedValue(mockScanner)

    // Last file (2 of 2 completed -> 3/3)
    mockPrisma.scan.findUnique
      .mockResolvedValueOnce({
        id: 'folder-scan-123',
        metadata: JSON.stringify({ totalFiles: 3, completedFiles: 2 }),
      })
      .mockResolvedValueOnce({
        id: 'folder-scan-123',
        files: [
          { id: 'child-1', score: 10, metadata: JSON.stringify({ findingsCount: 2 }) },
          { id: 'child-2', score: 50, metadata: JSON.stringify({ findingsCount: 5 }) },
          { id: 'child-3', score: 25, metadata: JSON.stringify({ findingsCount: 3 }) },
        ],
        metadata: JSON.stringify({ totalFiles: 3, completedFiles: 2 }),
      })

    mockPrisma.scan.create.mockResolvedValue({ id: 'child-scan-3' })

    const updateCalls: any[] = []
    mockPrisma.scan.update.mockImplementation((params: any) => {
      updateCalls.push(params)
      return Promise.resolve({ id: 'folder-scan-123' })
    })

    // Act
    await processFolderFile(mockJob)

    // Assert
    // Should have 2 update calls (progress + finalization)
    expect(updateCalls.length).toBeGreaterThanOrEqual(2)

    // Last call should finalize folder with highest score and total findings
    const finalizationCall = updateCalls[updateCalls.length - 1]
    expect(finalizationCall.data.status).toBe('completed')
    expect(finalizationCall.data.score).toBe(50) // Max of [10, 50, 25]
    expect(finalizationCall.data.metadata).toContain('"totalFindings":10')

    consoleSpy.mockRestore()
  })

  it('should handle scan failures gracefully', async () => {
    // Arrange
    const mockScanner = {
      scan: vi.fn().mockRejectedValue(new Error('Scan failed')),
    }
    mockCreateScanner.mockResolvedValue(mockScanner)

    // Act & Assert
    await expect(processFolderFile(mockJob)).rejects.toThrow('Scan failed')

    // Should not create child scan record on failure
    expect(mockPrisma.scan.create).not.toHaveBeenCalled()
  })

  it('should throw error when folder scan not found', async () => {
    // Arrange
    const mockScanner = {
      scan: vi.fn().mockResolvedValue(mockScanResult),
    }
    mockCreateScanner.mockResolvedValue(mockScanner)

    mockPrisma.scan.findUnique.mockResolvedValue(null)
    mockPrisma.scan.create.mockResolvedValue({ id: 'child-scan-1' })

    // Act & Assert
    await expect(processFolderFile(mockJob)).rejects.toThrow(
      'Folder scan folder-scan-123 not found'
    )
  })
})
