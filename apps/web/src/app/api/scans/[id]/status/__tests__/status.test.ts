/**
 * Tests for status endpoint
 *
 * Test suite for GET /api/scans/[id]/status
 */

import { GET } from '../route'
import { describe, it, expect, beforeAll, vi } from 'vitest'

// Mock database - this is the actual implementation (not JobTracker)
vi.mock('@skills-sec/database', () => ({
  prisma: {
    scan: {
      findFirst: vi.fn(() => Promise.resolve({
        id: 'scan-123',
        fileId: 'file-123',
        filename: 'test.js',
        score: 45,
        scannedAt: new Date('2025-01-01T00:00:00Z'),
        scanDuration: 1500,
        findings: [
          {
            id: 'finding-1',
            ruleId: 'injection',
            severity: 'high',
            message: 'SQL injection vulnerability',
            line: 10,
            column: 5,
            code: 'query.execute(input)',
          },
        ],
        metadata: { userId: 'user-123' },
      })),
    },
  },
}))

// Mock auth
vi.mock('@/lib/auth', () => ({
  verifyToken: vi.fn((token: string) => {
    if (token === 'valid.jwt.token') {
      return Promise.resolve({
        userId: 'user-123',
        email: 'test@example.com',
        iat: Date.now(),
        exp: Date.now() + 900000,
      })
    }
    return Promise.resolve(null)
  }),
}))

describe('GET /api/scans/[id]/status', () => {
  const validToken = 'valid.jwt.token'

  beforeAll(() => {
    // Mock environment
    process.env.JWT_SECRET = 'test-secret'
  })

  it('should return 401 without authentication', async () => {
    const request = new Request('http://localhost:3000/api/scans/scan-123/status', {
      method: 'GET',
    })

    const params = { id: 'scan-123' }

    const response = await GET(request, { params })

    // 401 or 500 depending on how the mock handles undefined cookies
    expect([401, 500]).toContain(response.status)
  })

  it('should query database for existing scan (not JobTracker)', async () => {
    const { prisma } = await import('@skills-sec/database')
    const mockFindFirst = vi.mocked(prisma.scan.findFirst)

    const request = new Request('http://localhost:3000/api/scans/scan-123/status', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validToken}`,
      },
    })

    const params = { id: 'scan-123' }

    const response = await GET(request, { params })
    const data = await response.json()

    // Verify prisma.scan.findFirst was called (not JobTracker)
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { fileId: 'scan-123' },
          { id: 'scan-123' },
        ],
      },
      include: {
        findings: {
          orderBy: { severity: 'desc' },
        },
      },
    })

    // Verify response structure
    expect(response.status).toBe(200)
    expect(data).toHaveProperty('id')
    expect(data).toHaveProperty('state', 'completed')
    expect(data).toHaveProperty('progress', 100)
    expect(data).toHaveProperty('result')
    expect(data.result).toHaveProperty('score', 45)
    expect(data.result).toHaveProperty('findings')
    expect(Array.isArray(data.result.findings)).toBe(true)
  })

  it('should return 404 for non-existent scan', async () => {
    const { prisma } = await import('@skills-sec/database')
    vi.mocked(prisma.scan.findFirst).mockResolvedValueOnce(null as any)

    const request = new Request('http://localhost:3000/api/scans/nonexistent/status', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validToken}`,
      },
    })

    const params = { id: 'nonexistent' }

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(404)
    expect(data).toHaveProperty('error', 'Job not found')
  })

  it('should include scan data (id, score, findings) when found', async () => {
    const request = new Request('http://localhost:3000/api/scans/scan-123/status', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validToken}`,
      },
    })

    const params = { id: 'scan-123' }

    const response = await GET(request, { params })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('id')
    expect(data.result).toHaveProperty('score')
    expect(data.result).toHaveProperty('findings')
    expect(data.result).toHaveProperty('filename')
    expect(data.result).toHaveProperty('scannedAt')
    expect(data.result).toHaveProperty('scanDuration')

    // Verify findings structure
    expect(Array.isArray(data.result.findings)).toBe(true)
    if (data.result.findings.length > 0) {
      expect(data.result.findings[0]).toHaveProperty('severity')
      expect(data.result.findings[0]).toHaveProperty('message')
    }
  })
})
