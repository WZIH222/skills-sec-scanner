'use client'

import { useState, useEffect } from 'react'
import { Loader2, CheckCircle, AlertCircle, Edit2, X, Save } from 'lucide-react'

interface AIConfigStatus {
  configured: boolean
  primaryProvider: string | null
  source: 'database' | 'environment' | 'none'
  details: {
    database: {
      type: string
      baseURL: string | null
      model: string | null
    } | null
    environment: {
      type: string
      baseURL: string | null
      model: string | null
    } | null
  } | null
}

interface AIConfigInput {
  providerType: string
  apiKey: string
  baseUrl: string
  model: string
}

export default function AIConfigForm() {
  const [config, setConfig] = useState<AIConfigStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [formData, setFormData] = useState<AIConfigInput>({
    providerType: 'openai',
    apiKey: '',
    baseUrl: '',
    model: 'gpt-4o',
  })

  useEffect(() => {
    const fetchConfig = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/settings/ai-config')

        if (!response.ok) {
          throw new Error('Failed to fetch AI configuration')
        }

        const data = await response.json()
        setConfig(data)

        // Pre-fill form with current settings
        if (data.details?.database) {
          setFormData({
            providerType: data.details.database.type || 'openai',
            apiKey: '', // Don't show existing API key
            baseUrl: data.details.database.baseURL || '',
            model: data.details.database.model || 'gpt-4o',
          })
        } else if (data.details?.environment) {
          setFormData({
            providerType: data.details.environment.type || 'openai',
            apiKey: '',
            baseUrl: data.details.environment.baseURL || '',
            model: data.details.environment.model || 'gpt-4o',
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load AI configuration')
      } finally {
        setIsLoading(false)
      }
    }

    fetchConfig()
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/settings/ai-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save AI configuration')
      }

      setSuccess('AI configuration saved successfully')
      setIsEditing(false)

      // Refresh config
      const refreshResponse = await fetch('/api/settings/ai-config')
      if (refreshResponse.ok) {
        const data = await refreshResponse.json()
        setConfig(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save AI configuration')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    // Reset form data to current config
    if (config?.details?.database) {
      setFormData({
        providerType: config.details.database.type || 'openai',
        apiKey: '',
        baseUrl: config.details.database.baseURL || '',
        model: config.details.database.model || 'gpt-4o',
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !config) {
    return (
      <div className="text-sm text-red-600 py-2">
        {error}
      </div>
    )
  }

  const providerDisplay = config?.primaryProvider
    ? config.primaryProvider.charAt(0).toUpperCase() + config.primaryProvider.slice(1).toLowerCase()
    : null

  return (
    <div className="space-y-4">
      {/* Status Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">AI Analysis: </span>
          {config?.configured && providerDisplay ? (
            <span className="text-sm font-medium text-green-600 flex items-center gap-1">
              <CheckCircle className="h-4 w-4" />
              {providerDisplay} - Configured
              {config.source && <span className="text-xs text-muted-foreground">({config.source})</span>}
            </span>
          ) : (
            <span className="text-sm font-medium text-yellow-600 flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              Not Configured
            </span>
          )}
        </div>

        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <Edit2 className="h-4 w-4" />
            Configure
          </button>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="text-sm text-red-600 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="text-sm text-green-600 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      {/* Edit Form */}
      {isEditing && (
        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
          <div className="grid gap-4">
            {/* Provider Type */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Provider
              </label>
              <select
                value={formData.providerType}
                onChange={(e) => setFormData({ ...formData, providerType: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="custom">Custom (OpenAI Compatible)</option>
                <option value="test">Test Mode</option>
              </select>
            </div>

            {/* API Key */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                API Key
              </label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder={config?.configured ? '•••••••• (unchanged)' : 'Enter API key'}
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              />
              {formData.apiKey && formData.apiKey.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to keep existing key
                </p>
              )}
            </div>

            {/* Base URL */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={formData.baseUrl}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                placeholder={
                  formData.providerType === 'openai' ? 'https://api.openai.com/v1' :
                  formData.providerType === 'anthropic' ? 'https://api.anthropic.com' :
                  'https://api.example.com/v1'
                }
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave empty to use default endpoint
              </p>
            </div>

            {/* Model */}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Model
              </label>
              <input
                type="text"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder={
                  formData.providerType === 'openai' ? 'gpt-4o' :
                  formData.providerType === 'anthropic' ? 'claude-3-5-sonnet' :
                  formData.providerType === 'custom' ? 'gpt-4o' :
                  'gpt-4o'
                }
                className="w-full px-3 py-2 border rounded-md text-sm bg-background"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formData.providerType === 'anthropic'
                  ? 'e.g., claude-3-5-sonnet, claude-3-opus'
                  : 'e.g., gpt-4o, gpt-4o-mini, gpt-3.5-turbo'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
