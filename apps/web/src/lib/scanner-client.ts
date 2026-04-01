/**
 * Scanner API Client
 *
 * Client wrapper for scan submission and status tracking
 */

export interface ScanSubmission {
  file?: File
  files?: File[] // For folder uploads
  code?: string
  filename?: string
}

export interface ScanResponse {
  jobId: string
  status: string
  message: string
  type?: 'folder' | 'file'
  summary?: {
    fileCount?: number
    totalFindings?: number
    highestScore?: number
  }
}

export interface JobStatus {
  id: string
  state: 'waiting' | 'active' | 'completed' | 'failed'
  progress: number // 0-100
  result: any | null
  failedReason: string | null
  processedOn: number | null
  finishedOn: number | null
}

export interface ScanResult {
  id: string
  filename: string
  status: string
  findings: any[]
  score: number
  createdAt: Date
}

/**
 * Scanner API Client
 */
export class ScannerClient {
  private baseUrl: string

  constructor(getToken?: () => string | null) {
    this.baseUrl = '/api'
    // getToken parameter is now optional since we rely on httpOnly cookies
    // Kept for backward compatibility but no longer used
    getToken
  }

  private getAuthHeaders(): Record<string, string> {
    // Note: httpOnly cookie is sent automatically by browser
    // No need to send Authorization header
    return {
      'Content-Type': 'application/json',
    }
  }

  /**
   * Submit a scan (file upload or code paste)
   */
  async submitScan(submission: ScanSubmission): Promise<ScanResponse> {
    try {
      console.log('[ScannerClient] Submitting scan:', {
        hasFile: !!submission.file,
        hasFiles: !!submission.files,
        hasCode: !!submission.code,
        filename: submission.filename || submission.file?.name,
      })

      // Folder upload
      if (submission.files && submission.files.length > 0) {
        return this.uploadFolder(submission.files)
      }

      // Single file upload
      if (submission.file) {
        const formData = new FormData()
        formData.append('file', submission.file)

        // Note: httpOnly cookie is sent automatically by browser
        const response = await fetch(`${this.baseUrl}/scans`, {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to submit scan')
        }

        return response.json()
      }

      // Code paste
      if (submission.code && submission.filename) {
        const response = await fetch(`${this.baseUrl}/scans`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: submission.code,
            filename: submission.filename,
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to submit scan')
        }

        return response.json()
      }

      throw new Error('Either file, files, or code+filename must be provided')
    } catch (error) {
      console.error('Scan submission error:', error)
      throw error
    }
  }

  /**
   * Upload folder with multiple files
   */
  async uploadFolder(files: File[]): Promise<ScanResponse> {
    try {
      console.log('[ScannerClient] Uploading folder:', { fileCount: files.length })

      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })

      const response = await fetch(`${this.baseUrl}/scans`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to submit folder scan')
      }

      const result = await response.json()
      console.log('[ScannerClient] Folder scan submitted:', { jobId: result.jobId, type: result.type })
      return result
    } catch (error) {
      console.error('Folder upload error:', error)
      throw error
    }
  }

  /**
   * Get job status (polling-based)
   *
   * Note: This returns the same JobStatus interface as expected by useWebSocket
   */
  async getScanStatus(jobId: string): Promise<JobStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/scans/${jobId}/status`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get job status')
      }

      return response.json()
    } catch (error) {
      console.error('Job status error:', error)
      throw error
    }
  }

  /**
   * Get scan result by ID
   */
  async getScanResult(scanId: string): Promise<ScanResult> {
    try {
      const response = await fetch(`${this.baseUrl}/scans/${scanId}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get scan result')
      }

      return response.json()
    } catch (error) {
      console.error('Scan result error:', error)
      throw error
    }
  }

  /**
   * Poll job status until completion
   * Returns the final scan result
   */
  async pollUntilComplete(
    jobId: string,
    onProgress?: (status: JobStatus) => void,
    intervalMs = 2000
  ): Promise<JobStatus> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getScanStatus(jobId)
          onProgress?.(status)

          if (status.state === 'completed') {
            resolve(status)
          } else if (status.state === 'failed') {
            reject(new Error(status.failedReason || 'Scan failed'))
          } else {
            // Continue polling
            setTimeout(poll, intervalMs)
          }
        } catch (error) {
          reject(error)
        }
      }

      poll()
    })
  }
}

/**
 * Create a scanner client instance
 */
export function createScannerClient(getToken?: () => string | null): ScannerClient {
  return new ScannerClient(getToken)
}
