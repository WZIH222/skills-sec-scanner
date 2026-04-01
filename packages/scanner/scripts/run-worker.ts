/**
 * Standalone Worker Process for Folder Scanning
 *
 * Run this as a separate process to handle folder scan jobs.
 * This ensures memory isolation - if the worker OOMs, the API keeps running.
 *
 * Usage: npx ts-node scripts/run-worker.ts
 * Or (with compiled dist): node dist/workers/run-worker.js
 */

import { FolderWorkerService } from '../src/workers/folder-worker'

async function main() {
  console.log('[WorkerProcess] Starting folder scan worker...')
  console.log('[WorkerProcess] Press Ctrl+C to stop')

  const workerService = new FolderWorkerService()

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[WorkerProcess] Shutting down...')
    await workerService.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    console.log('[WorkerProcess] Shutting down...')
    await workerService.stop()
    process.exit(0)
  })

  // Start the worker
  try {
    await workerService.start()
    console.log('[WorkerProcess] Worker is now listening for jobs...')
  } catch (error) {
    console.error('[WorkerProcess] Failed to start worker:', error)
    process.exit(1)
  }
}

main().catch(console.error)
