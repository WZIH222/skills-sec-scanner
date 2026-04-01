'use client'

import React, { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, Loader2 } from 'lucide-react'

interface ResultsExportProps {
  scanId: string
  onToast?: (message: string, type: 'info' | 'success' | 'error') => void
}

export function ResultsExport({ scanId, onToast }: ResultsExportProps) {
  const t = useTranslations('ScanDetail')
  const [exporting, setExporting] = useState<string | null>(null)

  // Handle export
  // Note: No need to send Authorization header - server reads httpOnly cookie automatically
  const handleExport = useCallback(async (format: 'json' | 'sarif') => {
    try {
      setExporting(format)

      const response = await fetch(`/api/scans/${scanId}/export?format=${format}`)

      if (!response.ok) {
        // Get error details from response
        let errorMsg = `${t('exportFailed')} (${response.status})`
        try {
          const errorData = await response.json()
          if (errorData.error) {
            errorMsg = `${t('exportFailed')}: ${errorData.error}`
          }
        } catch {
          // If JSON parsing fails, use status text
          errorMsg = `${t('exportFailed')}: ${response.statusText}`
        }
        throw new Error(errorMsg)
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition')
      let filename = `scan-export.${format}`
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
        if (filenameMatch) {
          filename = filenameMatch[1]
        }
      }

      // Create blob and download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Export error:', err)
      onToast?.(err instanceof Error ? err.message : t('exportFailed'), 'error')
    } finally {
      setExporting(null)
    }
  }, [scanId, t])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {exporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('exporting')}
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              {t('export')}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('json')} disabled={!!exporting}>
          {t('exportAsJson')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('sarif')} disabled={!!exporting}>
          {t('exportAsSarif')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
