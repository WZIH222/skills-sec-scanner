/**
 * Folder Queue Integration
 *
 * Integrates folder uploads with BullMQ job queue for async processing.
 * Queues individual file scans as separate jobs for parallel processing.
 */

import { ScanQueueService } from '@skills-sec/scanner'

let queueService: ScanQueueService | null = null

export async function getQueueService() {
  if (!queueService) {
    queueService = new ScanQueueService()
  }
  return queueService
}

export interface FolderQueueOptions {
  folderScanId: string
  files: File[]
  userId: string
  aiEnabled: boolean
  policyMode: string
}

export async function queueFolderFiles(options: FolderQueueOptions): Promise<void> {
  try {
    const service = await getQueueService()
    // Get the raw BullMQ queue to add jobs with custom data format
    const queue = service.getQueue()

    // Queue each file as separate job for folder-worker
    for (const file of options.files) {
      const content = await file.text()

      await queue.add('folder-scan', {
        folderScanId: options.folderScanId,
        content,
        filename: file.name,
        userId: options.userId,
        aiEnabled: options.aiEnabled,
        policyMode: options.policyMode,
      })
    }

    console.log(`[FolderQueue] Queued ${options.files.length} files for folder ${options.folderScanId}`)
  } catch (error: any) {
    // Provide clearer error message for Redis connection issues
    if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED')) {
      throw new Error(
        'Redis connection refused. Please ensure Redis is running on port 6379. ' +
        'You can start Redis with: docker run -d -p 6379:6379 redis:7-alpine'
      )
    }
    throw error
  }
}
