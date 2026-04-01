/**
 * False Positive Route Handlers Tests
 *
 * TDD RED Phase: Unit tests for false positive route handlers
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'
import { generateToken } from '@/lib/auth'
import { POST } from '../scans/[id]/findings/[findingId]/false-positive/route'
import { DELETE } from '../scans/[id]/findings/[findingId]/false-positive/route'
import { GET } from '../false-positives/route'

const prisma = new PrismaClient()

describe('False Positive Route Handlers', () => {
  let userId: string
  let authToken: string
  let scanId: string
  let findingId: string

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test-fp-routes@example.com',
        passwordHash: 'hash123',
        name: 'Test FP Routes User'
      }
    })
    userId = user.id

    // Create auth token using jose
    authToken = await generateToken(user.id, user.email)

    // Create test scan
    const scan = await prisma.scan.create({
      data: {
        fileId: 'test-file-fp-routes',
        contentHash: 'hash-fp-routes',
        filename: 'test.js',
        score: 50,
        scannedAt: new Date(),
        scanDuration: 1000
      }
    })
    scanId = scan.id

    // Create findings separately
    const finding1 = await prisma.finding.create({
      data: {
        scanId: scan.id,
        ruleId: 'injection-rule',
        severity: 'critical',
        message: 'SQL injection detected',
        line: 10,
        column: 5,
        code: 'const query = `SELECT * FROM users WHERE id = ${userId}`'
      }
    })

    const finding2 = await prisma.finding.create({
      data: {
        scanId: scan.id,
        ruleId: 'file-access-rule',
        severity: 'high',
        message: 'File system access detected',
        line: 20,
        column: 10,
        code: 'fs.readFileSync("/etc/passwd")'
      }
    })

    findingId = finding1.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.falsePositive.deleteMany({})
    await prisma.finding.deleteMany({})
    await prisma.scan.deleteMany({
      where: { fileId: { contains: 'test-file-fp-routes' } }
    })
    await prisma.user.deleteMany({
      where: { email: 'test-fp-routes@example.com' }
    })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clear false positives before each test
    await prisma.falsePositive.deleteMany({})
  })

  describe('POST /api/scans/[id]/findings/[findingId]/false-positive', () => {
    test('Test 1: Creates false positive exclusion with valid data', async () => {
      const request = new Request(`http://localhost:3000/api/scans/${scanId}/findings/${findingId}/false-positive`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request, { params: { id: scanId, findingId } })

      expect(response.status).toBe(201)

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.id).toBeDefined()

      // Verify in database
      const fp = await prisma.falsePositive.findFirst({
        where: { userId }
      })
      expect(fp).toBeDefined()
      expect(fp?.ruleId).toBe('injection-rule')
    })

    test('Test 2: Returns 401 without valid JWT', async () => {
      const request = new Request(`http://localhost:3000/api/scans/${scanId}/findings/${findingId}/false-positive`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer invalid-token',
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request, { params: { id: scanId, findingId } })

      expect(response.status).toBe(401)
    })

    test('Test 3: Calculates codeHash from finding code', async () => {
      const request = new Request(`http://localhost:3000/api/scans/${scanId}/findings/${findingId}/false-positive`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

      const response = await POST(request, { params: { id: scanId, findingId } })

      expect(response.status).toBe(201)

      // Get finding to calculate expected hash
      const finding = await prisma.finding.findUnique({
        where: { id: findingId }
      })

      const expectedHash = createHash('sha256')
        .update(finding!.code || '')
        .digest('hex')

      // Verify hash in database
      const fp = await prisma.falsePositive.findFirst({
        where: { userId, ruleId: 'injection-rule' }
      })

      expect(fp?.codeHash).toBe(expectedHash)
    })
  })

  describe('DELETE /api/scans/[id]/findings/[findingId]/false-positive', () => {
    beforeEach(async () => {
      // Create a false positive for DELETE tests
      const finding = await prisma.finding.findUnique({
        where: { id: findingId }
      })

      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'injection-rule',
          codeHash: createHash('sha256').update(finding!.code || '').digest('hex'),
          filePath: 'test.js',
          lineNumber: 10
        }
      })
    })

    test('Test 4: Removes false positive exclusion', async () => {
      const request = new Request(`http://localhost:3000/api/scans/${scanId}/findings/${findingId}/false-positive`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      const response = await DELETE(request, { params: { id: scanId, findingId } })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)

      // Verify removed from database
      const fp = await prisma.falsePositive.findFirst({
        where: { userId, ruleId: 'injection-rule' }
      })
      expect(fp).toBeNull()
    })

    test('Test 5: Returns 401 without valid JWT', async () => {
      const request = new Request(`http://localhost:3000/api/scans/${scanId}/findings/${findingId}/false-positive`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      })

      const response = await DELETE(request, { params: { id: scanId, findingId } })

      expect(response.status).toBe(401)
    })
  })

  describe('GET /api/false-positives', () => {
    beforeEach(async () => {
      // Create multiple false positives
      await prisma.falsePositive.createMany({
        data: [
          {
            userId,
            ruleId: 'rule1',
            codeHash: 'hash1',
            filePath: '/path/1.js',
            lineNumber: 1
          },
          {
            userId,
            ruleId: 'rule2',
            codeHash: 'hash2',
            filePath: '/path/2.js',
            lineNumber: 2
          },
          {
            userId,
            ruleId: 'rule3',
            codeHash: 'hash3',
            filePath: '/path/3.js',
            lineNumber: 3
          }
        ]
      })
    })

    test('Test 6: Lists user false positives with pagination', async () => {
      const request = new Request('http://localhost:3000/api/false-positives?page=1&limit=2', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      const response = await GET(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.falsePositives).toBeDefined()
      expect(data.falsePositives.length).toBeLessThanOrEqual(2)
      expect(data.pagination).toBeDefined()
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(2)
    })

    test('Test 7: Returns 401 without valid JWT', async () => {
      const request = new Request('http://localhost:3000/api/false-positives', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      })

      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    test('Test 8: Returns only user false positives', async () => {
      // Create another user with false positives
      const otherUser = await prisma.user.create({
        data: {
          email: 'other-fp-list@example.com',
          passwordHash: 'hash123',
          name: 'Other List User'
        }
      })

      await prisma.falsePositive.create({
        data: {
          userId: otherUser.id,
          ruleId: 'other-rule',
          codeHash: 'other-hash',
          filePath: '/other/path.js',
          lineNumber: 99
        }
      })

      const request = new Request('http://localhost:3000/api/false-positives', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      const response = await GET(request)

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.falsePositives).toBeDefined()
      // Should only return false positives for the authenticated user
      expect(data.falsePositives.every((fp: any) => fp.userId === userId)).toBe(true)

      // Cleanup
      await prisma.falsePositive.deleteMany({ where: { userId: otherUser.id } })
      await prisma.user.delete({ where: { id: otherUser.id } })
    })
  })
})
