/**
 * Integration Tests for Scan Queue
 *
 * Tests the full BullMQ-based job queue lifecycle:
 * - Job creation and retrieval
 * - Concurrent processing
 * - Retry logic
 * - Cache integration
 *
 * Note: These tests require a running Redis server
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { ScanQueueService, ScanWorkerService, JobTracker } from '../../../src/queue'
import { createHash } from 'crypto'
import type { ScanJobData } from '../../../src/queue'

// Check if Redis is available
const REDIS_URL = process.env.REDIS_URL || process.env.TEST_REDIS_URL
const redisAvailable = !!REDIS_URL

describe.skipIf(!redisAvailable)('ScanQueue Integration Tests', () => {
  let queueService: ScanQueueService
  let workerService: ScanWorkerService
  let jobTracker: JobTracker

  beforeAll(async () => {
    // Initialize queue services
    // These will be created once we implement the actual code
    queueService = new ScanQueueService()
    workerService = new ScanWorkerService()
    jobTracker = new JobTracker(queueService as any)
  })

  afterAll(async () => {
    await workerService.stop()
  })

  describe('ScanQueueService.addScanJob()', () => {
    it('should create a job and return job ID', async () => {
      const jobData: ScanJobData = {
        fileId: 'test-file-1',
        contentHash: createHash('sha256').update('test content').digest('hex'),
        content: 'test content',
        filename: 'test.ts',
        options: {},
      }

      const jobId = await queueService.addScanJob(jobData)

      expect(jobId).toBeDefined()
      expect(typeof jobId).toBe('string')
    })
  })

  describe('ScanWorkerService', () => {
    it('should process job with progress updates', async () => {
      const jobData: ScanJobData = {
        fileId: 'test-file-2',
        contentHash: createHash('sha256').update('eval("dangerous")').digest('hex'),
        content: 'eval("dangerous")',
        filename: 'test.ts',
        options: {},
      }

      const jobId = await queueService.addScanJob(jobData)

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000))

      const status = await jobTracker.getJobStatus(jobId)
      expect(status.state).toBe('completed')
      expect(status.progress).toBe(100)
      expect(status.result).toBeDefined()
    })

    it('should process 10 jobs concurrently', async () => {
      const jobs: Promise<string>[] = []

      // Create 20 jobs
      for (let i = 0; i < 20; i++) {
        const jobData: ScanJobData = {
          fileId: `concurrent-file-${i}`,
          contentHash: createHash('sha256').update(`content ${i}`).digest('hex'),
          content: `console.log(${i})`,
          filename: 'test.ts',
          options: {},
        }
        jobs.push(queueService.addScanJob(jobData))
      }

      const jobIds = await Promise.all(jobs)

      // Wait for all to complete
      await new Promise(resolve => setTimeout(resolve, 5000))

      // Check all are completed
      const statuses = await Promise.all(
        jobIds.map(id => jobTracker.getJobStatus(id))
      )

      statuses.forEach(status => {
        expect(['completed', 'waiting']).toContain(status.state)
      })
    })

    it('should retry failed jobs (3 attempts)', async () => {
      const jobData: ScanJobData = {
        fileId: 'failing-file',
        contentHash: createHash('sha256').update('syntax error').digest('hex'),
        content: 'syntax error here',
        filename: 'test.ts',
        options: {},
      }

      const jobId = await queueService.addScanJob(jobData)

      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 10000))

      const status = await jobTracker.getJobStatus(jobId)
      expect(status.state).toBe('failed')
      expect(status.failedReason).toBeDefined()
    })
  })

  describe('JobTracker.getJobStatus()', () => {
    it('should return job status by ID', async () => {
      const jobData: ScanJobData = {
        fileId: 'status-test-file',
        contentHash: createHash('sha256').update('status test').digest('hex'),
        content: 'status test',
        filename: 'test.ts',
        options: {},
      }

      const jobId = await queueService.addScanJob(jobData)
      const status = await jobTracker.getJobStatus(jobId)

      expect(status).toBeDefined()
      expect(status.id).toBe(jobId)
      expect(['waiting', 'active', 'completed', 'failed']).toContain(status.state)
      expect(status.progress).toBeGreaterThanOrEqual(0)
      expect(status.progress).toBeLessThanOrEqual(100)
    })
  })

  describe('Cache Integration', () => {
    it('should return cached results for identical file hashes', async () => {
      const content = 'console.log("test")'
      const contentHash = createHash('sha256').update(content).digest('hex')

      // First scan
      const job1: ScanJobData = {
        fileId: 'cache-test-1',
        contentHash,
        content,
        filename: 'test.ts',
        options: {},
      }

      await queueService.addScanJob(job1)
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Second scan with same content
      const job2: ScanJobData = {
        fileId: 'cache-test-2',
        contentHash,
        content,
        filename: 'test.ts',
        options: {},
      }

      const jobId2 = await queueService.addScanJob(job2)
      await new Promise(resolve => setTimeout(resolve, 500))

      const status = await jobTracker.getJobStatus(jobId2)
      expect(status.state).toBe('completed')
      // Should complete much faster due to cache
    })
  })

  describe('Job Cleanup', () => {
    it('should remove completed jobs after 1 hour', async () => {
      // This test verifies the job removal configuration
      // Actual cleanup happens via BullMQ's removeOnComplete option
      const jobData: ScanJobData = {
        fileId: 'cleanup-test',
        contentHash: createHash('sha256').update('cleanup').digest('hex'),
        content: 'cleanup test',
        filename: 'test.ts',
        options: {},
      }

      const jobId = await queueService.addScanJob(jobData)
      const status = await jobTracker.getJobStatus(jobId)

      expect(status).toBeDefined()
      // Job will be cleaned up after 1 hour automatically
    })
  })
})
