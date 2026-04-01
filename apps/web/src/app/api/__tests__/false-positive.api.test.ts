/**
 * False Positive API Endpoint Tests
 *
 * TDD RED Phase: Tests for false positive API endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import { createHash } from 'crypto'

const prisma = new PrismaClient()

const API_BASE = 'http://localhost:3000/api'

describe('False Positive API Endpoints', () => {
  let userId: string
  let authToken: string
  let scanId: string
  let findingId: string

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test-fp-api@example.com',
        passwordHash: 'hash123',
        name: 'Test FP API User'
      }
    })
    userId = user.id

    // Create auth token
    authToken = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    )

    // Create test scan with findings
    const scan = await prisma.scan.create({
      data: {
        fileId: 'test-file-fp-api',
        contentHash: 'hash-fp-api',
        filename: 'test.js',
        score: 50,
        scannedAt: new Date(),
        scanDuration: 1000,
        findings: {
          create: [
            {
              ruleId: 'injection-rule',
              severity: 'critical',
              message: 'SQL injection detected',
              line: 10,
              column: 5,
              code: 'const query = `SELECT * FROM users WHERE id = ${userId}`'
            },
            {
              ruleId: 'file-access-rule',
              severity: 'high',
              message: 'File system access detected',
              line: 20,
              column: 10,
              code: 'fs.readFileSync("/etc/passwd")'
            }
          ]
        }
      }
    })
    scanId = scan.id
    findingId = scan.findings[0]!.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.falsePositive.deleteMany({})
    await prisma.finding.deleteMany({})
    await prisma.scan.deleteMany({
      where: { fileId: { contains: 'test-file-fp-api' } }
    })
    await prisma.user.deleteMany({
      where: { email: 'test-fp-api@example.com' }
    })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clear false positives before each test
    await prisma.falsePositive.deleteMany({})
  })

  describe('POST /api/scans/{id}/findings/{findingId}/false-positive', () => {
    test('Test 1: Creates false positive exclusion', async () => {
      const response = await fetch(`${API_BASE}/scans/${scanId}/findings/${findingId}/false-positive`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

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

    test('Test 2: Validates JWT and scan ownership', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other-fp-api@example.com',
          passwordHash: 'hash123',
          name: 'Other User'
        }
      })

      const otherToken = jwt.sign(
        { userId: otherUser.id, email: otherUser.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      )

      const response = await fetch(`${API_BASE}/scans/${scanId}/findings/${findingId}/false-positive`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${otherToken}`,
          'Content-Type': 'application/json'
        }
      })

      // Should fail - user doesn't own this scan
      expect(response.status).toBe(403 || 404)

      // Cleanup
      await prisma.user.delete({ where: { id: otherUser.id } })
    })

    test('Test 3: Calculates codeHash from finding code', async () => {
      const response = await fetch(`${API_BASE}/scans/${scanId}/findings/${findingId}/false-positive`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })

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

  describe('DELETE /api/scans/{id}/findings/{findingId}/false-positive', () => {
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
      const response = await fetch(`${API_BASE}/scans/${scanId}/findings/${findingId}/false-positive`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.success).toBe(true)

      // Verify removed from database
      const fp = await prisma.falsePositive.findFirst({
        where: { userId, ruleId: 'injection-rule' }
      })
      expect(fp).toBeNull()
    })

    test('Test 5: Validates JWT and ownership', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other-fp-delete@example.com',
          passwordHash: 'hash123',
          name: 'Other Delete User'
        }
      })

      const otherToken = jwt.sign(
        { userId: otherUser.id, email: otherUser.email },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      )

      const response = await fetch(`${API_BASE}/scans/${scanId}/findings/${findingId}/false-positive`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${otherToken}`
        }
      })

      // Should fail - user doesn't own this false positive
      expect(response.status).toBe(403 || 404)

      // Verify false positive still exists
      const fp = await prisma.falsePositive.findFirst({
        where: { userId, ruleId: 'injection-rule' }
      })
      expect(fp).toBeDefined()

      // Cleanup
      await prisma.user.delete({ where: { id: otherUser.id } })
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
      const response = await fetch(`${API_BASE}/false-positives?page=1&limit=2`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.falsePositives).toBeDefined()
      expect(data.falsePositives.length).toBeLessThanOrEqual(2)
      expect(data.pagination).toBeDefined()
      expect(data.pagination.page).toBe(1)
      expect(data.pagination.limit).toBe(2)
    })

    test('Test 7: Validates JWT token', async () => {
      const response = await fetch(`${API_BASE}/false-positives`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      })

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

      const response = await fetch(`${API_BASE}/false-positives`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

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
