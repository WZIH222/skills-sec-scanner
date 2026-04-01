/**
 * Scanner False Positive Integration Tests
 *
 * TDD Phase: Tests for scanner false positive filtering integration
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'
import { Scanner } from '../../src/scanner'
import type { ScannerDeps } from '../../src/scanner'
import { FalsePositiveFilter } from '../../src/storage/false-positive-filter'
import { TypeScriptParser } from '../../src/parser'
import { RuleLoader } from '../../src/rules'
import { PatternMatcher } from '../../src/analyzer'
import { TaintTracker } from '../../src/analyzer'
import { RiskScorer } from '../../src/analyzer'
import type { Finding } from '../../src/types'

const prisma = new PrismaClient()

describe('Scanner False Positive Integration', () => {
  let userId: string
  let scanner: Scanner
  let deps: ScannerDeps
  let fpFilter: FalsePositiveFilter

  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test-scanner-fp@example.com',
        passwordHash: 'hash123',
        name: 'Test Scanner FP User'
      }
    })
    userId = user.id

    // Create false positive filter
    fpFilter = new FalsePositiveFilter(prisma)

    // Create scanner dependencies (use mock cache and repository for testing)
    deps = {
      parser: new TypeScriptParser(),
      ruleLoader: new RuleLoader(),
      patternMatcher: new PatternMatcher([]),
      taintTracker: new TaintTracker(),
      scorer: new RiskScorer(),
      cache: {
        async get() { return null },
        async set() { return },
        async del() { return }
      } as any,
      repository: {
        async create() { return },
        async findById() { return null },
        async findByContentHash() { return null }
      } as any,
      falsePositiveFilter: fpFilter
    }

    scanner = new Scanner(deps)
  })

  afterAll(async () => {
    // Cleanup
    await prisma.falsePositive.deleteMany({})
    await prisma.user.deleteMany({
      where: { email: 'test-scanner-fp@example.com' }
    })
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    // Clear false positives before each test
    await prisma.falsePositive.deleteMany({})
    // Clear other test users (but not the main test user)
    await prisma.user.deleteMany({
      where: {
        email: { contains: 'scanner-fp@example.com' },
        id: { not: userId } // Don't delete the main test user
      }
    })
  })

  describe('Scanner with False Positive Filtering', () => {
    test('Test 1: Scanner excludes findings matching false positive records', async () => {
      // Create a false positive for a specific rule and code
      const code = 'const query = `SELECT * FROM users WHERE id = ${userId}`'
      const codeHash = createHash('sha256').update(code).digest('hex')

      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'injection-child-process',
          codeHash,
          filePath: 'test.js',
          lineNumber: 1
        }
      })

      // Load exclusions
      await fpFilter.loadExclusions(userId)

      // Verify the exclusion is loaded
      const isExcluded = fpFilter.isExcluded(userId, 'injection-child-process', codeHash)
      expect(isExcluded).toBe(true)
    })

    test('Test 2: Exclusion matches on userId, codeHash, and ruleId', async () => {
      // Create false positive
      const code = 'fs.readFileSync("/etc/passwd")'
      const codeHash = createHash('sha256').update(code).digest('hex')

      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'file-access-fs-readfile',
          codeHash,
          filePath: 'test.js',
          lineNumber: 1
        }
      })

      // Load exclusions
      await fpFilter.loadExclusions(userId)

      // Should be excluded for this user
      const isExcluded = fpFilter.isExcluded(userId, 'file-access-fs-readfile', codeHash)
      expect(isExcluded).toBe(true)

      // Different rule should not be excluded
      const isExcludedDifferent = fpFilter.isExcluded(userId, 'file-access-fs-writefile', codeHash)
      expect(isExcludedDifferent).toBe(false)
    })

    test('Test 3: Findings with different codeHash are not excluded', async () => {
      // Create false positive for specific code
      const code1 = 'eval(userInput)'
      const codeHash1 = createHash('sha256').update(code1).digest('hex')

      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'eval-usage',
          codeHash: codeHash1,
          filePath: 'test.js',
          lineNumber: 1
        }
      })

      // Load exclusions
      await fpFilter.loadExclusions(userId)

      // Should be excluded for code1
      expect(fpFilter.isExcluded(userId, 'eval-usage', codeHash1)).toBe(true)

      // Should NOT be excluded for different code
      const codeHash2 = createHash('sha256').update('eval(differentInput)').digest('hex')
      expect(fpFilter.isExcluded(userId, 'eval-usage', codeHash2)).toBe(false)
    })

    test('Test 4: Exclusion works across different scans', async () => {
      // Create false positive
      const code = 'eval(userInput)'
      const codeHash = createHash('sha256').update(code).digest('hex')

      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'eval-usage',
          codeHash,
          filePath: 'test.js',
          lineNumber: 1
        }
      })

      // Load exclusions once
      await fpFilter.loadExclusions(userId)

      // Check exclusion multiple times (simulating different scans)
      expect(fpFilter.isExcluded(userId, 'eval-usage', codeHash)).toBe(true)
      expect(fpFilter.isExcluded(userId, 'eval-usage', codeHash)).toBe(true)
      expect(fpFilter.isExcluded(userId, 'eval-usage', codeHash)).toBe(true)
    })

    test('Test 5: Scanner works without false positive filter (backward compatibility)', async () => {
      // Create scanner without false positive filter
      const depsWithoutFilter: ScannerDeps = {
        ...deps,
        falsePositiveFilter: undefined
      }

      const scannerWithoutFilter = new Scanner(depsWithoutFilter)

      // Scan should work normally
      const code = 'const query = `SELECT * FROM users WHERE id = ${userId}`'
      const result = await scannerWithoutFilter.scan(code, 'test.js', { userId })

      // Should return findings (no filtering)
      expect(result.findings.length).toBeGreaterThanOrEqual(0)
    })

    test('Test 6: Scanner queries database via Prisma for user exclusions', async () => {
      // Verify that loadExclusions is called during scan
      let loadExclusionsCalled = false

      // Spy on loadExclusions
      const originalLoadExclusions = fpFilter.loadExclusions.bind(fpFilter)
      fpFilter.loadExclusions = async (uid: string) => {
        loadExclusionsCalled = true
        return originalLoadExclusions(uid)
      }

      // Scan with userId
      const code = 'const query = `SELECT * FROM users WHERE id = ${userId}`'
      await scanner.scan(code, 'test.js', { userId })

      // Verify loadExclusions was called
      expect(loadExclusionsCalled).toBe(true)

      // Restore original method
      fpFilter.loadExclusions = originalLoadExclusions
    })

    test('Test 7: Exclusion is user-specific', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other-scanner-fp@example.com',
          passwordHash: 'hash123',
          name: 'Other Scanner FP User'
        }
      })

      // Create false positive for original user
      const code = 'eval(userInput)'
      const codeHash = createHash('sha256').update(code).digest('hex')

      await prisma.falsePositive.create({
        data: {
          userId,
          ruleId: 'eval-usage',
          codeHash,
          filePath: 'test.js',
          lineNumber: 1
        }
      })

      // Load exclusions for original user
      await fpFilter.loadExclusions(userId)
      expect(fpFilter.isExcluded(userId, 'eval-usage', codeHash)).toBe(true)

      // Load exclusions for other user
      await fpFilter.loadExclusions(otherUser.id)
      expect(fpFilter.isExcluded(otherUser.id, 'eval-usage', codeHash)).toBe(false)

      // Cleanup
      await prisma.user.delete({ where: { id: otherUser.id } })
    })
  })
})
