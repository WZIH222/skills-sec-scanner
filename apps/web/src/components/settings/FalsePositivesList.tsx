'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { Loader2, Search, Trash2, AlertCircle } from 'lucide-react'

interface FalsePositive {
  id: string
  ruleId: string
  codeHash: string
  filePath: string
  lineNumber: number
  createdAt: string
}

interface FalsePositivesListProps {
  userId?: string
}

export default function FalsePositivesList({ userId }: FalsePositivesListProps) {
  const [falsePositives, setFalsePositives] = useState<FalsePositive[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showClearAllDialog, setShowClearAllDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchFalsePositives()
  }, [])

  const fetchFalsePositives = async () => {
    try {
      setLoading(true)
      setError(null)

      // Note: This endpoint will be available after plan 03-04 is executed
      const response = await fetch('/api/false-positives')

      if (!response.ok) {
        if (response.status === 404) {
          // Endpoint not implemented yet (plan 03-04 pending)
          setFalsePositives([])
          return
        }
        throw new Error('Failed to fetch false positives')
      }

      const data = await response.json()
      setFalsePositives(data.falsePositives || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load false positives')
      // Set empty array on error to allow UI to render
      setFalsePositives([])
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      setActionLoading(true)
      setError(null)
      setDeletingId(id)

      // Call DELETE /api/false-positives/[id]
      const response = await fetch(`/api/false-positives/${id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to remove false positive')
      }

      // Remove from local state after successful API call
      setFalsePositives(prev => prev.filter(f => f.id !== id))
      setSuccessMessage('False positive removed successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove false positive')
    } finally {
      setActionLoading(false)
      setDeletingId(null)
      setShowDeleteDialog(false)
    }
  }

  const handleClearAll = async () => {
    try {
      setActionLoading(true)
      setError(null)

      // Call DELETE /api/false-positives (bulk delete)
      const response = await fetch('/api/false-positives', {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to clear false positives')
      }

      setFalsePositives([])
      setSuccessMessage('All false positives cleared')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear false positives')
    } finally {
      setActionLoading(false)
      setShowClearAllDialog(false)
    }
  }

  const filteredItems = falsePositives.filter(fp =>
    fp.ruleId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fp.filePath.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
          <CardTitle>False Positive Exclusions</CardTitle>
          <CardDescription>
            Manage findings you've marked as false positives. These will be excluded from future scans.
          </CardDescription>
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

          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by rule or file path..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {falsePositives.length > 0 && (
              <Button
                variant="outline"
                onClick={() => setShowClearAllDialog(true)}
                disabled={actionLoading}
              >
                Clear All
              </Button>
            )}
          </div>

          {falsePositives.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No False Positives</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? 'No false positives match your search.'
                  : 'You haven\'t marked any findings as false positives yet.'}
              </p>
              <p className="text-xs text-muted-foreground">
                Mark findings as false positive from scan results to exclude them from future scans.
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>File Path</TableHead>
                    <TableHead>Line</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((fp) => (
                    <TableRow key={fp.id}>
                      <TableCell>
                        <Badge variant="outline">{fp.ruleId}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[300px] truncate">
                        {fp.filePath}
                      </TableCell>
                      <TableCell>{fp.lineNumber}</TableCell>
                      <TableCell>
                        {new Date(fp.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeletingId(fp.id)
                            setShowDeleteDialog(true)
                          }}
                          disabled={actionLoading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredItems.length === 0 && searchQuery && falsePositives.length > 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No false positives match your search.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove False Positive</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this false positive exclusion? This finding will appear in future scans again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && handleRemove(deletingId)}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                'Remove'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear All Confirmation Dialog */}
      <Dialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All False Positives</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove all {falsePositives.length} false positive exclusions? All findings will appear in future scans again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearAllDialog(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleClearAll}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                'Clear All'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
