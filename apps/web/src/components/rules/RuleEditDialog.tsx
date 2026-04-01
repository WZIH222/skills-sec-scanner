'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, AlertCircle } from 'lucide-react'

interface UnifiedRule {
  id: string
  ruleId?: string
  userId?: string
  name: string
  description?: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  category: string
  pattern: unknown
  message: string
  enabled: boolean
  references: string[]
  isBuiltIn: boolean
}

interface RuleEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule: UnifiedRule | null
  onEditComplete: () => void
}

const SEVERITY_OPTIONS = ['critical', 'high', 'medium', 'low', 'info'] as const

const CATEGORY_OPTIONS = [
  'injection',
  'file-access',
  'credentials',
  'network',
  'prototype-pollution',
  'dom-xss',
  'deserialization',
  'path-traversal',
] as const

export default function RuleEditDialog({
  open,
  onOpenChange,
  rule,
  onEditComplete,
}: RuleEditDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<'critical' | 'high' | 'medium' | 'low' | 'info'>('medium')
  const [category, setCategory] = useState('')
  const [pattern, setPattern] = useState('')
  const [message, setMessage] = useState('')
  const [references, setReferences] = useState('')
  const [enabled, setEnabled] = useState(true)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Populate form when rule changes
  useEffect(() => {
    if (rule) {
      setName(rule.name || '')
      setDescription(rule.description || '')
      setSeverity(rule.severity || 'medium')
      setCategory(rule.category || '')
      setMessage(rule.message || '')
      setEnabled(rule.enabled ?? true)
      // Format pattern as JSON string
      if (rule.pattern) {
        try {
          setPattern(JSON.stringify(rule.pattern, null, 2))
        } catch {
          setPattern(String(rule.pattern))
        }
      } else {
        setPattern('')
      }
      // Format references as one per line
      setReferences(Array.isArray(rule.references) ? rule.references.join('\n') : '')
      setError(null)
    }
  }, [rule])

  const validateForm = (): boolean => {
    if (!name.trim()) {
      setError('Name is required')
      return false
    }
    if (!message.trim()) {
      setError('Message is required')
      return false
    }
    if (!SEVERITY_OPTIONS.includes(severity)) {
      setError('Invalid severity value')
      return false
    }
    if (!category.trim()) {
      setError('Category is required')
      return false
    }
    // Validate pattern JSON if provided
    if (pattern.trim()) {
      try {
        JSON.parse(pattern)
      } catch {
        setError('Pattern must be a valid JSON object')
        return false
      }
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm() || !rule) return

    try {
      setSaving(true)
      setError(null)

      const ruleId = rule.ruleId || rule.id

      // Parse references from textarea (one URL per line)
      const referencesArray = references
        .split('\n')
        .map((r) => r.trim())
        .filter((r) => r.length > 0)

      // Parse pattern JSON if provided
      let parsedPattern = undefined
      if (pattern.trim()) {
        parsedPattern = JSON.parse(pattern)
      }

      const response = await fetch(`/api/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          severity,
          category: category.trim(),
          pattern: parsedPattern,
          message: message.trim(),
          references: referencesArray,
          enabled,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update rule')
      }

      onEditComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Rule</DialogTitle>
          <DialogDescription>
            Modify the rule properties. Changes will be saved immediately.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rule name"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description of what this rule detects"
              rows={2}
            />
          </div>

          {/* Severity and Category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="severity">
                Severity <span className="text-destructive">*</span>
              </Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                <SelectTrigger id="severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">
                Category <span className="text-destructive">*</span>
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1).replace(/-/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pattern */}
          <div className="space-y-2">
            <Label htmlFor="pattern">Pattern (JSON)</Label>
            <Textarea
              id="pattern"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder='{"type": "regex", "pattern": "..."}'
              rows={4}
              className="font-mono text-sm"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">
              Message <span className="text-destructive">*</span>
            </Label>
            <Input
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Alert message shown when rule triggers"
              required
            />
          </div>

          {/* References */}
          <div className="space-y-2">
            <Label htmlFor="references">References</Label>
            <Textarea
              id="references"
              value={references}
              onChange={(e) => setReferences(e.target.value)}
              placeholder="One URL per line (optional)"
              rows={2}
            />
          </div>

          {/* Enabled */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="enabled" className="cursor-pointer">
              Enabled
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
