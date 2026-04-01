/**
 * Scan Repository
 *
 * Repository pattern for scan result storage in PostgreSQL.
 * Provides CRUD operations for scans and their findings.
 */

import { PrismaService } from './client'
import { ScanResult, Finding } from '../../types'

/**
 * Data transfer object for creating a scan
 */
export interface CreateScanDto {
  fileId: string
  contentHash: string
  filename: string
  result: ScanResult
}

/**
 * Scan Repository
 *
 * Manages scan result persistence and retrieval
 */
export class ScanRepository {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new scan with findings
   *
   * @param data - Scan data to create
   */
  async create(data: CreateScanDto): Promise<void> {
    await this.prisma.scan.create({
      data: {
        fileId: data.fileId,
        contentHash: data.contentHash,
        filename: data.filename,
        score: data.result.score,
        scannedAt: new Date(data.result.metadata.scannedAt),
        scanDuration: data.result.metadata.scanDuration,
        metadata: JSON.stringify(data.result.metadata),
        findings: {
          create: data.result.findings.map(finding => ({
            ruleId: finding.ruleId,
            severity: finding.severity,
            message: finding.message,
            line: finding.location.line,
            column: finding.location.column,
            code: finding.code,
          })),
        },
      },
    })
  }

  /**
   * Find scan by file ID
   *
   * @param fileId - Unique file identifier
   * @returns Scan result or null if not found
   */
  async findByFileId(fileId: string): Promise<ScanResult | null> {
    const scan = await this.prisma.scan.findUnique({
      where: { fileId },
      include: { findings: true },
    })

    if (!scan) {
      return null
    }

    return this.mapToScanResult(scan)
  }

  /**
   * Find scan by content hash (for cache lookup)
   *
   * @param contentHash - SHA-256 hash of file content
   * @returns Scan result or null if not found
   */
  async findByContentHash(contentHash: string): Promise<ScanResult | null> {
    const scan = await this.prisma.scan.findFirst({
      where: { contentHash },
      include: { findings: true },
    })

    if (!scan) {
      return null
    }

    return this.mapToScanResult(scan)
  }

  /**
   * Delete old scans by retention date
   *
   * @param retentionDays - Number of days to retain scans
   * @returns Number of scans deleted
   */
  async deleteOldScans(retentionDays: number): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const result = await this.prisma.scan.deleteMany({
      where: {
        scannedAt: {
          lt: cutoffDate,
        },
      },
    })

    return result.count
  }

  /**
   * Map Prisma scan model to ScanResult
   */
  private mapToScanResult(scan: any): ScanResult {
    return {
      id: scan.id,
      fileId: scan.fileId,
      findings: scan.findings.map((f: any) => ({
        ruleId: f.ruleId,
        severity: f.severity as any,
        message: f.message,
        location: {
          line: f.line,
          column: f.column,
        },
        code: f.code || undefined,
      })),
      score: scan.score,
      metadata: scan.metadata ? JSON.parse(scan.metadata) : {
        scannedAt: scan.scannedAt,
        scanDuration: scan.scanDuration,
      },
    }
  }
}
