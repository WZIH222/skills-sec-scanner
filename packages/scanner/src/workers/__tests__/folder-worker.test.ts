import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { processFolderFile } from '../folder-worker'
import { prisma } from '@skills-sec/database'
import { eventBus } from '../sse-event-bus'

// Mock database
vi.mock('@skills-sec/database', () => ({
  prisma: {
    scan: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Mock scanner
vi.mock('@skills-sec/scanner', () => ({
  createScanner: vi.fn(async () => ({
    scan: vi.fn(async (content: string, filename: string, options: any) => ({
      fileId: `file-${Date.now()}`,
      filename,
      score: 42,
      findings: [],
      metadata: { scanDuration: 100 },
    })),
  })),
}))

describe('folder-worker', () => {
  let progressEvents: any[] = []
  let completeEvents: any[] = []

  beforeEach(() => {
    progressEvents = []
    completeEvents = []

    // Listen to event bus
    eventBus.on('folder:progress', (data) => {
      progressEvents.push(data)
    })

    eventBus.on('folder:complete', (data) => {
      completeEvents.push(data)
    })
  })

  afterEach(() => {
    eventBus.removeAllListeners()
    vi.clearAllMocks()
  })

  describe('processFolderFile', () => {
    it('should process a file and emit folder progress event', async () => {
      const mockJob = {
        data: {
          folderScanId: 'folder-123',
          content: 'console.log("test")',
          filename: 'test.js',
          userId: 'user-123',
          aiEnabled: false,
          policyMode: 'strict',
        },
      } as any

      // Mock database responses
      vi.mocked(prisma.scan.findUnique).mockResolvedValueOnce({
        id: 'folder-123',
        metadata: JSON.stringify({
          totalFiles: 5,
          completedFiles: 0,
        }),
      } as any)

      vi.mocked(prisma.scan.create).mockResolvedValueOnce({} as any)
      vi.mocked(prisma.scan.update).mockResolvedValueOnce({} as any)

      await processFolderFile(mockJob)

      // Verify progress event was emitted
      expect(progressEvents).toHaveLength(1)
      expect(progressEvents[0]).toMatchObject({
        jobId: 'folder-123',
        filename: 'test.js',
        completed: 1,
        total: 5,
        score: 42,
      })
    })

    it('should emit folder complete event when all files processed', async () => {
      const mockJob = {
        data: {
          folderScanId: 'folder-123',
          content: 'console.log("test")',
          filename: 'last.js',
          userId: 'user-123',
          aiEnabled: false,
          policyMode: 'strict',
        },
      } as any

      // Mock database responses for last file (5/5)
      vi.mocked(prisma.scan.findUnique)
        .mockResolvedValueOnce({
          id: 'folder-123',
          metadata: JSON.stringify({
            totalFiles: 5,
            completedFiles: 4,
          }),
        } as any)
        .mockResolvedValueOnce({
          id: 'folder-123',
          files: [
            { score: 10, metadata: '{"findingsCount": 2}' },
            { score: 20, metadata: '{"findingsCount": 1}' },
            { score: 30, metadata: '{"findingsCount": 3}' },
            { score: 40, metadata: '{"findingsCount": 1}' },
            { score: 50, metadata: '{"findingsCount": 2}' },
          ],
          metadata: JSON.stringify({
            totalFiles: 5,
            completedFiles: 4,
          }),
        } as any)

      vi.mocked(prisma.scan.create).mockResolvedValueOnce({} as any)
      vi.mocked(prisma.scan.update).mockResolvedValueOnce({} as any)

      await processFolderFile(mockJob)

      // Verify complete event was emitted
      expect(completeEvents).toHaveLength(1)
      expect(completeEvents[0]).toMatchObject({
        jobId: 'folder-123',
        summary: {
          totalFiles: 5,
          totalFindings: 9,
          highestScore: 50,
        },
      })
    })

    it('should create child scan record with correct data', async () => {
      const mockJob = {
        data: {
          folderScanId: 'folder-123',
          content: 'console.log("test")',
          filename: 'test.js',
          userId: 'user-123',
          aiEnabled: false,
          policyMode: 'strict',
        },
      } as any

      vi.mocked(prisma.scan.findUnique).mockResolvedValueOnce({
        id: 'folder-123',
        metadata: JSON.stringify({
          totalFiles: 5,
          completedFiles: 0,
        }),
      } as any)

      vi.mocked(prisma.scan.create).mockResolvedValueOnce({} as any)
      vi.mocked(prisma.scan.update).mockResolvedValueOnce({} as any)

      await processFolderFile(mockJob)

      // Verify child scan was created
      expect(prisma.scan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            filename: 'test.js',
            score: 42,
            status: 'completed',
            parentId: 'folder-123',
          }),
        })
      )
    })

    it('should update folder progress metadata', async () => {
      const mockJob = {
        data: {
          folderScanId: 'folder-123',
          content: 'console.log("test")',
          filename: 'test.js',
          userId: 'user-123',
          aiEnabled: false,
          policyMode: 'strict',
        },
      } as any

      vi.mocked(prisma.scan.findUnique).mockResolvedValueOnce({
        id: 'folder-123',
        metadata: JSON.stringify({
          totalFiles: 5,
          completedFiles: 2,
        }),
      } as any)

      vi.mocked(prisma.scan.create).mockResolvedValueOnce({} as any)
      vi.mocked(prisma.scan.update).mockResolvedValueOnce({} as any)

      await processFolderFile(mockJob)

      // Verify folder progress was updated
      expect(prisma.scan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'folder-123' },
          data: expect.objectContaining({
            metadata: expect.stringContaining('"completedFiles":3'),
          }),
        })
      )
    })

    it('should handle errors and rethrow for BullMQ retry', async () => {
      const mockJob = {
        data: {
          folderScanId: 'folder-123',
          content: 'console.log("test")',
          filename: 'test.js',
          userId: 'user-123',
          aiEnabled: false,
          policyMode: 'strict',
        },
      } as any

      // Mock error - folder not found
      vi.mocked(prisma.scan.findUnique).mockResolvedValueOnce(null as any)

      await expect(processFolderFile(mockJob)).rejects.toThrow()
    })
  })
})
