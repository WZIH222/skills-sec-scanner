/**
 * Scan Queue Service
 *
 * BullMQ-based queue for asynchronous scan job processing.
 * Provides job creation, retry logic, and automatic cleanup.
 */

import { Queue, Job, JobsOptions } from 'bullmq'
import { z } from 'zod'
import { RedisService } from '../storage/cache/client'
import type { ScanOptions } from '../types'

/**
 * Zod schema for validating ScanJobData at queue entry (VALID-03)
 */
const ScanJobDataSchema = z.object({
  fileId: z.string(),
  contentHash: z.string(),
  content: z.string(),
  filename: z.string(),
  options: z.object({
    userId: z.string().optional(),
    aiEnabled: z.boolean().optional(),
    policyMode: z.string().optional(),
  }),
})

/**
 * Scan job data structure
 */
export interface ScanJobData {
  fileId: string
  contentHash: string
  content: string
  filename: string
  options: ScanOptions
}

/**
 * Default job options
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000,
  },
  removeOnComplete: {
    age: 3600, // 1 hour
    count: 100,
  },
  removeOnFail: {
    age: 24 * 3600, // 24 hours
  },
}

/**
 * Parse Redis URL into connection options for BullMQ
 */
function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    // Fallback to localhost without password
    return { host: 'localhost', port: 6379 }
  }

  try {
    const url = new URL(redisUrl)
    return {
      host: url.hostname || 'localhost',
      port: parseInt(url.port, 10) || 6379,
      password: url.password || undefined,
    }
  } catch {
    return { host: 'localhost', port: 6379 }
  }
}

/**
 * Scan Queue Service
 *
 * Manages the BullMQ queue for scan jobs
 */
export class ScanQueueService {
  private queue: Queue

  constructor() {
    const redisConnection = getRedisConnection()
    console.info(`[ScanQueue] Connecting to Redis: ${redisConnection.host}:${redisConnection.port}`)

    this.queue = new Queue('scan-jobs', {
      connection: redisConnection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    })
  }

  /**
   * Add a scan job to the queue
   *
   * @param data - Job data
   * @returns Job ID
   */
  async addScanJob(data: ScanJobData): Promise<string> {
    // Validate with Zod before queue entry (VALID-03)
    const validated = ScanJobDataSchema.parse(data)
    const job = await this.queue.add('scan', validated)

    if (!job) {
      throw new Error('Failed to add job to queue')
    }

    return job.id!
  }

  /**
   * Get job by ID
   *
   * @param jobId - Job ID
   * @returns Job or null if not found
   */
  async getJob(jobId: string): Promise<Job<ScanJobData> | undefined> {
    return this.queue.getJob(jobId)
  }

  /**
   * Get queue instance for use by JobTracker
   *
   * @returns BullMQ Queue instance
   */
  getQueue(): Queue {
    return this.queue
  }

  /**
   * Close queue connection
   */
  async close(): Promise<void> {
    await this.queue.close()
  }

  /**
   * Pause the queue
   */
  async pause(): Promise<void> {
    await this.queue.pause()
  }

  /**
   * Resume the queue
   */
  async resume(): Promise<void> {
    await this.queue.resume()
  }

  /**
   * Obliterate the queue (remove all jobs)
   *
   * @param count - Maximum number of jobs to remove (0 = all)
   */
  async obliterate(count = 0): Promise<void> {
    await this.queue.obliterate({ count, force: true })
  }
}
