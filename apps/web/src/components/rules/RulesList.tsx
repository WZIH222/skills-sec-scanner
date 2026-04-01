'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Download, Upload, Trash2, AlertCircle, Shield, Pencil, Sparkles } from 'lucide-react'
import RuleFilters from './RuleFilters'
import RuleImportDialog from './RuleImportDialog'
import RuleEditDialog from './RuleEditDialog'
import RuleGenerateDialog from './RuleGenerateDialog'

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

interface RulesListProps {
  userId?: string
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 border-red-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 border-yellow-300',
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 border-blue-300',
  info: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-300',
}

export default function RulesList({ userId }: RulesListProps) {
  const router = useRouter()
  const [rules, setRules] = useState<UnifiedRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [severity, setSeverity] = useState('all')
  const [category, setCategory] = useState('all')
  const [status, setStatus] = useState<'all' | 'enabled' | 'disabled'>('all')

  // Selection for bulk export
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set())
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [editingRule, setEditingRule] = useState<UnifiedRule | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/rules')

      if (!response.ok) {
        throw new Error('Failed to fetch rules')
      }

      const data = await response.json()
      setRules(data.rules || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rules')
      setRules([])
    } finally {
      setLoading(false)
    }
  }

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (severity !== 'all' && rule.severity !== severity) return false
      if (category !== 'all' && rule.category !== category) return false
      if (status === 'enabled' && !rule.enabled) return false
      if (status === 'disabled' && rule.enabled) return false
      return true
    })
  }, [rules, severity, category, status])

  const handleSeverityChange = (v: string) => setSeverity(v)
  const handleCategoryChange = (v: string) => setCategory(v)
  const handleStatusChange = (v: 'all' | 'enabled' | 'disabled') => setStatus(v)

  const handleClearFilters = () => {
    setSeverity('all')
    setCategory('all')
    setStatus('all')
  }

  const handleToggleRule = async (ruleId: string, currentEnabled: boolean, isBuiltIn: boolean) => {
    if (isBuiltIn) {
      // Built-in rules don't persist changes
      setSuccessMessage('Built-in rules cannot be disabled')
      setTimeout(() => setSuccessMessage(null), 3000)
      return
    }

    // Optimistic update
    setRules((prev) =>
      prev.map((r) => (r.ruleId === ruleId || r.id === ruleId ? { ...r, enabled: !currentEnabled } : r))
    )

    try {
      const response = await fetch(`/api/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      })

      if (!response.ok) {
        throw new Error('Failed to toggle rule')
      }

      setSuccessMessage('Rule updated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      // Revert on error
      setRules((prev) =>
        prev.map((r) => (r.ruleId === ruleId || r.id === ruleId ? { ...r, enabled: currentEnabled } : r))
      )
      setError(err instanceof Error ? err.message : 'Failed to toggle rule')
    }
  }

  const handleExportRule = async (ruleId: string) => {
    try {
      const response = await fetch(`/api/rules/${ruleId}/export`)

      if (!response.ok) {
        throw new Error('Failed to export rule')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rule-${ruleId}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export rule')
    }
  }

  const handleExportSelected = async () => {
    try {
      // Export each selected rule
      for (const ruleId of selectedRules) {
        await handleExportRule(ruleId)
      }
      setSuccessMessage(`Exported ${selectedRules.size} rules`)
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export rules')
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      setActionLoading(true)
      setError(null)

      const response = await fetch(`/api/rules/${ruleId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete rule')
      }

      setRules((prev) => prev.filter((r) => r.ruleId !== ruleId && r.id !== ruleId))
      setSuccessMessage('Rule deleted successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rule')
    } finally {
      setActionLoading(false)
      setDeletingRuleId(null)
      setShowDeleteDialog(false)
    }
  }

  const toggleRuleSelection = (ruleId: string) => {
    setSelectedRules((prev) => {
      const next = new Set(prev)
      if (next.has(ruleId)) {
        next.delete(ruleId)
      } else {
        next.add(ruleId)
      }
      return next
    })
  }

  const toggleAllSelection = () => {
    if (selectedRules.size === filteredRules.length) {
      setSelectedRules(new Set())
    } else {
      setSelectedRules(new Set(filteredRules.map((r) => r.ruleId || r.id)))
    }
  }

  const handleImportComplete = () => {
    setShowImportDialog(false)
    fetchRules()
    setSuccessMessage('Rules imported successfully')
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleEditComplete = () => {
    fetchRules()
    setShowEditDialog(false)
    setEditingRule(null)
    setSuccessMessage('Rule updated successfully')
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const getRuleId = (rule: UnifiedRule) => rule.ruleId || rule.id

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Detection Rules</CardTitle>
              <CardDescription>
                Manage security detection rules. Built-in rules are read-only.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)}>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate AI Rule
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
              {successMessage}
            </div>
          )}

          {/* Filter Bar */}
          <RuleFilters
            severity={severity}
            category={category}
            status={status}
            onSeverityChange={handleSeverityChange}
            onCategoryChange={handleCategoryChange}
            onStatusChange={handleStatusChange}
            onClearFilters={handleClearFilters}
          />

          {/* Selection Bar */}
          {selectedRules.size > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-muted p-3">
              <span className="text-sm">
                {selectedRules.size} rule{selectedRules.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportSelected}>
                  <Download className="h-4 w-4 mr-2" />
                  Export Selected
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedRules(new Set())}>
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {/* Rules Table */}
          {filteredRules.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Rules Found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {rules.length === 0
                  ? 'No detection rules available.'
                  : 'No rules match your current filters.'}
              </p>
              {rules.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selectedRules.size === filteredRules.length && filteredRules.length > 0}
                        onCheckedChange={toggleAllSelection}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[150px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => {
                    const ruleId = getRuleId(rule)
                    return (
                      <TableRow key={ruleId}>
                        <TableCell>
                          <Checkbox
                            checked={selectedRules.has(ruleId)}
                            onCheckedChange={() => toggleRuleSelection(ruleId)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{rule.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {rule.isBuiltIn ? (
                                <Badge variant="outline" className="text-xs">
                                  Built-in
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">
                                  Custom
                                </Badge>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={SEVERITY_COLORS[rule.severity]}>
                            {rule.severity.charAt(0).toUpperCase() + rule.severity.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {rule.category.charAt(0).toUpperCase() + rule.category.slice(1).replace(/-/g, ' ')}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={() => handleToggleRule(ruleId, rule.enabled, rule.isBuiltIn)}
                            />
                            <span className="text-xs text-muted-foreground">
                              {rule.enabled ? 'On' : 'Off'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExportRule(ruleId)}
                              title="Export rule"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {!rule.isBuiltIn && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingRule(rule)
                                    setShowEditDialog(true)
                                  }}
                                  title="Edit rule"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setDeletingRuleId(ruleId)
                                    setShowDeleteDialog(true)
                                  }}
                                  title="Delete rule"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Summary */}
          {filteredRules.length > 0 && (
            <div className="text-xs text-muted-foreground">
              Showing {filteredRules.length} of {rules.length} rules
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <RuleImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={handleImportComplete}
      />

      {/* Edit Rule Dialog */}
      <RuleEditDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        rule={editingRule}
        onEditComplete={handleEditComplete}
      />

      {/* Generate AI Rule Dialog */}
      <RuleGenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onGenerateComplete={() => {
          fetchRules()
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Rule</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this rule? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingRuleId && handleDeleteRule(deletingRuleId)}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
