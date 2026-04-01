/**
 * Redis Availability Checker
 *
 * Checks if Redis is available and provides graceful fallback behavior
 * for features that depend on Redis (like folder scanning queues).
 */

import { config } from './config'
import net from 'net'

let redisAvailable: boolean | null = null
let cacheTimestamp: number | null = null
const CACHE_TTL_MS = 5000 // 5 seconds

/**
 * Parse Redis URL into connection options for BullMQ
 */
function parseRedisUrl(redisUrl: string): { host: string; port: number; password?: string } {
  try {
    // ioredis accepts redis:// URLs directly, BullMQ needs separate fields
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
 * Check if Redis is available by attempting to connect
 * Caches the result for a short time to avoid repeated connection attempts
 */
export async function isRedisAvailable(): Promise<boolean> {
  const now = Date.now()

  // Return cached result if still valid
  if (redisAvailable !== null && cacheTimestamp !== null && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return redisAvailable
  }

  // Reset cache if expired
  if (cacheTimestamp !== null && (now - cacheTimestamp) >= CACHE_TTL_MS) {
    redisAvailable = null
    cacheTimestamp = null
  }

  // Get Redis URL - loaded by Next.js from monorepo root .env (via envDir in next.config.mjs)
  const redisUrl = config.redisUrl || process.env.REDIS_URL

  if (!redisUrl) {
    console.log('[RedisChecker] REDIS_URL not configured')
    redisAvailable = false
    cacheTimestamp = now
    return false
  }

  // Try TCP connection to verify Redis port is open (most reliable check)
  try {
    const url = new URL(redisUrl)
    const host = url.hostname || 'localhost'
    const port = parseInt(url.port, 10) || 6379

    const isOpen = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket()
      const timeout = setTimeout(() => {
        socket.destroy()
        resolve(false)
      }, 3000)

      socket.on('connect', () => {
        clearTimeout(timeout)
        socket.destroy()
        resolve(true)
      })

      socket.on('error', () => {
        clearTimeout(timeout)
        socket.destroy()
        resolve(false)
      })

      socket.connect(port, host)
    })

    if (isOpen) {
      redisAvailable = true
      cacheTimestamp = now
      return true
    }
  } catch {
    // TCP check failed
  }

  redisAvailable = false
  cacheTimestamp = now
  return false
}

/**
 * Reset the cached Redis availability status
 * Use this after Redis configuration changes or to re-check availability
 */
export function resetRedisCache(): void {
  redisAvailable = null
  cacheTimestamp = null
  console.log('[RedisChecker] Cache cleared')
}

/**
 * Get user-friendly message about Redis requirements
 */
export function getRedisRequirementMessage(folderSize: number): string {
  const maxSyncSize = config.maxSyncFolderSize || 5
  if (folderSize <= maxSyncSize) {
    return `Folder has ${folderSize} file(s). Sync mode is available but may be slow. Configure Redis for better performance.`
  } else {
    return `Folder has ${folderSize} file(s). Redis is required for folders with more than ${maxSyncSize} files. Please configure REDIS_URL in .env or upload fewer files.`
  }
}
