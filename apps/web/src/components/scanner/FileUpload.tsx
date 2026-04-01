'use client'

import React, { useState, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Upload, File, X, FolderOpen, CheckCircle2, AlertCircle } from 'lucide-react'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  onFilesSelect?: (files: FileList) => void  // For folder upload
  onError?: (error: string) => void
}

/**
 * FileUpload Component
 *
 * Drag-and-drop file upload with click-to-upload fallback
 * Accepts .js, .ts, .json, .md, .py files up to 5MB
 * Supports folder upload with confirmation step
 */
export function FileUpload({ onFileSelect, onFilesSelect, onError }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null)  // For folder confirmation
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  // Allowed file types
  const allowedExtensions = ['.js', '.ts', '.json', '.md', '.py']
  const maxSize = 5 * 1024 * 1024 // 5MB

  const validateFile = (file: File): string | null => {
    // Check file extension
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowedExtensions.includes(fileExtension)) {
      return `Invalid file type. Only ${allowedExtensions.join(', ')} files are allowed`
    }

    // Check file size
    if (file.size > maxSize) {
      return 'File size exceeds 5MB limit'
    }

    return null
  }

  const handleFile = (file: File) => {
    setError(null)
    setPendingFiles(null)  // Clear pending folder selection

    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      onError?.(validationError)
      return
    }

    setSelectedFile(file)
    onFileSelect(file)
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      // Check if it's a directory (first item has path with /)
      const firstItem = files[0]
      const path = (firstItem as any).webkitRelativePath || ''
      if (path.includes('/')) {
        // Directory dropped - handle as folder upload
        handleFolderSelection(files)
      } else {
        // Single file dropped
        handleFile(files[0])
      }
    }
  }, [])

  const handleFolderSelection = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    const validFiles: File[] = []

    // Validate all files silently
    for (const file of fileArray) {
      const validationError = validateFile(file)
      if (!validationError) {
        validFiles.push(file)
      }
    }

    if (validFiles.length === 0) {
      setError('No valid files found in folder (.js, .ts, .json, .md, .py only)')
      onError?.('No valid files found')
      return
    }

    // Show confirmation state instead of immediately uploading
    setPendingFiles(validFiles)
    setSelectedFile(null)
    setError(null)
  }

  const confirmFolderUpload = () => {
    if (pendingFiles && pendingFiles.length > 0 && onFilesSelect) {
      // Convert back to FileList-like object
      const dataTransfer = new DataTransfer()
      pendingFiles.forEach(file => dataTransfer.items.add(file))
      onFilesSelect(dataTransfer.files)
    }
  }

  const cancelFolderUpload = () => {
    setPendingFiles(null)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFolderSelection(files)
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setError(null)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getTotalSize = (files: File[]): string => {
    const total = files.reduce((sum, f) => sum + f.size, 0)
    return formatFileSize(total)
  }

  // Folder upload confirmation view
  if (pendingFiles && pendingFiles.length > 0) {
    return (
      <div className="w-full">
        <Card className="border-primary/50">
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3">
                <FolderOpen className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">Ready to Scan {pendingFiles.length} Files</h3>
                <p className="text-sm text-muted-foreground">
                  Total size: {getTotalSize(pendingFiles)}
                </p>
              </div>
            </div>

            {/* File list preview */}
            <div className="max-h-40 overflow-y-auto rounded-md border bg-muted/50 p-2 space-y-1">
              {pendingFiles.slice(0, 10).map((file, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <File className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate text-muted-foreground">{file.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                </div>
              ))}
              {pendingFiles.length > 10 && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  ... and {pendingFiles.length - 10} more files
                </p>
              )}
            </div>

            {/* File type info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span>All files are valid types (.js, .ts, .json, .md, .py)</span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={cancelFolderUpload}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmFolderUpload}
                className="flex-1"
              >
                <Upload className="mr-2 h-4 w-4" />
                Start Scan
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full">
      <Card
        className={`
          relative border-2 border-dashed transition-colors duration-200
          ${isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50'
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="p-8">
          {!selectedFile ? (
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <div className={`
                rounded-full p-4 transition-colors
                ${isDragging ? 'bg-primary/10' : 'bg-muted'}
              `}>
                <Upload className={`h-8 w-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  Upload your Skill file
                </h3>
                <p className="text-sm text-muted-foreground">
                  Drag and drop your file here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports .js, .ts, .json, .md, .py files up to 5MB
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                id="file-upload"
                className="hidden"
                accept=".js,.ts,.json,.md,.py"
                onChange={handleFileInput}
              />

              <input
                ref={folderInputRef}
                type="file"
                id="folder-upload"
                className="hidden"
                accept=".js,.ts,.json,.md,.py"
                {...({ webkitdirectory: '', directory: '' } as any)}
                onChange={handleFolderInput}
              />

              <div className="flex gap-2 w-full max-w-md">
                <Button asChild variant="outline" className="flex-1">
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Select File
                  </label>
                </Button>

                <Button asChild variant="outline" className="flex-1">
                  <label htmlFor="folder-upload" className="cursor-pointer">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Upload Folder
                  </label>
                </Button>
              </div>

              {/* Drag hint */}
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-medium">Tip:</span> Drag and drop a folder directly for a smoother experience
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="rounded-md bg-muted p-3">
                  <File className="h-6 w-6 text-muted-foreground" />
                </div>

                <div className="space-y-1">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={clearFile}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </Card>

      {error && (
        <div className="mt-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
