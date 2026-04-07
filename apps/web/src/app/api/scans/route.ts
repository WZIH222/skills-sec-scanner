import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@skills-sec/database'
import { createHash } from 'crypto'
import type { AIProviderConfig, AIProviderType } from '@skills-sec/scanner'
import { PolicyMode } from '@skills-sec/scanner'
import { queueFolderFiles } from '@/lib/folder-queue'
import { getAISettings } from '@/lib/settings'
import { parsePageParams, assertUUID } from '@/lib/api-utils'

/**
 * GET /api/scans
 *
 * Retrieve paginated list of scans for current user
 * Query params: page, limit, sort, status
 */
export async function GET(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    const userId = payload.userId
    assertUUID(userId, 'userId')

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const { page, limit } = parsePageParams(searchParams)
    const sort = searchParams.get('sort') || 'scannedAt_desc'
    const status = searchParams.get('status') || 'all'

    // Parse sort option
    const [sortField, sortDirection] = sort.split('_')
    const validSortFields = ['scannedAt', 'score', 'filename']
    const validSortDirections = ['asc', 'desc']

    if (!validSortFields.includes(sortField) || !validSortDirections.includes(sortDirection)) {
      return NextResponse.json(
        { error: 'Invalid sort parameter' },
        { status: 400 }
      )
    }

    // Build orderBy clause
    const orderBy: any = {}
    orderBy[sortField] = sortDirection

    // Calculate skip for pagination
    const skip = (page - 1) * limit

    // Build where clause for user filtering
    const where: any = {
      OR: [
        { metadata: { contains: `"userId":"${userId}"` } },
        { metadata: { contains: `"userId": "${userId}"` } },
      ],
      parentId: null,  // Only fetch folder scans or standalone file scans
    }

    const [scans, total] = await Promise.all([
      prisma.scan.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          findings: {
            select: {
              severity: true,
            },
          },
          // Include child files for folder scans (for display in folder detail)
          files: {
            include: {
              findings: {
                select: {
                  severity: true,
                },
              },
            },
          },
        },
      }),
      prisma.scan.count({ where }),
    ])

    // Aggregate finding counts by severity for each scan
    const scansWithCounts = scans.map(scan => {
      const findingCounts = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      }

      scan.findings.forEach(finding => {
        const severity = finding.severity.toLowerCase()
        if (severity in findingCounts) {
          findingCounts[severity as keyof typeof findingCounts]++
        }
      })

      // Parse metadata to determine if this is a folder scan
      const metadata = scan.metadata ? JSON.parse(scan.metadata) : {}
      const isFolder = metadata.type === 'folder'

      // Base scan item
      const scanItem: any = {
        id: scan.id,
        fileId: scan.fileId,
        filename: scan.filename,
        score: scan.score,
        scannedAt: scan.scannedAt,
        scanDuration: scan.scanDuration,
        status: scan.status || 'completed',  // Include status field with default
        findingCounts,
        totalFindings: scan.findings.length,
        type: isFolder ? 'folder' : 'file',
      }

      // Add folder-specific fields
      if (isFolder) {
        scanItem.fileCount = metadata.fileCount || 0
        scanItem.totalFindings = metadata.totalFindings || 0
        scanItem.highestScore = scan.score  // Folder score is already the highest

        // Map child files if present
        if (scan.files && scan.files.length > 0) {
          scanItem.files = scan.files.map(childScan => {
            const childFindingCounts = {
              critical: 0,
              high: 0,
              medium: 0,
              low: 0,
              info: 0,
            }

            childScan.findings.forEach(finding => {
              const severity = finding.severity.toLowerCase()
              if (severity in childFindingCounts) {
                childFindingCounts[severity as keyof typeof childFindingCounts]++
              }
            })

            return {
              id: childScan.id,
              filename: childScan.filename,
              score: childScan.score,
              scannedAt: childScan.scannedAt,
              findingCounts: childFindingCounts,
            }
          })
        }
      }

      return scanItem
    })

    return NextResponse.json(
      {
        scans: scansWithCounts,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Scan list retrieval error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/scans
 *
 * Submit a file or code for scanning
 * Accepts FormData with file OR JSON with {code, filename}
 */
export async function POST(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const payload = await verifyToken(token)

    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      )
    }

    const userId = payload.userId

    // Fetch user's organization policy
    let policyMode: PolicyMode = PolicyMode.MODERATE // Default

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          organization: {
            include: { policy: true }
          }
        }
      })

      if (user?.organization?.policy) {
        policyMode = user.organization.policy.mode as PolicyMode
        console.info(`[API] User policy mode: ${policyMode}`)
      } else {
        console.info('[API] No organization policy found, using MODERATE default')
      }
    } catch (error) {
      console.warn('[API] Failed to fetch user policy, using MODERATE default:', error)
    }

    // Detect available AI provider
    // Priority: Database settings > Environment variables > Test mode
    let aiProvider: AIProviderConfig | undefined

    // First, try to get AI config from database
    try {
      const dbSettings = await getAISettings()
      console.info('[API] dbSettings:', JSON.stringify({ providerType: dbSettings.providerType, baseUrl: dbSettings.baseUrl, model: dbSettings.model, hasApiKey: !!dbSettings.apiKey }))
      if (dbSettings.apiKey) {
        aiProvider = {
          type: dbSettings.providerType,
          apiKey: dbSettings.apiKey,
          baseURL: dbSettings.baseUrl,
          model: dbSettings.model,
        }
        console.info(`[API] AI provider from database: type=${dbSettings.providerType}, baseURL=${dbSettings.baseUrl || 'default'}`)
      } else {
        console.warn('[API] dbSettings.apiKey is empty')
      }
    } catch (error) {
      console.warn('[API] Failed to read AI config from database, falling back to environment:', error)
    }

    // Fallback to environment variables if database didn't have config
    if (!aiProvider) {
      if (process.env.AI_API_KEY) {
        const providerType = (process.env.AI_PROVIDER_TYPE || 'openai') as AIProviderType
        aiProvider = {
          type: providerType,
          apiKey: process.env.AI_API_KEY,
          baseURL: process.env.AI_BASE_URL,
          model: process.env.AI_MODEL,
        }
        console.info(`[API] AI provider from .env: type=${providerType}, baseURL=${process.env.AI_BASE_URL || 'default'}`)
      } else if (process.env.OPENAI_API_KEY) {
        aiProvider = { type: 'openai', apiKey: process.env.OPENAI_API_KEY }
      } else if (process.env.ANTHROPIC_API_KEY) {
        aiProvider = { type: 'anthropic', apiKey: process.env.ANTHROPIC_API_KEY }
      }
    }

    // Test mode: use test provider ONLY when no real API key is configured
    if (!aiProvider && process.env.AI_PROVIDER_TYPE === 'test') {
      aiProvider = { type: 'test' }
      console.info('[API] AI provider configured: test (mock mode)')
    }

    if (aiProvider) {
      console.info(`[API] AI provider active: ${aiProvider.type}${aiProvider.baseURL ? ` @ ${aiProvider.baseURL}` : ''}`)
    } else {
      console.warn('[API] No AI provider configured (static analysis only)')
    }

    // Extract content from FormData (file upload) or JSON (code paste)
    const contentType = request.headers.get('content-type') || ''

    // Check for folder upload (multiple files)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const files = formData.getAll('files') as File[]

      // Folder upload detected (multiple files)
      if (files.length > 1) {
        // Extract folder name from first file's webkitRelativePath
        const firstFile = files[0]

        // Try multiple methods to get folder name
        let folderName = 'uploaded-folder'

        // Method 1: webkitRelativePath (works in Chrome/Edge when selecting folder)
        if (firstFile.webkitRelativePath) {
          const pathParts = firstFile.webkitRelativePath.split('/')
          if (pathParts.length > 1) {
            folderName = pathParts[0]
          }
        }
        // Method 2: Extract common prefix from all filenames
        else {
          const allNames = files.map(f => f.name)
          const commonPrefix = allNames.reduce((prefix, name) => {
            let matchLen = 0
            const minLen = Math.min(prefix.length, name.length)
            while (matchLen < minLen && prefix[matchLen] === name[matchLen]) {
              matchLen++
            }
            return prefix.substring(0, matchLen)
          })

          // Find the last slash to get folder name
          const lastSlash = commonPrefix.lastIndexOf('/')
          if (lastSlash > 0) {
            folderName = commonPrefix.substring(0, lastSlash)
          } else if (commonPrefix.length > 0) {
            // Use common prefix as folder name
            folderName = commonPrefix
          }
        }

        console.log(`[API] Folder upload detected: ${folderName} with ${files.length} files`)

        // Validate allowed extensions
        const allowedExtensions = ['.js', '.ts', '.json', '.md', '.py']
        const validFiles: File[] = []
        let totalSize = 0

        for (const file of files) {
          const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
          if (!allowedExtensions.includes(fileExtension)) {
            console.warn(`[API] Skipping ${file.name}: invalid file type`)
            continue
          }
          validFiles.push(file)
          totalSize += file.size
        }

        if (validFiles.length === 0) {
          return NextResponse.json(
            { error: 'No valid files found in folder' },
            { status: 400 }
          )
        }

        // Validate total folder size (<50MB)
        const maxFolderSize = 50 * 1024 * 1024 // 50MB
        if (totalSize > maxFolderSize) {
          return NextResponse.json(
            { error: 'Folder size exceeds 50MB limit' },
            { status: 400 }
          )
        }

        console.log(`[API] Folder validation passed: ${validFiles.length} files, ${(totalSize / 1024 / 1024).toFixed(2)}MB`)

        // Check Redis availability for async processing
        const redisChecker = await import('@/lib/redis-checker')
        redisChecker.resetRedisCache() // Force fresh check
        const redisAvailable = await redisChecker.isRedisAvailable()
        console.log(`[API] Redis available: ${redisAvailable}`)
        const maxSyncSize = 5 // Maximum files for synchronous processing

        // For now, always use sync mode since no worker is running to process async jobs
        // TODO: Start a worker process to enable true async folder scanning
        const useAsyncMode = false // Force sync mode until worker is implemented

        if (!redisAvailable && validFiles.length > maxSyncSize && !useAsyncMode) {
          // Redis not available and folder is too large for sync processing
          return NextResponse.json({
            error: 'Redis configuration required',
            message: `Folder has ${validFiles.length} files. Redis is required for folders with more than ${maxSyncSize} files. Please configure REDIS_URL in .env or upload fewer files.`,
            filesCount: validFiles.length,
              maxSyncFiles: maxSyncSize,
              redisRequired: true,
            }, { status: 400 })
          }

        // Create folder scan record
        const folderScan = await prisma.scan.create({
          data: {
            fileId: `folder-${Date.now()}`,
            contentHash: createHash('sha256').update(folderName).digest('hex'),
            filename: folderName,
            score: 0,
            status: useAsyncMode ? 'pending' : 'scanning',
            scannedAt: new Date(),
            scanDuration: 0,
            metadata: JSON.stringify({
              type: 'folder',
              userId,
              fileCount: validFiles.length,
              totalFiles: validFiles.length,
              completedFiles: 0,
              processingMode: useAsyncMode ? 'async' : 'sync',
            }),
          },
        })

        console.log(`[API] Folder scan created: ${folderScan.id} (mode: ${useAsyncMode ? 'async' : 'sync'})`)

        if (useAsyncMode) {
          // ASYNC MODE: Return immediately with jobId, process files in background
          const response = NextResponse.json({
            jobId: folderScan.id,
            status: 'pending',
            type: 'folder',
            message: `Folder scan started: ${validFiles.length} files queued for scanning`,
            processingMode: 'async',
          }, { status: 200 })

          // Queue files in background (fire-and-forget)
          queueFolderFiles({
            folderScanId: folderScan.id,
            files: validFiles,
            userId,
            aiEnabled: !!aiProvider,
            policyMode,
          }).catch(error => {
            console.error('[API] Failed to queue folder files:', error)
            // Update folder status to failed
            prisma.scan.update({
              where: { id: folderScan.id },
              data: {
                status: 'failed',
                metadata: JSON.stringify({
                  type: 'folder',
                  userId,
                  fileCount: validFiles.length,
                  error: error.message || 'Failed to queue files',
                }),
              },
            }).catch(console.error)
          })

          return response
        } else {
          // SYNC MODE: Process files synchronously (fallback when Redis unavailable)
          console.log(`[API] Processing ${validFiles.length} files in sync mode (Redis unavailable)`)
          return await processFolderSync(folderScan, validFiles, aiProvider, policyMode, userId)
        }
      }

      // Single file upload
      const file = formData.get('file') as File
      let content: string
      let filename: string

      if (!file) {
        return NextResponse.json(
          { error: 'No file provided' },
          { status: 400 }
        )
      }

      // Validate file size (<5MB)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: 'File size exceeds 5MB limit' },
          { status: 400 }
        )
      }

      // Validate file type - support .md for Skills files
      const allowedExtensions = ['.js', '.ts', '.json', '.md', '.py']
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!allowedExtensions.includes(fileExtension)) {
        return NextResponse.json(
          { error: 'Invalid file type. Only .js, .ts, .json, .md, and .py files are allowed' },
          { status: 400 }
        )
      }

      content = await file.text()
      filename = file.name

      // Create content hash for caching
      const contentHash = createHash('sha256').update(content).digest('hex')

      // Use synchronous scan (no Redis required)
      console.log('[API] Starting synchronous scan for:', filename)

      // Import scanner and create instance
      const { createScanner } = await import('@skills-sec/scanner')
      console.info('[API] Creating scanner with aiProvider:', aiProvider ? `type=${aiProvider.type}, baseURL=${aiProvider.baseURL}, model=${aiProvider.model}, hasApiKey=${!!aiProvider.apiKey}` : 'null')
      const scanner = await createScanner({
        databaseUrl: process.env.DATABASE_URL,
        ...(aiProvider && { aiProvider }),
        filename,
      })

      // Scan the content (include userId for authorization)
      const scanResult = await scanner.scan(content, filename, {
        userId,
        aiEnabled: !!aiProvider,  // Enable AI if provider configured
        policyMode,  // Pass policy mode to scanner
      })
      const jobId = scanResult.fileId || '' // Use the fileId from scan result

      const aiUsed = !!aiProvider

      // Log policy enforcement result
      if (scanResult.policyResult) {
        const { blockDecision, warnings } = scanResult.policyResult
        console.log(`[API] Policy enforcement: ${blockDecision}`, warnings.length > 0 ? `Warnings: ${warnings.join(', ')}` : '')
      }

      console.log(`[API] Scan complete, job ID: ${jobId}, score: ${scanResult.score}, AI: ${aiUsed ? 'enabled' : 'disabled'}`)

      return NextResponse.json(
        {
          jobId,
          status: scanResult.policyResult?.blockDecision === 'BLOCK' ? 'blocked' : 'completed',
          message: scanResult.policyResult?.blockDecision === 'BLOCK'
            ? 'Scan blocked by security policy'
            : 'Scan completed successfully',
          policyResult: scanResult.policyResult ? {
            mode: scanResult.policyResult.mode,
            blockDecision: scanResult.policyResult.blockDecision,
            warnings: scanResult.policyResult.warnings,
          } : undefined,
        },
        { status: 200 }
      )
    }

    // Handle code paste
    const body = await request.json()
    let content: string
    let filename: string

    if (!body.code || !body.filename) {
      return NextResponse.json(
        { error: 'Missing required fields: code, filename' },
        { status: 400 }
      )
    }

    content = body.code
    filename = body.filename

    // Validate filename extension - support .md and .py for Skills files
    const allowedExtensions = ['.js', '.ts', '.json', '.md', '.py']
    const fileExtension = '.' + filename.split('.').pop()?.toLowerCase()
    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only .js, .ts, .json, .md, and .py files are allowed' },
        { status: 400 }
      )
    }

    // Validate content length (<50,000 chars)
    if (content.length > 50000) {
      return NextResponse.json(
        { error: 'Code exceeds 50,000 character limit' },
        { status: 400 }
      )
    }

    // Create content hash for caching
    const contentHash = createHash('sha256').update(content).digest('hex')

    // Use synchronous scan (no Redis required)
    console.log('[API] Starting synchronous scan for:', filename)

    // Import scanner and create instance
    const { createScanner } = await import('@skills-sec/scanner')
    const scanner = await createScanner({
      databaseUrl: process.env.DATABASE_URL,
      ...(aiProvider && { aiProvider }),
      filename,
    })

    // Scan the content (include userId for authorization)
    const scanResult = await scanner.scan(content, filename, {
      userId,
      aiEnabled: !!aiProvider,  // Enable AI if provider configured
      policyMode,  // Pass policy mode to scanner
    })
    const jobId = scanResult.fileId || '' // Use the fileId from scan result

    const aiUsed = !!aiProvider

    // Log policy enforcement result
    if (scanResult.policyResult) {
      const { blockDecision, warnings } = scanResult.policyResult
      console.log(`[API] Policy enforcement: ${blockDecision}`, warnings.length > 0 ? `Warnings: ${warnings.join(', ')}` : '')
    }

    console.log(`[API] Scan complete, job ID: ${jobId}, score: ${scanResult.score}, AI: ${aiUsed ? 'enabled' : 'disabled'}`)

    return NextResponse.json(
      {
        jobId,
        status: scanResult.policyResult?.blockDecision === 'BLOCK' ? 'blocked' : 'completed',
        message: scanResult.policyResult?.blockDecision === 'BLOCK'
          ? 'Scan blocked by security policy'
          : 'Scan completed successfully',
        policyResult: scanResult.policyResult ? {
          mode: scanResult.policyResult.mode,
          blockDecision: scanResult.policyResult.blockDecision,
          warnings: scanResult.policyResult.warnings,
        } : undefined,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Scan submission error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Process folder scan synchronously (fallback when Redis unavailable)
 *
 * @param folderScan - The folder scan record
 * @param files - Array of files to scan
 * @param aiProvider - AI provider configuration
 * @param policyMode - Security policy mode
 * @param userId - User ID for authorization
 * @returns NextResponse with scan results
 */
async function processFolderSync(
  folderScan: any,
  files: File[],
  aiProvider: AIProviderConfig | undefined,
  policyMode: PolicyMode,
  userId: string
): Promise<NextResponse> {
  // Lazy import to avoid issues at module load time
  const { spawn } = await import('child_process')
  const { dirname, join } = await import('path')
  const { fileURLToPath } = await import('url')

  // Get the scanner dist path for the worker
  // Path from apps/web/src/app/api/scans -> monorepo root -> packages/scanner/dist/workers/
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const workerPath = join(__dirname, '..', '..', '..', '..', '..', '..', 'packages', 'scanner', 'dist', 'workers', 'scan-worker.js')

  try {
    const startTime = Date.now()
    const childScanResults: any[] = []

    // Process files sequentially using child processes
    // Each file gets its own Node.js process with its own heap
    // This completely isolates memory between scans
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const content = await file.text()
      const contentHash = createHash('sha256').update(content).digest('hex')
      const fileStartTime = Date.now()
      const fileId = `${folderScan.id}-${file.name}`

      console.log(`[SyncFolder] Spawning worker for ${file.name}...`)

      // Run scan in child process with isolated memory
      const result = await new Promise<any>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          [workerPath],
          {
            env: {
              ...process.env,
              NODE_OPTIONS: '--max-old-space-size=4096',
            },
            stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
          }
        )

        const timeout = setTimeout(() => {
          child.kill('SIGKILL')
          reject(new Error(`Scan timeout for ${file.name}`))
        }, 120000)

        child.on('message', (msg: any) => {
          if (msg.type === 'result') {
            clearTimeout(timeout)
            if (msg.success) {
              resolve(msg.result)
            } else {
              reject(new Error(msg.error))
            }
            child.disconnect()
          }
        })

        child.on('error', (err: any) => {
          clearTimeout(timeout)
          reject(err)
        })

        child.on('exit', (code: any) => {
          clearTimeout(timeout)
          if (code !== 0 && code !== null) {
            reject(new Error(`Worker exited with code ${code}`))
          }
        })

        // Send scan request to worker
        child.send({
          type: 'scan',
          id: fileId,
          content,
          filename: file.name,
          userId,
          aiEnabled: false,
          policyMode,
          databaseUrl: process.env.DATABASE_URL,
          aiProvider,
        })
      })

      const fileDuration = Date.now() - fileStartTime

      // Create child scan record in database
      const childScan = await prisma.scan.create({
        data: {
          fileId,
          contentHash,
          filename: file.name,
          score: result.score,
          status: 'completed',
          scannedAt: new Date(),
          scanDuration: fileDuration,
          parentId: folderScan.id,
          findings: {
            create: (result.findings || []).map((f: any) => ({
              ruleId: f.ruleId,
              severity: f.severity,
              message: f.message,
              line: f.location?.line || 0,
              column: f.location?.column || 0,
              code: f.code,
            })),
          },
          metadata: JSON.stringify({
            type: 'file',
            userId,
          }),
        },
      })

      childScanResults.push({
        id: childScan.id,
        score: result.score,
        findingCount: result.findings?.length || 0,
      })

      console.log(`[SyncFolder] Scanned ${file.name}: score ${result.score}, ${result.findings?.length || 0} findings`)
    }

    const duration = Date.now() - startTime

    // Aggregate results
    const totalFindings = childScanResults.reduce((sum, r) => sum + r.findingCount, 0)
    const highestScore = childScanResults.reduce((max, r) => Math.max(max, r.score), 0)

    // Update folder scan with aggregated results
    await prisma.scan.update({
      where: { id: folderScan.id },
      data: {
        score: highestScore,
        status: 'completed',
        scanDuration: duration,
        metadata: JSON.stringify({
          type: 'folder',
          userId,
          fileCount: files.length,
          totalFindings,
          highestScore,
          processingMode: 'sync',
        }),
      },
    })

    console.log(`[SyncFolder] Complete: ${files.length} files, ${duration}ms, ${totalFindings} findings`)

    return NextResponse.json({
      jobId: folderScan.id,
      status: 'completed',
      type: 'folder',
      message: `Folder scan complete: ${files.length} files scanned`,
      processingMode: 'sync',
      summary: {
        fileCount: files.length,
        totalFindings,
        highestScore,
        duration,
      },
    }, { status: 200 })

  } catch (error) {
    console.error('[SyncFolder] Error:', error)

    // Update folder status to failed
    await prisma.scan.update({
      where: { id: folderScan.id },
      data: {
        status: 'failed',
        metadata: JSON.stringify({
          type: 'folder',
          userId,
          fileCount: files.length,
          error: error instanceof Error ? error.message : 'Unknown error',
          processingMode: 'sync',
        }),
      },
    }).catch(console.error)

    return NextResponse.json({
      error: 'Folder scan failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      jobId: folderScan.id,
      status: 'failed',
    }, { status: 500 })
  }
}
