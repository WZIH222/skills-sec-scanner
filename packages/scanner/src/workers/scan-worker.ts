/**
 * Scan Worker - Forked child process for isolated file scanning
 *
 * This runs as a SEPARATE Node.js process with its own heap.
 * Each scan request spawns a fresh process that exits after scanning.
 * This prevents memory leaks from accumulating in the parent process.
 *
 * Communication: parent -> child via process.send(), child -> parent via message
 */

import { createScanner } from '../factory'
import type { AIProviderConfig } from '../ai-engine/types'
import { PolicyMode } from '../policy/policy-types'
import type { ScanOptions } from '../types'

interface ScanMessage {
  type: 'scan'
  id: string
  content: string
  filename: string
  userId: string
  aiEnabled: boolean
  policyMode: PolicyMode
  databaseUrl?: string
  aiProvider?: AIProviderConfig
}

interface ScanResult {
  type: 'result'
  id: string
  success: boolean
  result?: any
  error?: string
}

interface ScanProgress {
  type: 'progress'
  id: string
  message: string
}

// Handle messages from parent
process.on('message', async (msg: ScanMessage) => {
  if (msg.type !== 'scan') return

  const { id, content, filename, userId, aiEnabled, policyMode, aiProvider } = msg

  try {
    // Send progress
    process.send!({ type: 'progress', id, message: `Starting scan of ${filename}` } as ScanProgress)

    // Create scanner with skipAI for memory efficiency in child process
    // Note: In child process, we have fresh memory - don't need caching
    const scanner = await createScanner({
      databaseUrl: process.env.DATABASE_URL,
      aiProvider,
      skipAI: !aiEnabled, // Don't use AI in child process for safety
      filename,
    })

    process.send!({ type: 'progress', id, message: 'Scanner created' } as ScanProgress)

    // Perform scan
    const result = await scanner.scan(content, filename, {
      userId,
      aiEnabled: false, // AI disabled in child process
      policyMode,
      skipStorage: true, // Don't write to DB - parent will do it
    })

    process.send!({ type: 'progress', id, message: 'Scan complete' } as ScanProgress)

    // Send result back
    process.send!({
      type: 'result',
      id,
      success: true,
      result: {
        fileId: result.fileId,
        score: result.score,
        findings: result.findings,
        metadata: result.metadata,
        policyResult: result.policyResult,
      },
    } as ScanResult)
  } catch (error: any) {
    console.error(`[ScanWorker] Error scanning ${filename}:`, error.message)

    process.send!({
      type: 'result',
      id,
      success: false,
      error: error.message,
    } as ScanResult)
  }

  // Exit the child process - clean up all memory
  process.exit(0)
})

// Signal ready
process.send!({ type: 'ready' })
