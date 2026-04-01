import { Job, Worker } from 'bullmq'
import { prisma } from '@skills-sec/database'
import { ScanQueueService } from '../queue/scan-queue'
import { emitFolderProgress, emitFolderComplete } from './sse-event-bus'
import type { AIProviderType } from '../ai-engine/types'

/**
 * Parse Redis URL into connection options for BullMQ
 */
function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL

  if (!redisUrl) {
    console.warn('[FolderWorker] REDIS_URL not set, using localhost:6379 without password')
    return { host: 'localhost', port: 6379 }
  }

  try {
    const url = new URL(redisUrl)
    const conn = {
      host: url.hostname || 'localhost',
      port: parseInt(url.port, 10) || 6379,
      password: url.password || undefined,
    }
    console.info(`[FolderWorker] Redis connection: ${conn.host}:${conn.port}`)
    return conn
  } catch {
    console.warn('[FolderWorker] Failed to parse REDIS_URL, using localhost:6379')
    return { host: 'localhost', port: 6379 }
  }
}

/**
 * Reconstruct AI provider configuration from environment variables
 * (Worker runs in separate process, needs to rebuild what API built)
 */
function getAIProviderFromEnv(): { type: AIProviderType; apiKey: string; baseURL?: string; model?: string } | undefined {
  if (process.env.AI_API_KEY) {
    return {
      type: (process.env.AI_PROVIDER_TYPE || 'openai') as AIProviderType,
      apiKey: process.env.AI_API_KEY,
      baseURL: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL,
    }
  }
  if (process.env.OPENAI_API_KEY) {
    return { type: 'openai' as AIProviderType, apiKey: process.env.OPENAI_API_KEY }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    return { type: 'anthropic' as AIProviderType, apiKey: process.env.ANTHROPIC_API_KEY }
  }
  return undefined
}

async function finalizeFolderScan(folderScanId: string) {
  const folder = await prisma.scan.findUnique({
    where: { id: folderScanId },
    include: { files: true },
  })

  if (!folder || !folder.files || folder.files.length === 0) return

  const highestScore = Math.max(...folder.files.map((f) => f.score), 0)
  const totalFindings = folder.files.reduce<number>((sum, f) => {
    const metadata = JSON.parse(f.metadata || '{}')
    return sum + (metadata.findingsCount || 0)
  }, 0)

  const metadata = JSON.parse(folder.metadata || '{}')
  const totalFiles = metadata.totalFiles || folder.files.length

  await prisma.scan.update({
    where: { id: folderScanId },
    data: {
      status: 'completed',
      score: highestScore,
      metadata: JSON.stringify({
        ...metadata,
        totalFindings,
        completedFiles: totalFiles,
      }),
    },
  })

  await emitFolderComplete({
    jobId: folderScanId,
    summary: {
      totalFiles,
      totalFindings,
      highestScore,
    },
  })
}

export async function processFolderFile(job: Job) {
  const { folderScanId, content, filename, userId, aiEnabled, policyMode } = job.data as {
    folderScanId: string
    content: string
    filename: string
    userId: string
    aiEnabled: boolean
    policyMode: string
  }

  console.log(`[FolderWorker] Processing ${filename} for folder ${folderScanId}`)

  // Reconstruct AI provider from environment variables (worker is separate process)
  const aiProvider = getAIProviderFromEnv()
  if (aiEnabled && aiProvider) {
    console.info(`[FolderWorker] AI enabled for ${filename}, provider: ${aiProvider.type}`)
  } else if (aiEnabled) {
    console.warn(`[FolderWorker] AI requested but no provider configured, proceeding without AI`)
  }

  let scanner: any = null

  try {
    // 1. Scan the file (skip storage - we'll create the record with parentId)
    // Use dynamic import to avoid circular dependency during build
    const { createScanner } = await import('../index')
    scanner = await createScanner({
      databaseUrl: process.env.DATABASE_URL,
      aiProvider,
      skipAI: !aiEnabled,
      filename,
    })
    const result = await scanner.scan(content, filename, {
      userId,
      aiEnabled,
      policyMode,
      skipStorage: true, // Don't create top-level record for child files
    })

    // Compute content hash for the child file
    const { createHash } = await import('crypto')
    const contentHash = createHash('sha256').update(content).digest('hex')

    // Generate a unique fileId for the child (combine folder ID with filename hash)
    const childFileId = result.fileId || `${folderScanId}-${createHash('md5').update(filename).digest('hex').slice(0, 8)}`

    // 2. Create child scan record with parentId and findings
    await prisma.scan.create({
      data: {
        fileId: childFileId,
        contentHash,
        filename,
        score: result.score,
        status: 'completed',
        scannedAt: new Date(),
        scanDuration: result.metadata.scanDuration || 0,
        parentId: folderScanId,
        findings: {
          create: result.findings?.map((finding: any) => ({
            ruleId: finding.ruleId,
            severity: finding.severity,
            message: finding.message,
            line: finding.location.line,
            column: finding.location.column,
            code: finding.code,
          })) || [],
        },
        metadata: JSON.stringify({
          userId,
          findingsCount: result.findings?.length || 0,
        }),
      },
    })

    // 3. Update folder progress
    const folder = await prisma.scan.findUnique({ where: { id: folderScanId } })
    if (!folder) throw new Error(`Folder scan ${folderScanId} not found`)

    const metadata = JSON.parse(folder.metadata || '{}')
    const completedFiles = (metadata.completedFiles || 0) + 1
    const totalFiles = metadata.totalFiles || 1

    await prisma.scan.update({
      where: { id: folderScanId },
      data: {
        metadata: JSON.stringify({
          ...metadata,
          completedFiles,
        }),
      },
    })

    // 4. Emit progress event
    await emitFolderProgress({
      jobId: folderScanId,
      fileId: childFileId,
      filename,
      completed: completedFiles,
      total: totalFiles,
      score: result.score,
    })

    // 5. Check if folder complete
    if (completedFiles >= totalFiles) {
      await finalizeFolderScan(folderScanId)
    }

    return result
  } catch (error) {
    console.error(`[FolderWorker] Failed to process ${filename}:`, error)
    throw error // Let BullMQ handle retries
  } finally {
    // Explicitly release scanner resources
    scanner = null
    // Force garbage collection hint (if available)
    if (typeof global.gc === 'function') {
      setTimeout(() => global.gc!(), 100)
    }
  }
}

export class FolderWorkerService {
  private worker: Worker | null = null
  private queueService: ScanQueueService | null = null

  async start() {
    if (this.worker) return

    const queueService = new ScanQueueService()
    const queue = queueService.getQueue()
    const redisConnection = getRedisConnection()

    // Worker listens to the 'scan-jobs' queue (same as ScanQueueService)
    // concurrency: 1 to minimize memory pressure - each file scanned one at a time
    this.worker = new Worker(
      'scan-jobs', // Queue name - must match ScanQueueService
      async (job: Job) => {
        return await processFolderFile(job)
      },
      {
        connection: redisConnection,
        concurrency: 1, // Process ONE file at a time to minimize memory usage
      }
    )

    this.worker.on('completed', (job) => {
      console.log(`[FolderWorker] Completed job ${job.id}`)
    })

    this.worker.on('failed', (job, error) => {
      console.error(`[FolderWorker] Failed job ${job?.id}:`, error)
    })

    this.worker.on('ready', () => {
      console.log('[FolderWorkerService] Worker ready - listening for folder-scan jobs')
    })

    this.queueService = queueService
    console.log('[FolderWorkerService] Worker started with connection:', redisConnection)
  }

  async stop() {
    if (this.worker) {
      await this.worker.close()
      this.worker = null
    }
    if (this.queueService) {
      await this.queueService.close()
      this.queueService = null
    }
  }
}
