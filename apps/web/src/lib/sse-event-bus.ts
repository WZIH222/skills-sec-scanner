import { EventEmitter } from 'events'

// Singleton event bus for SSE events
export const eventBus = new EventEmitter()

// Folder progress event type
export interface FolderProgressEvent {
  jobId: string
  fileId: string
  filename: string
  completed: number
  total: number
  score: number
}

// Folder complete event type
export interface FolderCompleteEvent {
  jobId: string
  summary: {
    totalFiles: number
    totalFindings: number
    highestScore: number
  }
}

// Helper function to emit folder progress
export function emitFolderProgress(data: FolderProgressEvent) {
  eventBus.emit('folder:progress', data)
}

// Helper function to emit folder complete
export function emitFolderComplete(data: FolderCompleteEvent) {
  eventBus.emit('folder:complete', data)
}
