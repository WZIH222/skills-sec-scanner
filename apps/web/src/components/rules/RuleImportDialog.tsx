'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Loader2, Upload, AlertCircle, CheckCircle2 } from 'lucide-react'

interface RuleImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: () => void
}

interface ParsedRule {
  id?: string
  name?: string
  severity?: string
  category?: string
  pattern?: unknown
  message?: string
}

export default function RuleImportDialog({
  open,
  onOpenChange,
  onImportComplete,
}: RuleImportDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [parsedRules, setParsedRules] = useState<ParsedRule[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [importMode, setImportMode] = useState<'strict' | 'replace'>('strict')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported?: number; updated?: number; errors?: string[] } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setFile(selectedFile)
    setParseError(null)
    setImportResult(null)

    try {
      const text = await selectedFile.text()
      const parsed = JSON.parse(text)

      if (!Array.isArray(parsed)) {
        setParseError('File must contain a JSON array of rules')
        setParsedRules([])
        return
      }

      setParsedRules(parsed)
    } catch {
      setParseError('Invalid JSON format')
      setParsedRules([])
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (!droppedFile) return

    if (!droppedFile.name.endsWith('.json')) {
      setParseError('File must be a JSON file')
      return
    }

    setFile(droppedFile)
    setParseError(null)
    setImportResult(null)

    try {
      const text = await droppedFile.text()
      const parsed = JSON.parse(text)

      if (!Array.isArray(parsed)) {
        setParseError('File must contain a JSON array of rules')
        setParsedRules([])
        return
      }

      setParsedRules(parsed)
    } catch {
      setParseError('Invalid JSON format')
      setParsedRules([])
    }
  }

  const handleImport = async () => {
    if (!file || parsedRules.length === 0) return

    try {
      setImporting(true)
      setImportResult(null)

      const response = await fetch('/api/rules/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: parsedRules, mode: importMode }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Import failed')
      }

      setImportResult({
        imported: data.imported,
        updated: data.updated,
        errors: data.errors || [],
      })

      if (data.imported > 0 || data.updated > 0) {
        setTimeout(() => {
          onImportComplete()
        }, 1500)
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setParsedRules([])
    setParseError(null)
    setImportResult(null)
    setImportMode('strict')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Rules</DialogTitle>
          <DialogDescription>
            Import detection rules from a JSON file. Rules must be in the expected format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Area */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              {file ? file.name : 'Click or drag and drop a JSON file'}
            </p>
          </div>

          {/* Parse Error */}
          {parseError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Preview */}
          {parsedRules.length > 0 && !parseError && (
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">
                  {parsedRules.length} rule{parsedRules.length > 1 ? 's' : ''} parsed
                </span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
                {parsedRules.slice(0, 5).map((rule, i) => (
                  <li key={i}>
                    {rule.name || rule.id || `Rule ${i + 1}`}
                    {rule.severity && (
                      <span className="ml-2 text-muted-foreground">({rule.severity})</span>
                    )}
                  </li>
                ))}
                {parsedRules.length > 5 && (
                  <li className="text-muted-foreground">
                    ...and {parsedRules.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className="rounded-lg bg-muted/50 p-3 space-y-2">
              {importResult.imported !== undefined && importResult.imported > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{importResult.imported} rule{importResult.imported > 1 ? 's' : ''} imported</span>
                </div>
              )}
              {importResult.updated !== undefined && importResult.updated > 0 && (
                <div className="flex items-center gap-2 text-sm text-blue-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{importResult.updated} rule{importResult.updated > 1 ? 's' : ''} updated</span>
                </div>
              )}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="text-sm text-destructive">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>{importResult.errors.length} error{importResult.errors.length > 1 ? 's' : ''}</span>
                  </div>
                  <ul className="text-xs ml-6 space-y-1 max-h-24 overflow-y-auto">
                    {importResult.errors.slice(0, 3).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {importResult.errors.length > 3 && (
                      <li>...and {importResult.errors.length - 3} more errors</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Import Mode */}
          {parsedRules.length > 0 && !importResult && (
            <div className="space-y-2">
              <Label>Import Mode</Label>
              <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as 'strict' | 'replace')}>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="strict" id="strict" />
                  <div>
                    <Label htmlFor="strict" className="font-medium cursor-pointer">
                      Skip existing
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Only import rules that don't already exist
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <RadioGroupItem value="replace" id="replace" />
                  <div>
                    <Label htmlFor="replace" className="font-medium cursor-pointer">
                      Replace existing
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Update existing rules with the same ID
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || parsedRules.length === 0 || importing || !!parseError}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              'Import'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
