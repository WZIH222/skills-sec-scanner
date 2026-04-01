/**
 * Async Folder Upload Tests
 *
 * Tests for async folder upload behavior
 */

import { POST } from '../route'
import { NextRequest } from 'next/server'
import { prisma } from '@skills-sec/database'
import { verifyToken } from '@/lib/auth'

// Mock dependencies
vi.mock('@skills-sec/database')
vi.mock('@/lib/auth')
vi.mock('@/lib/folder-queue', () => ({
  queueFolderFiles: vi.fn().mockResolvedValue(undefined),
}))

describe('POST /api/scans - async folder upload', () => {
  let mockFormData: FormData
  let mockFiles: File[]

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Mock verifyToken
    const mockVerifyToken = verifyToken as any
    mockVerifyToken.mockResolvedValue({
      userId: 'test-user-id',
    })

    // Mock prisma.scan.create
    const mockCreate = prisma.scan.create as any
    mockCreate.mockResolvedValue({
      id: 'folder-scan-123',
      fileId: 'folder-123456',
      filename: 'test-folder',
      score: 0,
      status: 'pending',
      scannedAt: new Date(),
      scanDuration: 0,
      metadata: JSON.stringify({
        type: 'folder',
        userId: 'test-user-id',
        fileCount: 3,
        totalFiles: 3,
        completedFiles: 0,
      }),
    })

    // Create mock files
    mockFiles = [
      new File(['content1'], 'file1.js', { type: 'text/javascript' }),
      new File(['content2'], 'file2.ts', { type: 'text/typescript' }),
      new File(['content3'], 'file3.json', { type: 'application/json' }),
    ]

    // Create FormData
    mockFormData = new FormData()
    mockFiles.forEach(file => mockFormData.append('files', file))
  })

  it('returns immediately with jobId and status=pending', async () => {
    const request = new NextRequest('http://localhost:3000/api/scans', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'multipart/form-data',
      },
      body: mockFormData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('jobId', 'folder-scan-123')
    expect(data).toHaveProperty('status', 'pending')
    expect(data).toHaveProperty('type', 'folder')
    expect(data).toHaveProperty('message')
    expect(data.message).toContain('files queued for scanning')
  })

  it('creates folder scan record with status=pending', async () => {
    const request = new NextRequest('http://localhost:3000/api/scans', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'multipart/form-data',
      },
      body: mockFormData,
    })

    await POST(request)

    expect(prisma.scan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
          filename: 'test-folder',
          metadata: expect.stringContaining('"type":"folder"'),
        }),
      })
    )
  })

  it('queues individual file jobs in background', async () => {
    const { queueFolderFiles } = await import('@/lib/folder-queue')
    const request = new NextRequest('http://localhost:3000/api/scans', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'multipart/form-data',
      },
      body: mockFormData,
    })

    await POST(request)

    expect(queueFolderFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        folderScanId: 'folder-scan-123',
        files: expect.any(Array),
        userId: 'test-user-id',
        aiEnabled: false,
        policyMode: expect.any(String),
      })
    )
  })

  it('validates file extensions before queuing', async () => {
    // Add invalid file type
    const invalidFile = new File(['content'], 'invalid.txt', {
      type: 'text/plain',
    })
    mockFormData.append('files', invalidFile)

    const request = new NextRequest('http://localhost:3000/api/scans', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'multipart/form-data',
      },
      body: mockFormData,
    })

    await POST(request)

    // Should only queue valid files (js, ts, json, md)
    const { queueFolderFiles } = await import('@/lib/folder-queue')
    const callArgs = (queueFolderFiles as any).mock.calls[0][0]
    expect(callArgs.files).toHaveLength(3) // Only valid files
  })

  it('validates total folder size limit', async () => {
    // Create files exceeding 50MB limit
    const largeFiles = Array.from({ length: 10 }, (_, i) =>
      new File(['x'.repeat(6 * 1024 * 1024)], `large${i}.js`, {
        type: 'text/javascript',
      })
    )

    const largeFormData = new FormData()
    largeFiles.forEach(file => largeFormData.append('files', file))

    const request = new NextRequest('http://localhost:3000/api/scans', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'multipart/form-data',
      },
      body: largeFormData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error')
    expect(data.error).toContain('exceeds 50MB limit')
  })

  it('handles empty folder after filtering', async () => {
    const invalidFormData = new FormData()
    // Only add invalid file types
    invalidFormData.append('files', new File(['content'], 'invalid.txt', {
      type: 'text/plain',
    }))

    const request = new NextRequest('http://localhost:3000/api/scans', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'multipart/form-data',
      },
      body: invalidFormData,
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty('error', 'No valid files found in folder')
  })

  it('updates folder status to failed on queue error', async () => {
    // Mock queueFolderFiles to throw error
    const { queueFolderFiles } = await import('@/lib/folder-queue')
    ;(queueFolderFiles as any).mockRejectedValueOnce(
      new Error('Queue connection failed')
    )

    // Mock prisma.scan.update
    const mockUpdate = prisma.scan.update as any
    mockUpdate.mockResolvedValue({})

    const request = new NextRequest('http://localhost:3000/api/scans', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer mock-token',
        'Content-Type': 'multipart/form-data',
      },
      body: mockFormData,
    })

    // Response should still be returned immediately
    const response = await POST(request)
    expect(response.status).toBe(200)

    // Give time for the catch block to execute
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify status update was attempted
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'folder-scan-123' },
        data: { status: 'failed' },
      })
    )
  })
})
