/**
 * Job Processor
 *
 * BullMQ worker for processing scan jobs.
 * Handles cache lookups, scanning, and result storage.
 *
 * Note: This processor requires a Scanner instance which will be
 * implemented in Task 2. For now, it uses a placeholder interface.
 */

import { Worker, Job } from 'bullmq'
import { RedisService } from '../storage/cache/client'
import { CacheService } from '../storage/cache/cache-service'
import { PrismaService } from '../storage/database/client'
import { ScanRepository } from '../storage/database/scan-repository'
import type { ScanJobData } from './scan-queue'
import type { ScanResult, IParseResult, Finding } from '../types'

/**
 * Scanner interface (placeholder - will be implemented in Task 2)
 */
export interface IScanner {
  parse(content: string, filename?: string): Promise<IParseResult>
  analyze(parseResult: IParseResult, options?: any): Promise<Finding[]>
  score(findings: Finding[]): Promise<number>
}

/**
 * Scan Worker Service
 *
 * Processes scan jobs from the queue
 */
export class ScanWorkerService {
  private worker: Worker<ScanJobData, ScanResult>
  private concurrency: number

  // These will be injected via factory in Task 2
  private scanner: IScanner
  private cache: CacheService
  private repository: ScanRepository

  constructor(scanner?: IScanner, cache?: CacheService, repository?: ScanRepository) {
    const redis = RedisService.getInstance()

    this.concurrency = parseInt(process.env.SCAN_CONCURRENCY || '10', 10)

    // Placeholder scanner - will be replaced in Task 2
    this.scanner = scanner || this.createPlaceholderScanner()
    this.cache = cache || new CacheService(redis)
    this.repository = repository || new ScanRepository(PrismaService.getInstance())

    this.worker = new Worker(
      'scan-jobs',
      (job: Job) => this.processScan(job),
      {
        connection: { host: 'localhost', port: 6379 },
        concurrency: this.concurrency,
      }
    )

    // Set up event handlers
    this.setupEventHandlers()
  }

  /**
   * Create placeholder scanner for testing
   * This will be replaced by the real Scanner in Task 2
   */
  private createPlaceholderScanner(): IScanner {
    return {
      parse: async (content: string, filename?: string) => {
        // Simple parse - just return basic structure
        return {
          ast: { content, filename },
          metadata: { language: 'typescript' },
          errors: [],
          dependencies: [],
        }
      },
      analyze: async (parseResult: IParseResult, options?: any) => {
        // Simple analysis - detect eval() calls
        const content = JSON.stringify(parseResult.ast)
        const findings: Finding[] = []

        if (content.includes('eval(')) {
          findings.push({
            ruleId: 'eval-call',
            severity: 'critical',
            message: 'eval() allows arbitrary code execution',
            location: { line: 1, column: 1 },
          })
        }

        return findings
      },
      score: async (findings: Finding[]) => {
        // Simple scoring - critical: 50, high: 30, medium: 20, low: 10
        let score = 0
        for (const finding of findings) {
          switch (finding.severity) {
            case 'critical':
              score += 50
              break
            case 'high':
              score += 30
              break
            case 'medium':
              score += 20
              break
            case 'low':
              score += 10
              break
          }
        }
        return Math.min(score, 100)
      },
    }
  }

  /**
   * Process a scan job
   *
   * @param job - BullMQ job
   * @returns Scan result
   */
  private async processScan(job: Job): Promise<ScanResult> {
    const { fileId, contentHash, content, filename, options } = job.data
    const startTime = Date.now()

    try {
      // Step 1: Update progress 10%
      await job.updateProgress(10)

      // Step 2: Check cache
      const cached = await this.cache.get(content)
      if (cached) {
        await job.updateProgress(100)
        return cached
      }

      // Step 3: Parse file (20%)
      await job.updateProgress(20)
      const parseResult = await this.scanner.parse(content, filename)

      // Step 4: Analyze (50%)
      await job.updateProgress(50)
      const findings = await this.scanner.analyze(parseResult, options)

      // Step 5: Score (80%)
      await job.updateProgress(80)
      const score = await this.scanner.score(findings)

      // Step 6: Build result
      const result: ScanResult = {
        findings,
        score,
        metadata: {
          scannedAt: new Date(),
          scanDuration: Date.now() - startTime,
        },
      }

      // Step 7: Store in database (90%)
      await job.updateProgress(90)
      try {
        await this.repository.create({ fileId, contentHash, filename, result })
      } catch (error) {
        console.error('Failed to store scan result:', error)
        // Continue even if storage fails
      }

      // Step 8: Cache result (95%)
      await this.cache.set(content, result)

      // Step 9: Complete (100%)
      await job.updateProgress(100)

      return result
    } catch (error) {
      console.error('Scan job failed:', error)
      throw error
    }
  }

  /**
   * Set up event handlers for the worker
   */
  private setupEventHandlers(): void {
    this.worker.on('completed', (job: Job, result: ScanResult) => {
      console.log(`Job ${job.id} completed with score: ${result.score}`)
    })

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      if (job) {
        console.error(`Job ${job.id} failed:`, error.message)
      } else {
        console.error('Job failed:', error.message)
      }
    })

    this.worker.on('progress', (job: Job) => {
      const progress = job.progress
      console.log(`Job ${job.id} progress: ${progress}%`)
    })

    this.worker.on('error', (error: Error) => {
      console.error('Worker error:', error)
    })
  }

  /**
   * Start the worker (called automatically in constructor)
   */
  start(): void {
    // Worker is already started in constructor
    console.log(`Scan worker started with concurrency: ${this.concurrency}`)
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    await this.worker.close()
    console.log('Scan worker stopped')
  }

  /**
   * Get worker instance for testing
   */
  getWorker(): Worker {
    return this.worker
  }
}
