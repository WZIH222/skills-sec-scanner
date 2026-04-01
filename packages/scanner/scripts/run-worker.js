/**
 * Standalone Worker Process for Folder Scanning
 *
 * Run this as a separate process to handle folder scan jobs.
 * This ensures memory isolation - if the worker OOMs, the API keeps running.
 *
 * Usage:
 *   node scripts/run-worker.js
 *
 * Or with environment variables:
 *   REDIS_URL=redis://:123456@localhost:6379 DATABASE_URL=file:./dev.db node scripts/run-worker.js
 *
 * Note: Run from packages/scanner directory
 */

import { FolderWorkerService } from '../dist/workers/folder-worker.js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

// Simple .env loader without external dependencies
function loadEnvFromFile(filepath) {
  if (!existsSync(filepath)) {
    console.log(`[WorkerProcess] .env file not found at ${filepath}, using existing env vars`)
    return
  }

  const content = readFileSync(filepath, 'utf-8')
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue

    const key = trimmed.substring(0, eqIndex).trim()
    let value = trimmed.substring(eqIndex + 1).trim()

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    if (key && !process.env[key]) {
      process.env[key] = value
    }
  }
}

// Load .env from project root (three levels up from scripts/)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const envPath = join(__dirname, '..', '..', '..', '.env')
console.log('[WorkerProcess] Resolving .env from:', __dirname)
console.log('[WorkerProcess] Loading .env from:', envPath)
loadEnvFromFile(envPath)

// Debug: print loaded env
console.log('[WorkerProcess] REDIS_URL:', process.env.REDIS_URL || '(not set)')
console.log('[WorkerProcess] DATABASE_URL:', process.env.DATABASE_URL || '(not set)')

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
