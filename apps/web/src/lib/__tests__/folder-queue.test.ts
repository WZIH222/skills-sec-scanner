/**
 * Folder Queue Tests
 *
 * Tests for folder job queue integration with BullMQ
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('folder-queue', () => {
  let mockFiles: File[]
  let mockAddJob: any

  beforeEach(() => {
    // Create mock files
    mockFiles = [
      new File(['content1'], 'file1.js', { type: 'text/javascript' }),
      new File(['content2'], 'file2.ts', { type: 'text/typescript' }),
      new File(['content3'], 'file3.json', { type: 'application/json' }),
    ]

    // Mock addJob function
    mockAddJob = vi.fn().mockResolvedValue('mock-job-id')

    // Mock ScanQueueService
    vi.doMock('@skills-sec/scanner', () => ({
      ScanQueueService: vi.fn().mockImplementation(() => ({
        addJob: mockAddJob,
      })),
    }))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('queueFolderFiles', () => {
    beforeEach(() => {
      mockAddJob.mockClear()
    })

    it('should queue each file as separate job', async () => {
      const { queueFolderFiles } = await import('@/lib/folder-queue')

      await queueFolderFiles({
        folderScanId: 'folder-123',
        files: mockFiles,
        userId: 'user-1',
        aiEnabled: true,
        policyMode: 'moderate',
      })

      expect(mockAddJob).toHaveBeenCalledTimes(3)
    })

    it('should pass correct job data for each file', async () => {
      const { queueFolderFiles } = await import('@/lib/folder-queue')

      await queueFolderFiles({
        folderScanId: 'folder-123',
        files: mockFiles,
        userId: 'user-1',
        aiEnabled: true,
        policyMode: 'moderate',
      })

      // Verify mock was called
      expect(mockAddJob).toHaveBeenCalled()

      // Verify first call has correct structure
      const firstCall = mockAddJob.mock.calls[0][0]
      expect(firstCall).toHaveProperty('fileId')
      expect(firstCall).toHaveProperty('filename')
      expect(firstCall).toHaveProperty('content')
      expect(firstCall).toHaveProperty('options')
      expect(firstCall.options).toHaveProperty('userId', 'user-1')
      expect(firstCall.options).toHaveProperty('aiEnabled', true)
      expect(firstCall.options).toHaveProperty('policyMode', 'moderate')
      expect(firstCall.options).toHaveProperty('folderScanId', 'folder-123')
    })

    it('should include folderScanId in job options', async () => {
      const { queueFolderFiles } = await import('@/lib/folder-queue')

      await queueFolderFiles({
        folderScanId: 'folder-456',
        files: mockFiles,
        userId: 'user-2',
        aiEnabled: false,
        policyMode: 'strict',
      })

      // Verify mock was called
      expect(mockAddJob).toHaveBeenCalled()

      // Verify folderScanId is passed correctly
      const firstCall = mockAddJob.mock.calls[0][0]
      expect(firstCall.options).toHaveProperty('folderScanId', 'folder-456')
      expect(firstCall.options).toHaveProperty('aiEnabled', false)
      expect(firstCall.options).toHaveProperty('policyMode', 'strict')
    })

    it('should log queued files count', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const { queueFolderFiles } = await import('@/lib/folder-queue')

      await queueFolderFiles({
        folderScanId: 'folder-123',
        files: mockFiles,
        userId: 'user-1',
        aiEnabled: true,
        policyMode: 'moderate',
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        '[FolderQueue] Queued 3 files for folder folder-123'
      )

      consoleSpy.mockRestore()
    })

    it('should handle empty file array', async () => {
      const { queueFolderFiles } = await import('@/lib/folder-queue')

      await queueFolderFiles({
        folderScanId: 'folder-123',
        files: [],
        userId: 'user-1',
        aiEnabled: true,
        policyMode: 'moderate',
      })

      expect(mockAddJob).not.toHaveBeenCalled()
    })

    it('should read file content correctly', async () => {
      const fileWithContent = new File(['const x = 1;'], 'test.js', {
        type: 'text/javascript',
      })

      const { queueFolderFiles } = await import('@/lib/folder-queue')

      await queueFolderFiles({
        folderScanId: 'folder-123',
        files: [fileWithContent],
        userId: 'user-1',
        aiEnabled: true,
        policyMode: 'moderate',
      })

      // Verify mock was called
      expect(mockAddJob).toHaveBeenCalled()

      // Verify content is read correctly
      const firstCall = mockAddJob.mock.calls[0][0]
      expect(firstCall).toHaveProperty('content', 'const x = 1;')
    })
  })
})
