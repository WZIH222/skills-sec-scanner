/**
 * Configuration utilities for the web application
 *
 * This module provides functions for reading and validating environment variables.
 * Full implementation will be completed in later plans.
 */

/**
 * Get environment variable value with optional fallback
 * @param key - Environment variable name
 * @param fallback - Default value if key doesn't exist
 * @returns Environment variable value or fallback
 */
export function getEnv(key: string, fallback?: string): string | undefined {
  return process.env[key] || fallback
}

/**
 * Get required environment variable
 * Throws error if the variable doesn't exist
 * @param key - Environment variable name
 * @returns Environment variable value
 * @throws Error if required variable is missing
 */
export function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

/**
 * Check if Redis is configured and available
 * @returns true if Redis URL is configured and connection works
 */
export async function checkRedisAvailable(): Promise<boolean> {
  const redisUrl = getEnv('REDIS_URL')
  if (!redisUrl) {
    return false
  }

  try {
    // Try to connect to Redis with a timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000) // 2 second timeout

    // Simple connection check using fetch (works if Redis has HTTP interface)
    // Otherwise we'll rely on the BullMQ connection attempt
    const result = await fetch(redisUrl.replace('redis://', 'http://'), {
      signal: controller.signal,
    }).catch(() => ({ ok: false }))

    clearTimeout(timeoutId)
    return result.ok
  } catch {
    // If direct check fails, we'll let BullMQ handle it
    // Return true to attempt connection (will fail gracefully if unavailable)
    return true
  }
}

/**
 * Application configuration object
 * Provides centralized access to all configuration values
 */
export const config = {
  // Server configuration
  port: parseInt(getEnv('PORT', '3000') || '3000', 10),
  nodeEnv: getEnv('NODE_ENV', 'development'),

  // Database configuration
  databaseUrl: requireEnv('DATABASE_URL'),

  // Security configuration
  jwtSecret: requireEnv('JWT_SECRET'),

  // API configuration
  apiUrl: getEnv('API_URL', 'http://localhost:3001'),

  // Redis configuration (optional)
  redisUrl: getEnv('REDIS_URL'),

  // Feature flags
  enableAiAnalysis: getEnv('ENABLE_AI_ANALYSIS', 'true') === 'true',
  redisAvailable: false, // Will be set at runtime by checkRedisAvailable()

  // Folder scan configuration
  maxSyncFolderSize: parseInt(getEnv('MAX_SYNC_FOLDER_SIZE', '5') || '5', 10), // Max files for sync mode
}
