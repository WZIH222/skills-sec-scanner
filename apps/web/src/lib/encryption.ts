/**
 * API Key Encryption Utilities (DATA-05)
 *
 * Encrypts API keys at rest using AES-256-GCM with a master key from environment variables.
 * Uses Web Crypto API (crypto.subtle) available in Node.js and Edge runtime.
 * If ENCRYPTION_KEY is not set, generates a random key at runtime.
 */

const ENCRYPTION_KEY_ALGO = 'AES-GCM'
const IV_LENGTH = 12 // GCM standard IV length
const KEY_LENGTH = 256 // AES-256

// Cache the generated key to ensure consistent encryption/decryption
let cachedKey: CryptoKey | null = null
let cachedKeyBase64: string | null = null

/**
 * Get master encryption key from environment, or generate a random one at runtime
 * @returns CryptoKey object for encryption/decryption
 */
async function getMasterKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey

  const keyBase64 = process.env.ENCRYPTION_KEY

  let keyBuffer: Uint8Array

  if (!keyBase64) {
    // Generate a random 32-byte key at runtime if not configured
    console.warn('[Encryption] ENCRYPTION_KEY not set, generating random key at runtime. This will invalidate any stored API keys on restart.')
    keyBuffer = crypto.getRandomValues(new Uint8Array(32))
    cachedKeyBase64 = btoa(String.fromCharCode(...keyBuffer))
  } else {
    try {
      keyBuffer = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0))
      cachedKeyBase64 = keyBase64
    } catch {
      throw new Error(`Invalid ENCRYPTION_KEY: failed to decode base64`)
    }
  }

  if (keyBuffer.length !== 32) {
    throw new Error(`ENCRYPTION_KEY must be 32 bytes (base64 encoded), got ${keyBuffer.length} bytes`)
  }

  // Import key for AES-GCM
  cachedKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    ENCRYPTION_KEY_ALGO,
    false,
    ['encrypt', 'decrypt']
  )

  return cachedKey
}

/**
 * Encrypt API key using AES-256-GCM
 * @param plaintext - API key to encrypt
 * @returns Base64 encoded string (IV + ciphertext + authTag)
 * @throws Error if encryption fails
 */
export async function encryptApiKey(plaintext: string): Promise<string> {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('Plaintext must be a non-empty string')
  }

  try {
    const masterKey = await getMasterKey()
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const encoder = new TextEncoder()
    const data = encoder.encode(plaintext)

    // Encrypt with AES-GCM
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION_KEY_ALGO,
        iv,
      },
      masterKey,
      data
    )

    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + ciphertext.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(ciphertext), iv.length)

    // Return as base64
    return btoa(String.fromCharCode(...combined))
  } catch (error) {
    throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Decrypt API key using AES-256-GCM
 * @param ciphertext - Base64 encoded string (IV + ciphertext + authTag)
 * @returns Decrypted API key
 * @throws Error if decryption fails
 */
export async function decryptApiKey(ciphertext: string): Promise<string> {
  if (!ciphertext || typeof ciphertext !== 'string') {
    throw new Error('Ciphertext must be a non-empty string')
  }

  try {
    const masterKey = await getMasterKey()
    const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))

    if (combined.length < IV_LENGTH) {
      throw new Error('Ciphertext too short')
    }

    // Extract IV and ciphertext
    const iv = combined.slice(0, IV_LENGTH)
    const data = combined.slice(IV_LENGTH)

    // Decrypt with AES-GCM
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_KEY_ALGO,
        iv,
      },
      masterKey,
      data
    )

    const decoder = new TextDecoder()
    return decoder.decode(decrypted)
  } catch (error) {
    throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Hash API key for lookup (not reversible)
 * Uses SHA-256 for secure key comparison
 * @param key - API key to hash
 * @returns SHA-256 hash hex string
 */
export async function hashApiKey(key: string): Promise<string> {
  if (!key || typeof key !== 'string') {
    throw new Error('Key must be a non-empty string')
  }

  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(key)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)

    // Convert to hex string
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  } catch (error) {
    throw new Error(`Hash failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * Mask API key for display (show only last 4 digits)
 * @param key - API key to mask
 * @returns Masked key (e.g., "sk-....1234")
 */
export function maskApiKey(key: string): string {
  if (!key || typeof key !== 'string') {
    throw new Error('Key must be a non-empty string')
  }

  // Keep only last 4 characters
  const lastFour = key.slice(-4)
  return `....${lastFour}`
}

/**
 * Generate a random encryption key for ENCRYPTION_KEY env var
 * Call this once to generate your master key
 * @returns Base64 encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...key))
}