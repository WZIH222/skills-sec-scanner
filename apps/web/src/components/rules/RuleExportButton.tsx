'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Download } from 'lucide-react'

interface RuleExportButtonProps {
  ruleIds: string[]
  disabled?: boolean
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export default function RuleExportButton({
  ruleIds,
  disabled,
  variant = 'outline',
  size = 'sm',
}: RuleExportButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    if (ruleIds.length === 0) return

    try {
      setLoading(true)

      if (ruleIds.length === 1) {
        // Single rule export - use the existing endpoint
        const response = await fetch(`/api/rules/${ruleIds[0]}/export`)

        if (!response.ok) {
          throw new Error('Failed to export rule')
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `rule-${ruleIds[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      } else {
        // Multiple rules - fetch each and combine
        const exportedRules = []

        for (const ruleId of ruleIds) {
          const response = await fetch(`/api/rules/${ruleId}/export`)

          if (response.ok) {
            const blob = await response.blob()
            const text = await blob.text()
            const rule = JSON.parse(text)
            exportedRules.push(rule)
          }
        }

        // Download as combined JSON
        const combinedBlob = new Blob([JSON.stringify(exportedRules, null, 2)], {
          type: 'application/json',
        })
        const url = window.URL.createObjectURL(combinedBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `rules-export-${Date.now()}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={disabled || loading || ruleIds.length === 0}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
    </Button>
  )
}
