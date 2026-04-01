/**
 * FalsePositive Schema Tests
 *
 * TDD RED Phase: Tests for FalsePositive model structure and constraints
 */

import { PrismaClient } from '@prisma/client'

describe('FalsePositive Schema', () => {
  let prisma: PrismaClient

  beforeAll(() => {
    prisma = new PrismaClient()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clean up before each test
    await prisma.falsePositive.deleteMany({})
    await prisma.user.deleteMany({
      where: { email: { contains: 'test-fp-' } }
    })
  })

  describe('FalsePositive Model Structure', () => {
    test('Test 1: FalsePositive model has userId, ruleId, codeHash, filePath, lineNumber', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: 'test-fp-1@example.com',
          passwordHash: 'hash123',
          name: 'Test User 1'
        }
      })

      // Create a false positive
      const falsePositive = await prisma.falsePositive.create({
        data: {
          userId: user.id,
          ruleId: 'injection-rule',
          codeHash: 'abc123def456',
          filePath: '/path/to/file.js',
          lineNumber: 42
        }
      })

      expect(falsePositive.userId).toBe(user.id)
      expect(falsePositive.ruleId).toBe('injection-rule')
      expect(falsePositive.codeHash).toBe('abc123def456')
      expect(falsePositive.filePath).toBe('/path/to/file.js')
      expect(falsePositive.lineNumber).toBe(42)
      expect(falsePositive.createdAt).toBeDefined()
      expect(falsePositive.updatedAt).toBeDefined()
    })

    test('Test 2: FalsePositive has unique constraint on (userId, codeHash, ruleId)', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: 'test-fp-2@example.com',
          passwordHash: 'hash123',
          name: 'Test User 2'
        }
      })

      // Create first false positive
      await prisma.falsePositive.create({
        data: {
          userId: user.id,
          ruleId: 'injection-rule',
          codeHash: 'abc123def456',
          filePath: '/path/to/file.js',
          lineNumber: 42
        }
      })

      // Attempt to create duplicate - should fail
      await expect(
        prisma.falsePositive.create({
          data: {
            userId: user.id,
            ruleId: 'injection-rule',
            codeHash: 'abc123def456',
            filePath: '/path/to/other.js',
            lineNumber: 100
          }
        })
      ).rejects.toThrow()
    })

    test('Test 3: User relation exists (many-to-one)', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: 'test-fp-3@example.com',
          passwordHash: 'hash123',
          name: 'Test User 3'
        }
      })

      // Create false positives
      await prisma.falsePositive.createMany({
        data: [
          {
            userId: user.id,
            ruleId: 'rule1',
            codeHash: 'hash1',
            filePath: '/path/1.js',
            lineNumber: 1
          },
          {
            userId: user.id,
            ruleId: 'rule2',
            codeHash: 'hash2',
            filePath: '/path/2.js',
            lineNumber: 2
          }
        ]
      })

      // Query user with false positives
      const userWithFPs = await prisma.user.findUnique({
        where: { id: user.id },
        include: { falsePositives: true }
      })

      expect(userWithFPs?.falsePositives).toBeDefined()
      expect(userWithFPs?.falsePositives).toHaveLength(2)
    })

    test('Test 4: CreatedAt timestamp for tracking', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: 'test-fp-4@example.com',
          passwordHash: 'hash123',
          name: 'Test User 4'
        }
      })

      const beforeCreate = new Date()

      // Create false positive
      const falsePositive = await prisma.falsePositive.create({
        data: {
          userId: user.id,
          ruleId: 'injection-rule',
          codeHash: 'abc123def456',
          filePath: '/path/to/file.js',
          lineNumber: 42
        }
      })

      const afterCreate = new Date()

      expect(falsePositive.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(falsePositive.createdAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
      expect(falsePositive.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime())
      expect(falsePositive.updatedAt.getTime()).toBeLessThanOrEqual(afterCreate.getTime())
    })

    test('Test 5: Same user can have different false positives with different codeHash or ruleId', async () => {
      // Create a test user
      const user = await prisma.user.create({
        data: {
          email: 'test-fp-5@example.com',
          passwordHash: 'hash123',
          name: 'Test User 5'
        }
      })

      // Create multiple false positives for same user
      const fps = await prisma.falsePositive.createMany({
        data: [
          {
            userId: user.id,
            ruleId: 'rule1',
            codeHash: 'hash1',
            filePath: '/path/1.js',
            lineNumber: 1
          },
          {
            userId: user.id,
            ruleId: 'rule1',
            codeHash: 'hash2', // Different codeHash
            filePath: '/path/2.js',
            lineNumber: 2
          },
          {
            userId: user.id,
            ruleId: 'rule2', // Different ruleId
            codeHash: 'hash1',
            filePath: '/path/3.js',
            lineNumber: 3
          }
        ]
      })

      expect(fps.count).toBe(3)

      // Verify all were created
      const allFPs = await prisma.falsePositive.findMany({
        where: { userId: user.id }
      })

      expect(allFPs).toHaveLength(3)
    })
  })
})
