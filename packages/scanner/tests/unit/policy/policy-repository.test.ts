/**
 * PolicyRepository Tests
 *
 * TDD RED Phase: Tests for policy database queries
 * These tests will fail initially and pass after implementation
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'

// Mock imports - these will be implemented in Task 2
import { PolicyRepository } from '../../../src/storage/policy-repository'
import { PolicyMode, type PolicyResolution } from '../../../src/policy/policy-types'

const prisma = new PrismaClient()

describe('PolicyRepository', () => {
  let repository: PolicyRepository
  let userId: string
  let organizationId: string
  let policyId: string

  beforeAll(async () => {
    // Create test organization
    const org = await prisma.organization.create({
      data: {
        name: 'Test Policy Org'
      }
    })
    organizationId = org.id

    // Create test policy
    const policy = await prisma.policy.create({
      data: {
        mode: 'STRICT',
        organizationId
      }
    })
    policyId = policy.id

    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test-policy-repo@example.com',
        passwordHash: 'hash123',
        name: 'Test Policy Repo User',
        organizationId
      }
    })
    userId = user.id

    // Create repository instance
    repository = new PolicyRepository(prisma)
  })

  afterAll(async () => {
    // Cleanup
    await prisma.user.deleteMany({
      where: { email: 'test-policy-repo@example.com' }
    })
    await prisma.policy.deleteMany({})
    await prisma.organization.deleteMany({})
    await prisma.$disconnect()
  })

  describe('resolvePolicyForUser', () => {
    it('Test 1: resolvePolicyForUser returns organization policy mode', async () => {
      const resolution = await repository.resolvePolicyForUser(userId)

      expect(resolution).toBeDefined()
      expect(resolution.effectiveMode).toBe(PolicyMode.STRICT)
      expect(resolution.orgMode).toBe(PolicyMode.STRICT)
      expect(resolution.userId).toBe(userId)
      expect(resolution.organizationId).toBe(organizationId)
    })

    it('Test 2: resolvePolicyForUser defaults to MODERATE when no organization', async () => {
      // Create user without organization
      const userWithoutOrg = await prisma.user.create({
        data: {
          email: 'no-org-user@example.com',
          passwordHash: 'hash123',
          name: 'No Org User'
        }
      })

      const resolution = await repository.resolvePolicyForUser(userWithoutOrg.id)

      expect(resolution.effectiveMode).toBe(PolicyMode.MODERATE)
      expect(resolution.orgMode).toBe(PolicyMode.MODERATE)
      expect(resolution.organizationId).toBe('')

      // Cleanup
      await prisma.user.delete({
        where: { id: userWithoutOrg.id }
      })
    })

    it('Test 3: resolvePolicyForUser defaults to MODERATE when no policy set', async () => {
      // Create organization without policy
      const orgNoPolicy = await prisma.organization.create({
        data: {
          name: 'Org No Policy'
        }
      })

      const userNoPolicy = await prisma.user.create({
        data: {
          email: 'no-policy-user@example.com',
          passwordHash: 'hash123',
          name: 'No Policy User',
          organizationId: orgNoPolicy.id
        }
      })

      const resolution = await repository.resolvePolicyForUser(userNoPolicy.id)

      expect(resolution.effectiveMode).toBe(PolicyMode.MODERATE)
      expect(resolution.orgMode).toBe(PolicyMode.MODERATE)

      // Cleanup
      await prisma.user.delete({
        where: { id: userNoPolicy.id }
      })
      await prisma.organization.delete({
        where: { id: orgNoPolicy.id }
      })
    })

    it('Test 4: resolvePolicyForUser includes organizationId and userId in result', async () => {
      const resolution = await repository.resolvePolicyForUser(userId)

      expect(resolution.userId).toBe(userId)
      expect(resolution.organizationId).toBe(organizationId)
      expect(resolution.hasOverride).toBe(false) // User override not implemented yet
    })
  })
})
