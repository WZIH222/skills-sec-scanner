'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { FileUpload } from '@/components/scanner/FileUpload'
import { CodeInput } from '@/components/scanner/CodeInput'
import { ScanProgress } from '@/components/scanner/ScanProgress'
import { FolderProgress } from '@/components/scanner/FolderProgress'
import { createScannerClient } from '@/lib/scanner-client'
import { Shield, LogOut, Upload, Loader2, FolderOpen } from 'lucide-react'
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

/**
 * Scan Page
 *
 * Main scan submission interface with file upload and code paste options
 * Features tab switching, progress tracking, and recent scan history
 */
export default function ScanPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('file')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [codeData, setCodeData] = useState<{ code: string; filename: string } | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [folderJobId, setFolderJobId] = useState<string | null>(null)
  const [totalFiles, setTotalFiles] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [recentScans, setRecentScans] = useState<any[]>([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingFolder, setIsUploadingFolder] = useState(false)
  const [folderUploadProgress, setFolderUploadProgress] = useState(0)
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)
  const t = useTranslations('Scan')

  // Load recent scans from API
  const fetchRecentScans = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '10',
        sort: 'scannedAt_desc',
        status: 'all',
      })
      const response = await fetch(`/api/scans?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setRecentScans(data.scans || [])
      }
    } catch (err) {
      console.error('Failed to fetch recent scans:', err)
    }
  }, [])

  useEffect(() => {
    fetchRecentScans()
  }, [fetchRecentScans])

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/session')
        if (response.ok) {
          setIsAuthenticated(true)
        } else {
          // Not authenticated, redirect to login
          router.push('/login')
        }
      } catch (err) {
        console.error('Auth check failed:', err)
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [router])

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file)
    setCodeData(null)
    setError(null)
  }, [])

  // Handle folder selection (multiple files)
  const handleFilesSelect = useCallback(async (files: FileList) => {
    setError(null)
    const fileArray = Array.from(files)

    try {
      console.log('[handleFilesSelect] Uploading folder with', fileArray.length, 'files')

      // Show loading state immediately
      setIsUploadingFolder(true)
      setFolderUploadProgress(10)

      // Use scanner-client uploadFolder for batch folder upload
      const client = createScannerClient()
      setFolderUploadProgress(30)

      const response = await client.uploadFolder(fileArray)
      setFolderUploadProgress(70)

      console.log('[handleFilesSelect] Folder scan response:', response)

      // Refresh recent scans list
      fetchRecentScans()

      // Check if folder scan is pending (async) or completed
      if (response.status === 'pending') {
        // Show folder progress component
        setFolderJobId(response.jobId)
        setTotalFiles(fileArray.length)
        setToast({
          message: `Folder scan started: ${fileArray.length} files queued for scanning`,
          type: 'info',
        })
      } else if (response.status === 'completed') {
        // Redirect to scan history immediately for completed scans
        setToast({
          message: `Folder scan complete: ${fileArray.length} files scanned`,
          type: 'success',
        })
        router.push('/scans')
      }

      setFolderUploadProgress(100)
    } catch (err) {
      console.error('[handleFilesSelect] Folder upload error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload folder'
      setError(errorMessage)
      setToast({ message: errorMessage, type: 'error' })
    } finally {
      setIsUploadingFolder(false)
      setFolderUploadProgress(0)
    }
  }, [router, fetchRecentScans])

  // Handle code submission
  const handleCodeSubmit = useCallback((code: string, filename: string) => {
    setCodeData({ code, filename })
    setSelectedFile(null)
    setError(null)

    // Auto-submit code
    submitScan({ code, filename })
  }, [])

  // Submit scan
  const submitScan = useCallback(async (submission?: { file?: File; code?: string; filename?: string }) => {
    console.log('[submitScan] Called with:', submission)

    setError(null)

    const fileToSubmit = submission?.file || selectedFile
    const codeToSubmit = submission?.code || codeData?.code
    const filenameToSubmit = submission?.filename || codeData?.filename

    console.log('[submitScan] File:', fileToSubmit?.name, 'Code:', codeToSubmit ? 'yes' : 'no')

    if (!fileToSubmit && !codeToSubmit) {
      setError('Please select a file or enter code to scan')
      return
    }

    try {
      setIsSubmitting(true)
      console.log('[submitScan] Creating scanner client...')
      const client = createScannerClient()

      console.log('[submitScan] Submitting scan to API...')
      const response = await client.submitScan({
        file: fileToSubmit || undefined,
        code: codeToSubmit,
        filename: filenameToSubmit,
      })

      console.log('[submitScan] Response:', response)
      setJobId(response.jobId)
      // Refresh recent scans list
      fetchRecentScans()
    } catch (err) {
      console.error('[submitScan] Error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit scan'
      if (errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        setError('Please log in to scan files')
        // Redirect to login after a short delay
        setTimeout(() => router.push('/login'), 1500)
      } else {
        setError(errorMessage)
      }
    } finally {
      setIsSubmitting(false)
    }
  }, [selectedFile, codeData, fetchRecentScans, router])

  // Handle scan completion
  const handleScanComplete = useCallback((result: any) => {
    // Redirect to results page
    if (result?.id) {
      router.push(`/scans/${result.id}`)
    } else if (jobId) {
      router.push(`/scans/${jobId}`)
    }
  }, [router, jobId])

  // Handle folder scan completion - redirect to scan history
  const handleFolderComplete = useCallback(() => {
    // Clear folder job state and redirect to scan history
    setFolderJobId(null)
    setTotalFiles(0)
    router.push('/scans')
  }, [router])

  // Handle scan error
  const handleScanError = useCallback((errorMessage: string) => {
    setError(errorMessage)
    setJobId(null)
  }, [])

  // Handle logout
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (err) {
      console.error('Logout error:', err)
    }
  }

  const canSubmit = selectedFile !== null || codeData !== null

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-4xl">
          {/* Loading state while checking auth */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent"></div>
                <p className="mt-4 text-muted-foreground">Checking authentication...</p>
              </div>
            </div>
          )}

          {/* Show content only when authenticated */}
          {!isLoading && isAuthenticated && (
            <>
          <div className="mb-8">
            <h2 className="text-3xl font-bold">{t('title')}</h2>
            <p className="text-muted-foreground mt-2">
              {t('subtitle')}
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-6 rounded-md bg-destructive/10 p-4 text-destructive">
              {error}
            </div>
          )}

          {/* Folder Upload Loading State */}
          {isUploadingFolder && (
            <Card className="mb-6 p-6">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="flex items-center space-x-3">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-lg font-medium">Uploading folder...</span>
                </div>
                <Progress value={folderUploadProgress} className="w-full max-w-xs h-2" />
                <p className="text-sm text-muted-foreground">
                  Please wait while your files are being uploaded and queued for scanning
                </p>
              </div>
            </Card>
          )}

          {/* Scan Progress */}
          {jobId ? (
            <ScanProgress
              jobId={jobId}
              getStatus={async (id) => {
                const client = createScannerClient()
                return client.getScanStatus(id)
              }}
              onCancel={() => setJobId(null)}
            />
          ) : folderJobId ? (
            <FolderProgress
              jobId={folderJobId}
              totalFiles={totalFiles}
              onComplete={handleFolderComplete}
            />
          ) : (
            /* Upload Tabs */
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file">{t('uploadFile')}</TabsTrigger>
                <TabsTrigger value="code">{t('pasteCode')}</TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="mt-6">
                <FileUpload
                  onFileSelect={handleFileSelect}
                  onFilesSelect={handleFilesSelect}
                  onError={setError}
                />

                {selectedFile && (
                  <div className="mt-6 flex justify-end">
                    <Button
                      size="lg"
                      disabled={isSubmitting}
                      onClick={() => {
                        console.log('[Button] Scan File clicked, file:', selectedFile.name)
                        submitScan()
                      }}
                      className="w-full sm:w-auto"
                    >
                      {isSubmitting ? (
                        <>
                          <span className="inline-block h-4 w-4 mr-2 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></span>
                          {t('scanning')}
                        </>
                      ) : (
                        t('scanFile')
                      )}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="code" className="mt-6">
                <CodeInput
                  onCodeSubmit={handleCodeSubmit}
                  onError={setError}
                  isSubmitting={isSubmitting}
                />
              </TabsContent>
            </Tabs>
          )}

          {/* Recent Scans */}
          {recentScans.length > 0 && !jobId && (
            <div className="mt-12">
              <h3 className="text-lg font-semibold mb-4">Recent Scans</h3>
              <div className="space-y-2">
                {recentScans.map((scan) => (
                  <button
                    key={scan.id}
                    onClick={() => router.push(`/scans/${scan.id}`)}
                    className="w-full rounded-md border p-4 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{scan.filename}</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(scan.scannedAt).toLocaleString()}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
            </>
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
