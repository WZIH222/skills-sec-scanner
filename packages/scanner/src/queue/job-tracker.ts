/**
 * Job Tracker
 *
 * Provides job status tracking and management for scan jobs.
 * Retrieves job state, progress, results, and failure reasons.
 */

import { Queue, Job } from 'bullmq'
import type { ScanJobData } from './scan-queue'
import type { ScanResult } from '../types'

/**
 * Job status structure
 */
export interface JobStatus {
  id: string
  state: 'waiting' | 'active' | 'completed' | 'failed'
  progress: number // 0-100
  result: ScanResult | null
  failedReason: string | null
  processedOn: number | null
  finishedOn: number | null
}

/**
 * Exception thrown when job is not found
 */
export class NotFoundException extends Error {
  constructor(jobId: string) {
    super(`Job not found: ${jobId}`)
    this.name = 'NotFoundException'
  }
}

/**
 * Job Tracker
 *
 * Tracks and retrieves job status from the queue
 */
export class JobTracker {
  constructor(private queue: Queue) {}

  /**
   * Get job status by ID
   *
   * @param jobId - Job ID
   * @returns Job status
   * @throws NotFoundException if job not found
   */
  async getJobStatus(jobId: string): Promise<JobStatus> {
    const job = await this.queue.getJob(jobId)

    if (!job) {
      throw new NotFoundException(jobId)
    }

    const state = await job.getState()
    const progress = job.progress !== undefined ? Number(job.progress) : 0

    // Extract result from return value or failed reason
    let result: ScanResult | null = null
    let failedReason: string | null = null

    if (state === 'completed') {
      const returnValue = job.returnvalue
      if (returnValue && typeof returnValue === 'object') {
        result = returnValue as ScanResult
      }
    } else if (state === 'failed') {
      failedReason = job.failedReason || null
    }

    return {
      id: jobId,
      state: state as JobStatus['state'],
      progress,
      result,
      failedReason,
      processedOn: job.processedOn || null,
      finishedOn: job.finishedOn || null,
    }
  }

  /**
   * Get multiple job statuses
   *
   * @param jobIds - Array of job IDs
   * @returns Array of job statuses
   */
  async getJobStatuses(jobIds: string[]): Promise<JobStatus[]> {
    const statuses = await Promise.all(
      jobIds.map(async (id) => {
        try {
          return await this.getJobStatus(id)
        } catch (error) {
          if (error instanceof NotFoundException) {
            return null
          }
          throw error
        }
      })
    )

    return statuses.filter((s): s is JobStatus => s !== null)
  }
}
