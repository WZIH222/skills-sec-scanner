/**
 * System Settings Helper
 * Reads and writes system settings from the database
 */
import { prisma } from '@skills-sec/database'
import type { AIProviderType } from '@skills-sec/scanner'
import { encryptApiKey, decryptApiKey } from './encryption'

export interface AISettings {
  providerType: AIProviderType
  apiKey: string
  baseUrl: string
  model: string
}

export interface SystemSettings {
  aiProviderType: string
  aiApiKey: string
  aiBaseUrl: string
  aiModel: string
  defaultPolicy: string
}

const DEFAULT_SETTINGS: SystemSettings = {
  aiProviderType: 'openai',
  aiApiKey: '',
  aiBaseUrl: '',
  aiModel: '',
  defaultPolicy: 'MODERATE',
}

/**
 * Get system settings from database
 * Returns default settings if no settings exist
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'global' },
  })

  if (!settings) {
    return DEFAULT_SETTINGS
  }

  return {
    aiProviderType: settings.aiProviderType || DEFAULT_SETTINGS.aiProviderType,
    aiApiKey: settings.aiApiKey || DEFAULT_SETTINGS.aiApiKey,
    aiBaseUrl: settings.aiBaseUrl || DEFAULT_SETTINGS.aiBaseUrl,
    aiModel: settings.aiModel || DEFAULT_SETTINGS.aiModel,
    defaultPolicy: settings.defaultPolicy || DEFAULT_SETTINGS.defaultPolicy,
  }
}

/**
 * Get AI settings (convenience method)
 * Returns AI config with decrypted API key
 */
export async function getAISettings(): Promise<AISettings> {
  const settings = await getSystemSettings()

  let decryptedApiKey = ''
  if (settings.aiApiKey) {
    try {
      decryptedApiKey = await decryptApiKey(settings.aiApiKey)
    } catch (error) {
      console.error('[Settings] Failed to decrypt AI API key:', error)
      // If decryption fails, the key might be stored in plaintext (legacy) or corrupted
      decryptedApiKey = settings.aiApiKey
    }
  }

  return {
    providerType: settings.aiProviderType as AIProviderType,
    apiKey: decryptedApiKey,
    baseUrl: settings.aiBaseUrl,
    model: settings.aiModel,
  }
}

/**
 * Update AI settings
 * Encrypts the API key before storing
 */
export async function updateAISettings(
  aiSettings: Partial<AISettings>
): Promise<SystemSettings> {
  const current = await getSystemSettings()

  const updates: Partial<SystemSettings> = {}

  if (aiSettings.providerType !== undefined) {
    updates.aiProviderType = aiSettings.providerType
  }

  if (aiSettings.apiKey !== undefined) {
    // Encrypt the API key before storing
    if (aiSettings.apiKey) {
      updates.aiApiKey = await encryptApiKey(aiSettings.apiKey)
    } else {
      updates.aiApiKey = ''
    }
  }

  if (aiSettings.baseUrl !== undefined) {
    updates.aiBaseUrl = aiSettings.baseUrl
  }

  if (aiSettings.model !== undefined) {
    updates.aiModel = aiSettings.model
  }

  // Upsert the settings
  return prisma.systemSettings.upsert({
    where: { id: 'global' },
    update: updates,
    create: {
      id: 'global',
      ...current,
      ...updates,
    },
  })
}

/**
 * Check if AI is configured (has non-empty API key)
 */
export async function isAIConfigured(): Promise<boolean> {
  const settings = await getSystemSettings()
  return !!settings.aiApiKey && settings.aiApiKey.length > 0
}
