/**
 * CORS Origin Validator
 *
 * Validates ALLOWED_ORIGINS environment variable at startup.
 * Per D-04 (CORS-02): fail-fast if invalid https:// origin.
 */

let validatedOrigins: string[] | null = null

/**
 * Validate and parse ALLOWED_ORIGINS env var
 *
 * Each comma-separated origin must be a valid https:// URL.
 * Throws descriptive error on first invalid entry.
 *
 * @returns Array of validated origin URLs
 * @throws Error if any origin is invalid or not https://
 */
export function validateAllowedOrigins(): string[] {
  if (validatedOrigins !== null) {
    return validatedOrigins
  }

  const raw = process.env.ALLOWED_ORIGINS
  if (!raw || raw.trim() === '') {
    validatedOrigins = []
    return validatedOrigins
  }

  const origins = raw.split(',').map(o => o.trim())
  validatedOrigins = []
  const errors: string[] = []

  for (const origin of origins) {
    if (!origin) {
      errors.push(`Empty origin entry in ALLOWED_ORIGINS`)
      continue
    }

    try {
      const url = new URL(origin)
      if (url.protocol !== 'https:') {
        errors.push(`ALLOWED_ORIGINS must be https:// — got "${origin}"`)
      } else {
        // Store normalized origin (remove trailing slash)
        validatedOrigins.push(origin.replace(/\/$/, ''))
      }
    } catch {
      errors.push(`Invalid ALLOWED_ORIGINS entry: "${origin}" — must be a valid https:// URL`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`CORS Configuration Error:\n${errors.join('\n')}`)
  }

  return validatedOrigins
}

/**
 * Get validated allowed origins (calls validateAllowedOrigins internally)
 * Use this for runtime origin checks after startup validation has run
 */
export function getAllowedOrigins(): string[] {
  return validateAllowedOrigins()
}

/**
 * Check if an origin is allowed
 */
export function isOriginAllowed(origin: string): boolean {
  const allowed = getAllowedOrigins()
  return allowed.includes(origin)
}
