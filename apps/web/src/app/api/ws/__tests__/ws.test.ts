/**
 * Tests for SSE endpoint
 *
 * Test suite for GET /api/ws
 */

import { GET } from '../route'
import { describe, it, expect, beforeAll, vi } from 'vitest'

// Mock database - this is the actual implementation (not placeholder)
vi.mock('@skills-sec/database', () => ({
  prisma: {
    scan: {
      findFirst: vi.fn(() => Promise.resolve({
        id: 'scan-123',
        fileId: 'file-123',
        filename: 'test.js',
        score: 65,
        scannedAt: new Date('2025-01-01T00:00:00Z'),
        scanDuration: 2000,
        findings: [
          {
            id: 'finding-1',
            ruleId: 'credentials',
            severity: 'critical',
            message: 'Hardcoded API key detected',
            line: 5,
            column: 10,
            code: 'const key = "sk-1234567890"',
          },
          {
            id: 'finding-2',
            ruleId: 'network',
            severity: 'medium',
            message: 'Unverified HTTP request',
            line: 15,
            column: 8,
          },
        ],
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

describe('GET /api/ws', () => {
  const validToken = 'valid.jwt.token'

  beforeAll(() => {
    // Mock environment
    process.env.JWT_SECRET = 'test-secret'
  })

  it('should return 401 without authentication', async () => {
    const request = new Request('http://localhost:3000/api/ws?jobId=scan-123', {
      method: 'GET',
    })

    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  it('should query database for actual scan results (not placeholder)', async () => {
    const { prisma } = await import('@skills-sec/database')
    const mockFindFirst = vi.mocked(prisma.scan.findFirst)

    const request = new Request('http://localhost:3000/api/ws?jobId=scan-123', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid.jwt.token',
      },
    })

    const response = await GET(request)

    // Verify prisma.scan.findFirst was called (not placeholder data)
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

    // Verify SSE response headers
    expect(response.headers.get('Content-Type')).toBe('text/event-stream')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    expect(response.headers.get('Connection')).toBe('keep-alive')
  })

  it('should return scan:complete event with real data', async () => {
    const request = new Request('http://localhost:3000/api/ws?jobId=scan-123', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid.jwt.token',
      },
    })

    const response = await GET(request)

    // Read the SSE stream
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    let eventData = ''
    if (reader) {
      const { done, value } = await reader.read()
      if (!done) {
        eventData += decoder.decode(value)
      }
    }

    // Verify SSE format
    expect(eventData).toContain('data:')

    // Parse the event data
    const match = eventData.match(/data:\s*(.+?)\n\n/)
    expect(match).toBeTruthy()

    if (match) {
      const event = JSON.parse(match[1])
      expect(event).toHaveProperty('type', 'scan:complete')
      expect(event.data).toHaveProperty('jobId', 'scan-123')
      expect(event.data).toHaveProperty('result')

      // Verify result contains actual data (not placeholder { score: 0 })
      expect(event.data.result).toHaveProperty('score')
      expect(event.data.result.score).toBeGreaterThan(0) // Not placeholder score: 0
      expect(event.data.result).toHaveProperty('findings')
      expect(Array.isArray(event.data.result.findings)).toBe(true)

      // Verify findings structure
      if (event.data.result.findings.length > 0) {
        expect(event.data.result.findings[0]).toHaveProperty('severity')
        expect(event.data.result.findings[0]).toHaveProperty('message')
      }
    }
  })

  it('should verify response is not placeholder { id, score: 0 }', async () => {
    const request = new Request('http://localhost:3000/api/ws?jobId=scan-123', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer valid.jwt.token',
      },
    })

    const response = await GET(request)

    // Read the SSE stream
    const reader = response.body?.getReader()
    const decoder = new TextDecoder()

    let eventData = ''
    if (reader) {
      const { done, value } = await reader.read()
      if (!done) {
        eventData += decoder.decode(value)
      }
    }

    // Parse the event data
    const match = eventData.match(/data:\s*(.+?)\n\n/)
    expect(match).toBeTruthy()

    if (match) {
      const event = JSON.parse(match[1])
      const result = event.data.result

      // Verify this is NOT placeholder data
      expect(result).not.toEqual({ id: 'scan-123', score: 0 })
      expect(result.score).not.toBe(0)
      expect(result).toHaveProperty('findings')
      expect(result).toHaveProperty('filename')
      expect(result).toHaveProperty('scannedAt')
    }
  })
})
