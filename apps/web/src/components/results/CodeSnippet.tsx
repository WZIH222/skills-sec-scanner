'use client'

import React, { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CodeSnippetProps {
  code: string
  lineNumber?: number
  language?: string
  className?: string
}

export function CodeSnippet({
  code,
  lineNumber,
  language = 'typescript',
  className
}: CodeSnippetProps) {
  const t = useTranslations('ScanDetail')
  const [copied, setCopied] = useState(false)
  const [lines, setLines] = React.useState<string[]>([])

  React.useEffect(() => {
    // Split into lines for display
    setLines(code.split('\n'))
  }, [code])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Calculate context lines (2 before and after the finding line)
  // Clamp to valid range to avoid empty slices
  const safeLineNumber = lineNumber ? Math.min(Math.max(1, lineNumber), lines.length || 1) : undefined
  const contextStart = safeLineNumber ? Math.max(1, safeLineNumber - 2) : 1
  const contextEnd = safeLineNumber ? Math.min(lines.length, safeLineNumber + 2) : lines.length

  // Ensure we have valid slice bounds
  const effectiveStart = Math.min(contextStart, lines.length)
  const effectiveEnd = Math.max(contextEnd, effectiveStart)

  // Check if we're truncating
  const showTopEllipsis = effectiveStart > 1
  const showBottomEllipsis = effectiveEnd < lines.length

  return (
    <div className={cn('relative group', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-mono">
          {language}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" />
              {t('copied') || 'Copied'}
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" />
              {t('copy') || 'Copy'}
            </>
          )}
        </Button>
      </div>

      <div className="rounded-md overflow-hidden border bg-gray-950">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {showTopEllipsis && (
                <tr>
                  <td className="border-r border-gray-800 px-3 py-1 text-gray-600 text-right select-none">
                    ...
                  </td>
                  <td className="px-3 py-1 text-gray-600 font-mono">
                    {/* Truncated lines */}
                  </td>
                </tr>
              )}

              {lines.slice(effectiveStart - 1, effectiveEnd).map((line, idx) => {
                const actualLineNumber = effectiveStart + idx
                const isFindingLine = safeLineNumber === actualLineNumber

                return (
                  <tr
                    key={actualLineNumber}
                    className={cn(
                      'group/line',
                      isFindingLine && 'bg-red-900/20'
                    )}
                  >
                    <td
                      className={cn(
                        'border-r border-gray-800 px-3 py-1 text-gray-500 text-right select-none font-mono text-xs w-12',
                        isFindingLine && 'text-red-400 font-bold'
                      )}
                    >
                      {actualLineNumber}
                    </td>
                    <td
                      className={cn(
                        'px-3 py-1 font-mono',
                        isFindingLine && 'bg-red-900/10'
                      )}
                      style={{ color: 'rgb(255, 255, 255)', fontFamily: 'monospace' }}
                    >
                      <span style={{ color: 'rgb(255, 255, 255)' }}>{line || ' '}</span>
                    </td>
                  </tr>
                )
              })}

              {showBottomEllipsis && (
                <tr>
                  <td className="border-r border-gray-800 px-3 py-1 text-gray-600 text-right select-none">
                    ...
                  </td>
                  <td className="px-3 py-1 text-gray-600 font-mono">
                    {/* Truncated lines */}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
