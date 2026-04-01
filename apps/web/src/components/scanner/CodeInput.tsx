'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Clipboard, X, FileCode } from 'lucide-react'

interface CodeInputProps {
  onCodeSubmit: (code: string, filename: string) => void
  onError?: (error: string) => void
  isSubmitting?: boolean
}

/**
 * CodeInput Component
 *
 * Textarea for code paste with filename input
 * Supports paste from clipboard, character count, and max length validation
 */
export function CodeInput({ onCodeSubmit, onError, isSubmitting }: CodeInputProps) {
  const [code, setCode] = useState('')
  const [filename, setFilename] = useState('')
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const maxLength = 50000 // 50,000 characters
  const allowedExtensions = ['.js', '.ts', '.json']

  useEffect(() => {
    // Auto-resize textarea based on content
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [code])

  const validateFilename = (name: string): string | null => {
    if (!name || name.trim().length === 0) {
      return 'Filename is required'
    }

    const fileExtension = '.' + name.split('.').pop()?.toLowerCase()
    if (!allowedExtensions.includes(fileExtension)) {
      return `Invalid file type. Only ${allowedExtensions.join(', ')} files are allowed`
    }

    return null
  }

  const handlePaste = useCallback(async () => {
    try {
      const clipboardText = await navigator.clipboard.readText()

      if (clipboardText.length > maxLength) {
        const errorMsg = `Code exceeds ${maxLength.toLocaleString()} character limit`
        setError(errorMsg)
        onError?.(errorMsg)
        return
      }

      setCode(clipboardText)
      setError(null)

      // Auto-submit if filename is already provided
      if (filename && !validateFilename(filename)) {
        onCodeSubmit(clipboardText, filename)
      }
    } catch (err) {
      const errorMsg = 'Failed to read from clipboard. Please check permissions.'
      setError(errorMsg)
      onError?.(errorMsg)
    }
  }, [filename, onCodeSubmit, onError])

  const handleSubmit = () => {
    setError(null)

    // Validate code
    if (!code || code.trim().length === 0) {
      const errorMsg = 'Code is required'
      setError(errorMsg)
      onError?.(errorMsg)
      return
    }

    // Validate filename
    const filenameError = validateFilename(filename)
    if (filenameError) {
      setError(filenameError)
      onError?.(filenameError)
      return
    }

    onCodeSubmit(code, filename)
  }

  const handleClear = () => {
    setCode('')
    setFilename('')
    setError(null)
  }

  const canSubmit = code.trim().length > 0 && filename.trim().length > 0

  return (
    <div className="w-full space-y-4">
      <Card className="p-6">
        <div className="space-y-4">
          {/* Filename Input */}
          <div className="space-y-2">
            <label htmlFor="filename" className="text-sm font-medium">
              Filename <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <FileCode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="filename"
                  type="text"
                  placeholder="e.g., skill.js"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Must end with .js, .ts, or .json
            </p>
          </div>

          {/* Code Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="code" className="text-sm font-medium">
                Code <span className="text-destructive">*</span>
              </label>
              <div className="flex items-center space-x-2">
                <span className={`text-xs ${
                  code.length > maxLength * 0.9 ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {code.length.toLocaleString()} / {maxLength.toLocaleString()} characters
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handlePaste}
                  className="h-7 px-2"
                >
                  <Clipboard className="mr-1 h-3 w-3" />
                  Paste
                </Button>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your Skill code here..."
              className={`
                min-h-[300px] w-full rounded-md border bg-background px-3 py-2 text-sm
                placeholder:text-muted-foreground focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                disabled:cursor-not-allowed disabled:opacity-50
                font-mono
                ${code.length > maxLength ? 'border-destructive' : 'border-input'}
              `}
              maxLength={maxLength + 1} // Allow one extra to show validation
              disabled={false}
            />

            {code.length > maxLength && (
              <p className="text-xs text-destructive">
                Code exceeds maximum length
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={!code && !filename}
            >
              <X className="mr-1 h-4 w-4" />
              Clear
            </Button>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || code.length > maxLength || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></span>
                  Scanning...
                </>
              ) : (
                'Scan Code'
              )}
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  )
}
