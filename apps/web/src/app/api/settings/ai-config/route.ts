import { NextRequest, NextResponse } from 'next/server'
import { getAISettings, getSystemSettings, updateAISettings, isAIConfigured } from '@/lib/settings'
import type { AIProviderType } from '@skills-sec/scanner'

/**
 * GET /api/settings/ai-config
 *
 * Returns AI configuration status.
 * Reads from database first, falls back to environment variables.
 * Never exposes the actual API key - just whether it's configured.
 */
export async function GET() {
  try {
    // Check database settings first
    const dbConfigured = await isAIConfigured()
    const dbSettings = await getSystemSettings()

    // Check environment as fallback
    const envConfigured = !!process.env.AI_API_KEY

    // Determine actual configuration source
    let primaryProvider: string | null = null
    let primaryConfigured = false
    let source: 'database' | 'environment' | 'none' = 'none'

    if (dbConfigured) {
      primaryProvider = dbSettings.aiProviderType
      primaryConfigured = true
      source = 'database'
    } else if (envConfigured) {
      primaryProvider = process.env.AI_PROVIDER_TYPE || 'openai'
      primaryConfigured = true
      source = 'environment'
    }

    const response = {
      configured: primaryConfigured,
      primaryProvider,
      source,
      details: {
        database: dbConfigured
          ? {
              type: dbSettings.aiProviderType,
              baseURL: dbSettings.aiBaseUrl || null,
              model: dbSettings.aiModel || null,
            }
          : null,
        environment: envConfigured
          ? {
              type: process.env.AI_PROVIDER_TYPE || 'openai',
              baseURL: process.env.AI_BASE_URL || null,
              model: process.env.AI_MODEL || null,
            }
          : null,
      },
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('[Settings] Failed to get AI config:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve AI configuration' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/settings/ai-config
 *
 * Update AI configuration in the database.
 * Request body: { providerType, apiKey, baseUrl, model }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const { providerType, apiKey, baseUrl, model } = body as {
      providerType?: AIProviderType
      apiKey?: string
      baseUrl?: string
      model?: string
    }

    // Validate provider type if provided
    if (providerType && !['openai', 'anthropic', 'custom', 'test'].includes(providerType)) {
      return NextResponse.json(
        { error: 'Invalid provider type' },
        { status: 400 }
      )
    }

    // Update settings in database
    const updated = await updateAISettings({
      providerType,
      apiKey,
      baseUrl,
      model,
    })

    return NextResponse.json(
      {
        success: true,
        message: 'AI configuration updated',
        settings: {
          providerType: updated.aiProviderType,
          baseURL: updated.aiBaseUrl || null,
          model: updated.aiModel || null,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Settings] Failed to update AI config:', error)
    return NextResponse.json(
      { error: 'Failed to update AI configuration' },
      { status: 500 }
    )
  }
}