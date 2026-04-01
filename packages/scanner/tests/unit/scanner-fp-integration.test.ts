/**
 * Scanner False Positive Unit Tests
 *
 * TDD Phase: Tests for scanner false positive filtering integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'
import { FalsePositiveFilter } from '../../src/storage/false-positive-filter'

const prisma = new PrismaClient()

describe('Scanner False Positive Filtering', () => {
  let userId: string
  let fpFilter: FalsePositiveFilter

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test-scanner-fp-unit@example.com',
        passwordHash: 'hash123',
        name: 'Test Scanner FP Unit User'
      }
    })
    userId = user.id

    // Create false positive filter
    fpFilter = new FalsePositiveFilter(prisma)
  })

  afterAll(async () => {
    // Cleanup
    await prisma.falsePositive.deleteMany({})
    await prisma.user.deleteMany({
      where: { email: 'test-scanner-fp-unit@example.com' }
    })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clear false positives before each test
    await prisma.falsePositive.deleteMany({})
  })

  describe('False Positive Filter Integration', () => {
    test('Test 1: Filter excludes findings based on userId, ruleId, and codeHash', async () => {
      // Create a false positive
      const code = 'const query = `SELECT * FROM users WHERE id = ${userId}`'
      const codeHash = createHash('sha256').update(code).digest('hex')

      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'injection-rule',
          codeHash,
          filePath: 'test.js',
          lineNumber: 1
        }
      })

      // Load exclusions
      await fpFilter.loadExclusions(userId)

      // Simulate findings
      const findings = [
        { ruleId: 'injection-rule', codeHash, code },
        { ruleId: 'other-rule', codeHash: 'other-hash', code: 'other code' }
      ]

      // Filter findings
      const filtered = findings.filter(
        f => !fpFilter.isExcluded(userId, f.ruleId, f.codeHash)
      )

      // Should only include non-excluded finding
      expect(filtered.length).toBe(1)
      expect(filtered[0]?.ruleId).toBe('other-rule')
    })

    test('Test 2: Different codeHash results in different exclusion status', async () => {
      // Create false positive for specific code
      const code1 = 'eval(userInput)'
      const codeHash1 = createHash('sha256').update(code1).digest('hex')

      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'eval-rule',
          codeHash: codeHash1,
          filePath: 'test.js',
          lineNumber: 1
        }
      })

      // Load exclusions
      await fpFilter.loadExclusions(userId)

      // Test with same code (should be excluded)
      expect(fpFilter.isExcluded(userId, 'eval-rule', codeHash1)).toBe(true)

      // Test with different code (should NOT be excluded)
      const codeHash2 = createHash('sha256').update('eval(differentInput)').digest('hex')
      expect(fpFilter.isExcluded(userId, 'eval-rule', codeHash2)).toBe(false)
    })

    test('Test 3: Filter is user-specific', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other-fp-unit@example.com',
          passwordHash: 'hash123',
          name: 'Other FP Unit User'
        }
      })

      // Create false positive for original user
      const code = 'eval(userInput)'
      const codeHash = createHash('sha256').update(code).digest('hex')

      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'eval-rule',
          codeHash,
          filePath: 'test.js',
          lineNumber: 1
        }
      })

      // Load exclusions for original user
      await fpFilter.loadExclusions(userId)

      // Original user should have exclusion
      expect(fpFilter.isExcluded(userId, 'eval-rule', codeHash)).toBe(true)

      // Other user should NOT have exclusion
      expect(fpFilter.isExcluded(otherUser.id, 'eval-rule', codeHash)).toBe(false)

      // Cleanup
      await prisma.user.delete({ where: { id: otherUser.id } })
    })

    test('Test 4: Multiple exclusions can be loaded and checked', async () => {
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

      // Load exclusions
      const exclusions = await fpFilter.loadExclusions(userId)

      // Verify all exclusions loaded
      expect(exclusions.size).toBe(3)

      // Verify each exclusion can be checked
      expect(fpFilter.isExcluded(userId, 'rule1', 'hash1')).toBe(true)
      expect(fpFilter.isExcluded(userId, 'rule2', 'hash2')).toBe(true)
      expect(fpFilter.isExcluded(userId, 'rule3', 'hash3')).toBe(true)

      // Verify non-existent exclusion returns false
      expect(fpFilter.isExcluded(userId, 'rule4', 'hash4')).toBe(false)
    })

    test('Test 5: Exclusion persists across multiple scans', async () => {
      // Create false positive
      const code = 'fs.readFileSync("/etc/passwd")'
      const codeHash = createHash('sha256').update(code).digest('hex')

      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'file-access-rule',
          codeHash,
          filePath: 'test.js',
          lineNumber: 1
        }
      })

      // Load exclusions once
      await fpFilter.loadExclusions(userId)

      // Check exclusion multiple times (simulating multiple scans)
      expect(fpFilter.isExcluded(userId, 'file-access-rule', codeHash)).toBe(true)
      expect(fpFilter.isExcluded(userId, 'file-access-rule', codeHash)).toBe(true)
      expect(fpFilter.isExcluded(userId, 'file-access-rule', codeHash)).toBe(true)
    })
  })
})
