/**
 * Redis Connection Check Script
 *
 * Runs before dev server to check if Redis is available
 * and warns user if not configured.
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import net from 'net'

// Get .env from project root (3 levels up from scripts/)
const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..', '..', '..')
const envPath = join(rootDir, '.env')

function loadEnv() {
  const env = {}
  // First load .env file
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim()
        }
      }
    }
  }
  // Then override with environment variables (they take precedence)
  for (const [key, value] of Object.entries(process.env)) {
    if ((key.startsWith('REDIS_') || key === 'REDIS_URL') && value !== undefined) {
      env[key] = value
    }
  }
  return env
}

async function checkRedis() {
  console.log('\n🔍 Checking Redis connection...\n')

  try {
    const env = loadEnv()
    console.log('[check-redis] env object:', env)
  console.log('[check-redis] Loaded env, REDIS_URL:', env.REDIS_URL)

  // Check REDIS_URL first, then REDIS_HOST/REDIS_PORT combo
  let redisUrl = env.REDIS_URL || process.env.REDIS_URL
  console.log('[check-redis] redisUrl after assignment:', redisUrl)

  // Construct URL from individual components if needed
  if (!redisUrl && (env.REDIS_HOST || process.env.REDIS_HOST)) {
    const host = env.REDIS_HOST || process.env.REDIS_HOST || 'localhost'
    const port = env.REDIS_PORT || process.env.REDIS_PORT || '6379'
    const password = env.REDIS_PASSWORD || process.env.REDIS_PASSWORD
    redisUrl = password ? `redis://:${password}@${host}:${port}` : `redis://${host}:${port}`
  }

  if (!redisUrl) {
    console.log('⚠️  Redis URL not configured!')
    console.log('   Environment: REDIS_URL is not set')
    console.log('   Folder scanning (>5 files) will fail without Redis.')
    console.log('   To fix: Add REDIS_URL to your .env file')
    console.log('   Example: redis://:password@localhost:6379\n')
    return
  }

  try {
    // Use native net module to check if Redis port is open (most reliable)
    const url = new URL(redisUrl)
    const host = url.hostname || 'localhost'
    const port = parseInt(url.port, 10) || 6379

    const isOpen = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket()
      const timeout = setTimeout(() => {
        socket.destroy()
        resolve(false)
      }, 5000)

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

    const maskedUrl = redisUrl.replace(/:[^:@]+@/, ':***@')

    if (isOpen) {
      console.log('✅ Redis connected successfully!')
      console.log(`   URL: ${maskedUrl}\n`)
    } else {
      console.log('⚠️  Redis connection failed!')
      console.log(`   URL: ${maskedUrl}`)
      console.log('   Error: Connection refused or timeout')
      console.log('   Folder scanning (>5 files) will not work.')
      console.log('   To fix: Start Redis server and ensure REDIS_URL is correct\n')
    }
  } catch (error) {
    const maskedUrl = redisUrl.replace(/:[^:@]+@/, ':***@')
    console.log('⚠️  Redis connection failed!')
    console.log(`   URL: ${maskedUrl}`)
    console.log(`   Error: ${error.message || 'Connection failed'}`)
    console.log('   Folder scanning (>5 files) will not work.')
    console.log('   To fix: Start Redis server and ensure REDIS_URL is correct\n')
  }
}

checkRedis()
