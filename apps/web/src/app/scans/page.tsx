'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Loader2,
  AlertCircle,
  Trash2,
  Filter,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ResultsExport } from '@/components/results/ResultsExport'
import { FolderRow } from '@/components/results/FolderRow'
import { AppHeader } from '@/components/layout'
import { useTranslations } from 'next-intl'

// Toast notification component
interface ToastProps {
  message: string
  type: 'info' | 'success' | 'error'
  onClose: () => void
}

function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = type === 'error' ? 'bg-destructive' : type === 'success' ? 'bg-green-600' : 'bg-primary'

  return (
    <div className={`fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-sm`}>
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="hover:opacity-80">
        <span className="text-lg">&times;</span>
      </button>
    </div>
  )
}

interface FileScanListItem {
  id: string
  fileId: string
  filename: string
  score: number
  scannedAt: string
  scanDuration: number
  findingCounts: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }
  totalFindings: number
  type: 'file'
  parentId?: string | null
}

interface FolderScanListItem {
  id: string
  fileId: string
  filename: string
  score: number
  scannedAt: string
  scanDuration: number
  findingCounts: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
  }
  totalFindings: number
  type: 'folder'
  fileCount: number
  highestScore: number
  status?: 'pending' | 'completed' | 'failed'
  files?: FileScanListItem[]
}

type ScanListItem = FolderScanListItem | FileScanListItem

interface ScansResponse {
  scans: ScanListItem[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

interface ApiError {
  error: string
}

type SortOption =
  | 'scannedAt_desc'
  | 'scannedAt_asc'
  | 'score_desc'
  | 'score_asc'
  | 'filename_asc'
type StatusFilter = 'all' | 'completed' | 'failed' | 'pending'

const SCANS_PER_PAGE = 20

export default function ScansHistoryPage() {
  const router = useRouter()
  const [scans, setScans] = useState<ScanListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [sort, setSort] = useState<SortOption>('scannedAt_desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)
  const t = useTranslations('Scans')

  // Fetch scans
  // Note: No need to send Authorization header - server reads httpOnly cookie automatically
  const fetchScans = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: SCANS_PER_PAGE.toString(),
        sort,
        status: statusFilter,
      })

      const response = await fetch(`/api/scans?${params.toString()}`)

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        const errorData: ApiError = await response.json()
        throw new Error(errorData.error || 'Failed to load scans')
      }

      const data: ScansResponse = await response.json()
      // Backend now filters by parentId: null, so we can use the data directly
      setScans(data.scans)
      setTotal(data.pagination.total)
      setTotalPages(data.pagination.totalPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [currentPage, sort, statusFilter, router])

  useEffect(() => {
    fetchScans()
  }, [fetchScans])

  // Handle view file from folder
  const handleViewFile = (fileId: string) => {
    router.push(`/scans/${fileId}`)
  }

  // Handle delete scan
  // Note: No need to send Authorization header - server reads httpOnly cookie automatically
  const handleDelete = async (scanId: string) => {
    try {
      const response = await fetch(`/api/scans/${scanId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete scan')
      }

      // Refresh scans
      fetchScans()
      setDeleteConfirm(null)
      setToast({ message: 'Scan deleted successfully', type: 'success' })
    } catch (err) {
      console.error('Delete error:', err)
      setToast({ message: 'Failed to delete scan', type: 'error' })
    }
  }

  // Get score color
  const getScoreColor = (score: number) => {
    if (score <= 20) return 'text-green-600 dark:text-green-400'
    if (score <= 40) return 'text-blue-600 dark:text-blue-400'
    if (score <= 60) return 'text-yellow-600 dark:text-yellow-400'
    if (score <= 80) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  // Get score badge variant
  const getScoreBadgeVariant = (score: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (score <= 20) return 'secondary'
    if (score <= 40) return 'outline'
    if (score <= 60) return 'outline'
    if (score <= 80) return 'destructive'
    return 'destructive'
  }

  // Format finding counts
  const formatFindingCounts = (counts: ScanListItem['findingCounts']) => {
    const parts: string[] = []
    if (counts.critical > 0) parts.push(`${counts.critical} ${t('critical')}`)
    if (counts.high > 0) parts.push(`${counts.high} ${t('high')}`)
    if (counts.medium > 0) parts.push(`${counts.medium} ${t('medium')}`)
    if (counts.low > 0) parts.push(`${counts.low} ${t('low')}`)
    if (counts.info > 0) parts.push(`${counts.info} Info`)
    return parts.length > 0 ? parts.join(', ') : 'No findings'
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  // Loading state
  if (loading && scans.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading scan history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb + New Scan - moved from header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/scan')}
              className="gap-1"
            >
              <Home className="h-4 w-4" />
              {t('nav.scan') || 'Scan'}
            </Button>
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">{t('history') || 'History'}</span>
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={() => router.push('/scan')}
          >
            {t('scanNow')}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{t('title')}</h1>
              <p className="text-muted-foreground mt-1">
                {total} scan{total !== 1 ? 's' : ''} total
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={sort} onValueChange={(value) => setSort(value as SortOption)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scannedAt_desc">Date (Newest)</SelectItem>
                    <SelectItem value="scannedAt_asc">Date (Oldest)</SelectItem>
                    <SelectItem value="score_desc">Score (Highest)</SelectItem>
                    <SelectItem value="score_asc">Score (Lowest)</SelectItem>
                    <SelectItem value="filename_asc">Filename (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <p>{error}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Scans Table */}
          {scans.length === 0 && !loading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">{t('noScans')}</h3>
                  <p className="text-muted-foreground mb-6">
                    {t('startScanning')}
                  </p>
                  <Button onClick={() => router.push('/scan')}>
                    {t('scanNow')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Date Scanned</TableHead>
                      <TableHead>Risk Score</TableHead>
                      <TableHead>Findings</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scans.map((scan) => {
                      // Render folder scan with FolderRow component
                      if (scan.type === 'folder') {
                        return (
                          <FolderRow
                            key={scan.id}
                            folder={scan}
                            onViewFile={handleViewFile}
                            status={scan.status}
                            onDelete={setDeleteConfirm}
                            isDeleteConfirmed={deleteConfirm === scan.id}
                            onCancelDelete={() => setDeleteConfirm(null)}
                            onConfirmDelete={() => handleDelete(scan.id)}
                          />
                        )
                      }

                      // Render file scan with existing table row
                      return (
                        <TableRow key={scan.id}>
                          <TableCell>
                            <button
                              onClick={() => router.push(`/scans/${scan.id}`)}
                              className="font-medium hover:underline text-left"
                            >
                              {scan.filename}
                            </button>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(scan.scannedAt)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getScoreBadgeVariant(scan.score)}
                              className={cn('font-semibold', getScoreColor(scan.score))}
                            >
                              {scan.score}/100
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatFindingCounts(scan.findingCounts)}
                          </TableCell>
                          <TableCell className="text-right">
                            {deleteConfirm === scan.id ? (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteConfirm(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDelete(scan.id)}
                                >
                                  Delete
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => router.push(`/scans/${scan.id}`)}
                                >
                                  View
                                </Button>
                                <ResultsExport scanId={scan.id} />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteConfirm(scan.id)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * SCANS_PER_PAGE) + 1} to{' '}
                    {Math.min(currentPage * SCANS_PER_PAGE, total)} of {total} scans
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNum: number
                        if (totalPages <= 5) {
                          pageNum = i + 1
                        } else if (currentPage <= 3) {
                          pageNum = i + 1
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i
                        } else {
                          pageNum = currentPage - 2 + i
                        }

                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            disabled={loading}
                            className="min-w-[2.5rem]"
                          >
                            {pageNum}
                          </Button>
                        )
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || loading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </main>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
