'use client'

import React from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, File, Loader2, CheckCircle2, XCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface FindingCounts {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

interface FileScanItem {
  id: string
  filename: string
  score: number
  scannedAt: string
  findingCounts: FindingCounts
}

interface FolderScanListItem {
  id: string
  filename: string
  fileCount: number
  totalFindings: number
  highestScore: number
  scannedAt: string
  status?: 'pending' | 'completed' | 'failed'
  files?: FileScanItem[]
}

interface FolderRowProps {
  folder: FolderScanListItem
  onViewFile: (fileId: string) => void
  status?: 'pending' | 'completed' | 'failed'
  onDelete?: (folderId: string) => void
  isDeleteConfirmed?: boolean
  onCancelDelete?: () => void
  onConfirmDelete?: () => void
}

/**
 * FolderRow Component
 *
 * Displays folder scan summary (file count, findings, severity)
 * Click View to see folder details with individual files
 * Displays status indicator for pending/completed/failed folder scans
 */
export function FolderRow({
  folder,
  onViewFile,
  status,
  onDelete,
  isDeleteConfirmed,
  onCancelDelete,
  onConfirmDelete
}: FolderRowProps) {

  // Get status display
  const getStatusDisplay = () => {
    if (!status || status === 'completed') {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          <span className="text-xs">Complete</span>
        </Badge>
      )
    }
    if (status === 'pending') {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-xs">Scanning...</span>
        </Badge>
      )
    }
    if (status === 'failed') {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          <span className="text-xs">Failed</span>
        </Badge>
      )
    }
    return null
  }
  // Get score color for folder badge
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

  // Format finding counts for child files
  const formatFindingCounts = (counts: FindingCounts) => {
    const parts: string[] = []
    if (counts.critical > 0) parts.push(`${counts.critical} C`)
    if (counts.high > 0) parts.push(`${counts.high} H`)
    if (counts.medium > 0) parts.push(`${counts.medium} M`)
    if (counts.low > 0) parts.push(`${counts.low} L`)
    if (counts.info > 0) parts.push(`${counts.info} I`)
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

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-blue-500" />
          <span className="font-medium">{folder.filename}</span>
          {getStatusDisplay()}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">
        {formatDate(folder.scannedAt)}
      </TableCell>
      <TableCell>
        <Badge
          variant={getScoreBadgeVariant(folder.highestScore)}
          className={cn('font-semibold', getScoreColor(folder.highestScore))}
        >
          {folder.highestScore}/100
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        <Badge variant={folder.totalFindings > 0 ? 'destructive' : 'secondary'}>
          {folder.totalFindings} {folder.totalFindings === 1 ? 'finding' : 'findings'}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        {isDeleteConfirmed ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancelDelete}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onConfirmDelete}
            >
              Delete
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onViewFile(folder.id)}
            >
              View
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(folder.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  )
}
