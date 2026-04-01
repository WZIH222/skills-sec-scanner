/**
 * FalsePositiveFilter Tests
 *
 * TDD RED Phase: Tests for false positive filtering service
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { FalsePositiveFilter } from '../../../src/storage/false-positive-filter'

const prisma = new PrismaClient()

describe('FalsePositiveFilter', () => {
  let userId: string
  let filter: FalsePositiveFilter

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test-fp-filter@example.com',
        passwordHash: 'hash123',
        name: 'Test FP Filter User'
      }
    })
    userId = user.id

    // Create filter instance
    filter = new FalsePositiveFilter(prisma)
  })

  afterAll(async () => {
    // Cleanup
    await prisma.falsePositive.deleteMany({})
    await prisma.user.deleteMany({
      where: { email: 'test-fp-filter@example.com' }
    })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clear false positives before each test
    await prisma.falsePositive.deleteMany({})
  })

  describe('loadExclusions', () => {
    test('Test 1: Loads user exclusions from database', async () => {
      // Create false positives
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
          }
        ]
      })

      // Load exclusions
      const exclusions = await filter.loadExclusions(userId)

      // Verify exclusions were loaded
      expect(exclusions.size).toBe(2)
      expect(exclusions.has('hash1:rule1')).toBe(true)
      expect(exclusions.has('hash2:rule2')).toBe(true)
    })

    test('Test 2: Returns empty map when no exclusions exist', async () => {
      // Load exclusions (none exist)
      const exclusions = await filter.loadExclusions(userId)

      // Verify empty map
      expect(exclusions.size).toBe(0)
    })

    test('Test 3: Only loads exclusions for specific user', async () => {
      // Create false positives for test user
      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'rule1',
          codeHash: 'hash1',
          filePath: '/path/1.js',
          lineNumber: 1
        }
      })

      // Create false positive for different user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other-fp-filter@example.com',
          passwordHash: 'hash123',
          name: 'Other FP Filter User'
        }
      })

      await prisma.falsePositive.create({
        data: {
          userId: otherUser.id,
          ruleId: 'rule2',
          codeHash: 'hash2',
          filePath: '/path/2.js',
          lineNumber: 2
        }
      })

      // Load exclusions for test user
      const exclusions = await filter.loadExclusions(userId)

      // Verify only test user exclusions loaded
      expect(exclusions.size).toBe(1)
      expect(exclusions.has('hash1:rule1')).toBe(true)
      expect(exclusions.has('hash2:rule2')).toBe(false)

      // Cleanup
      await prisma.falsePositive.deleteMany({ where: { userId: otherUser.id } })
      await prisma.user.delete({ where: { id: otherUser.id } })
    })
  })

  describe('isExcluded', () => {
    test('Test 4: Returns true for excluded findings', async () => {
      // Create false positive
      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'injection-rule',
          codeHash: 'abc123',
          filePath: '/path/file.js',
          lineNumber: 10
        }
      })

      // Load exclusions
      await filter.loadExclusions(userId)

      // Check if excluded
      const isExcluded = filter.isExcluded(userId, 'injection-rule', 'abc123')
      expect(isExcluded).toBe(true)
    })

    test('Test 5: Returns false for non-excluded findings', async () => {
      // Load exclusions (none exist)
      await filter.loadExclusions(userId)

      // Check if excluded
      const isExcluded = filter.isExcluded(userId, 'injection-rule', 'abc123')
      expect(isExcluded).toBe(false)
    })

    test('Test 6: Matches on exact codeHash and ruleId', async () => {
      // Create false positive with specific hash and rule
      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'rule1',
          codeHash: 'hash1',
          filePath: '/path/1.js',
          lineNumber: 1
        }
      })

      // Load exclusions
      await filter.loadExclusions(userId)

      // Test exact match
      expect(filter.isExcluded(userId, 'rule1', 'hash1')).toBe(true)

      // Test different ruleId
      expect(filter.isExcluded(userId, 'rule2', 'hash1')).toBe(false)

      // Test different codeHash
      expect(filter.isExcluded(userId, 'rule1', 'hash2')).toBe(false)
    })

    test('Test 7: Works across different scans', async () => {
      // Create false positive
      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'file-access-rule',
          codeHash: 'xyz789',
          filePath: '/path/file.js',
          lineNumber: 20
        }
      })

      // Load exclusions once
      await filter.loadExclusions(userId)

      // Check exclusion multiple times (simulating different scans)
      expect(filter.isExcluded(userId, 'file-access-rule', 'xyz789')).toBe(true)
      expect(filter.isExcluded(userId, 'file-access-rule', 'xyz789')).toBe(true)
      expect(filter.isExcluded(userId, 'file-access-rule', 'xyz789')).toBe(true)
    })

    test('Test 8: Returns false for different users', async () => {
      // Create false positive for test user
      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'rule1',
          codeHash: 'hash1',
          filePath: '/path/1.js',
          lineNumber: 1
        }
      })

      // Load exclusions for test user
      await filter.loadExclusions(userId)

      // Check for different user
      const otherUserId = 'other-user-id'
      expect(filter.isExcluded(otherUserId, 'rule1', 'hash1')).toBe(false)
    })
  })
})
