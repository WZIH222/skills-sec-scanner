'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface AIConfig {
  configured: boolean
  primaryProvider?: string
  details?: Record<string, unknown>
}

export default function AIConfigStatus() {
  const [config, setConfig] = useState<AIConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load AI configuration')
      } finally {
        setIsLoading(false)
      }
    }

    fetchConfig()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
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
    <div className="py-2">
      <span className="text-sm text-muted-foreground">AI Analysis: </span>
      {config?.configured && providerDisplay ? (
        <span className="text-sm font-medium text-green-600">
          {providerDisplay} - Configured
        </span>
      ) : (
        <span className="text-sm font-medium text-yellow-600">
          Not Configured
        </span>
      )}
    </div>
  )
}
