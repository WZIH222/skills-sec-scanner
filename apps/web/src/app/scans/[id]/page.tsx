'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ResultsSummary } from '@/components/results/ResultsSummary'
import { ResultsFilter } from '@/components/results/ResultsFilter'
import { FindingCard } from '@/components/results/FindingCard'
import { ResultsExport } from '@/components/results/ResultsExport'
import { ChevronRight, Home, Share2, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSeverityLabel, type FilterState, type SeverityCount } from '@/types/scan'

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

interface ScanResult {
  id: string
  fileId: string
  contentHash: string
  filename: string
  score: number
  scannedAt: string
  scanDuration: number
  createdAt: string
  findings: Finding[]
  metadata?: string
  fileCount?: number
  files?: FileScanResult[]
}

interface FileScanResult {
  id: string
  filename: string
  score: number
  findingCount: number
}

interface Finding {
  id: string
  scanId: string
  ruleId: string
  severity: string
  message: string
  line: number
  column: number
  code?: string
  filename?: string  // For folder scans: which file this finding is from
  fileId?: string   // For folder scans: ID of the file scan
}

interface ApiError {
  error: string
}

const ITEMS_PER_PAGE = 20

export default function ScanResultPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const scanId = params.id as string
  const t = useTranslations('ScanDetail')

  const [scan, setScan] = useState<ScanResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterState>({
    severities: ['critical', 'high', 'medium', 'low', 'info'],
    search: ''
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)

  // Fetch scan data
  useEffect(() => {
    async function fetchScan() {
      try {
        setLoading(true)
        const response = await fetch(`/api/scans/${scanId}`)

        if (!response.ok) {
          const errorData: ApiError = await response.json()
          throw new Error(errorData.error || 'Failed to load scan')
        }

        const data: ScanResult = await response.json()
        setScan(data)

        // Initialize filter from URL params
        const severityParam = searchParams.get('severities')
        const searchParam = searchParams.get('search')

        if (severityParam || searchParam) {
          setFilter({
            severities: severityParam ? severityParam.split(',') as any[] : ['critical', 'high', 'medium', 'low', 'info'],
            search: searchParam || ''
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchScan()
  }, [scanId, searchParams])

  // Handle filter changes
  const handleFilterChange = useCallback((newFilter: FilterState) => {
    setFilter(newFilter)
    setCurrentPage(1) // Reset to first page when filter changes
  }, [])

  // Handle severity click from summary
  const handleSeverityClick = useCallback((severity: string) => {
    setFilter(prev => {
      const newSeverities = prev.severities.includes(severity as any)
        ? prev.severities.filter(s => s !== severity)
        : [...prev.severities, severity as any]

      return {
        ...prev,
        severities: newSeverities.length > 0 ? newSeverities : prev.severities
      }
    })
    setCurrentPage(1)
  }, [])

  // Handle share link
  const handleShare = useCallback(async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      // TODO: Show toast notification
      console.log('Link copied to clipboard')
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }, [])

  // Handle new scan
  const handleNewScan = useCallback(() => {
    router.push('/scan')
  }, [router])

  // Filter findings
  const filteredFindings = scan?.findings.filter(finding =>
    filter.severities.includes(finding.severity as any) &&
    (filter.search === '' ||
     finding.ruleId.toLowerCase().includes(filter.search.toLowerCase()) ||
     finding.message.toLowerCase().includes(filter.search.toLowerCase()))
  ) || []

  // Pagination
  const totalPages = Math.ceil(filteredFindings.length / ITEMS_PER_PAGE)
  const paginatedFindings = filteredFindings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Calculate severity counts
  const severityCounts: SeverityCount = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0
  }

  scan?.findings.forEach(finding => {
    const severity = finding.severity as keyof SeverityCount
    if (severity in severityCounts) {
      severityCounts[severity]++
    }
  })

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">{t('loadingScan')}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">{t('errorLoadingScan')}</h2>
              <p className="text-muted-foreground">{error}</p>
              <Button onClick={() => router.push('/scan')}>
                {t('goToScanPage')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No scan found
  if (!scan) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold">{t('scanNotFound')}</h2>
              <p className="text-muted-foreground">
                {t('scanNotFoundDesc')}
              </p>
              <Button onClick={() => router.push('/scan')}>
                {t('goToScanPage')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/scans')}
                className="gap-1"
              >
                <Home className="h-4 w-4" />
                {t('history')}
              </Button>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">{scan.filename}</span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <ResultsExport scanId={scanId} onToast={(msg, type) => setToast({ message: msg, type })} />
              <Button
                variant="outline"
                size="sm"
                onClick={handleShare}
                className="gap-2"
              >
                <Share2 className="h-4 w-4" />
                {t('share')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleNewScan}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('newScan')}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Summary and Filters */}
          <aside className="lg:col-span-1 space-y-6">
            <ResultsSummary
              score={scan.score}
              severityCounts={severityCounts}
              filename={scan.filename}
              scannedAt={scan.scannedAt}
              scanDuration={scan.scanDuration}
              totalFindings={scan.findings.length}
              fileCount={scan.fileCount}
              files={scan.files}
              onSeverityClick={handleSeverityClick}
            />

            <Card>
              <CardContent className="pt-6">
                <ResultsFilter
                  findings={scan.findings}
                  onFilterChange={handleFilterChange}
                />
              </CardContent>
            </Card>
          </aside>

          {/* Main - Findings List */}
          <div className="lg:col-span-3 space-y-4">
            {filteredFindings.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">{t('noFindingsMatchFilters')}</p>
                    <p className="text-sm">
                      {t('adjustFilterCriteria')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4">
                  {paginatedFindings.map(finding => (
                    <FindingCard
                      key={finding.id}
                      finding={{
                        id: finding.id,
                        ruleId: finding.ruleId,
                        severity: finding.severity as any,
                        message: finding.message,
                        location: {
                          line: finding.line,
                          column: finding.column
                        },
                        code: finding.code
                      }}
                      filename={finding.filename || scan.filename}
                      scanId={finding.fileId || scanId}
                      onToast={(msg, type) => setToast({ message: msg, type })}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      {t('previous')}
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="min-w-[2.5rem]"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      {t('next')}
                    </Button>
                  </div>
                )}

                {/* Page info */}
                <div className="text-center text-sm text-muted-foreground">
                  {t('showingFindings', {
                    start: (currentPage - 1) * ITEMS_PER_PAGE + 1,
                    end: Math.min(currentPage * ITEMS_PER_PAGE, filteredFindings.length),
                    total: filteredFindings.length
                  })}
                </div>
              </>
            )}
          </div>
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
