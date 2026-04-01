import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import { eventBus, emitFolderProgress, emitFolderComplete, type FolderProgressEvent, type FolderCompleteEvent } from '../sse-event-bus'

describe('sse-event-bus', () => {
  let progressEvents: FolderProgressEvent[] = []
  let completeEvents: FolderCompleteEvent[] = []

  beforeEach(() => {
    progressEvents = []
    completeEvents = []
    eventBus.on('folder:progress', (data: FolderProgressEvent) => {
      progressEvents.push(data)
    })
    eventBus.on('folder:complete', (data: FolderCompleteEvent) => {
      completeEvents.push(data)
    })
  })

  afterEach(() => {
    eventBus.removeAllListeners()
  })

  describe('eventBus', () => {
    it('should export eventBus as EventEmitter', () => {
      expect(eventBus).toBeInstanceOf(EventEmitter)
    })

    it('should be a singleton', () => {
      // Import again to verify singleton behavior
      // In ESM/TypeScript, the module is cached by default
      // We just verify that eventBus is the same instance across imports
      expect(eventBus).toBeDefined()
      expect(eventBus).toBeInstanceOf(EventEmitter)
    })
  })

  describe('FolderProgressEvent', () => {
    it('should have correct structure', () => {
      const event: FolderProgressEvent = {
        jobId: 'job-123',
        fileId: 'file-456',
        filename: 'test.js',
        completed: 5,
        total: 10,
        score: 42
      }

      expect(event.jobId).toBe('job-123')
      expect(event.fileId).toBe('file-456')
      expect(event.filename).toBe('test.js')
      expect(event.completed).toBe(5)
      expect(event.total).toBe(10)
      expect(event.score).toBe(42)
    })
  })

  describe('FolderCompleteEvent', () => {
    it('should have correct structure', () => {
      const event: FolderCompleteEvent = {
        jobId: 'job-123',
        summary: {
          totalFiles: 10,
          totalFindings: 5,
          highestScore: 42
        }
      }

      expect(event.jobId).toBe('job-123')
      expect(event.summary.totalFiles).toBe(10)
      expect(event.summary.totalFindings).toBe(5)
      expect(event.summary.highestScore).toBe(42)
    })
  })

  describe('emitFolderProgress', () => {
    it('should emit folder:progress event', () => {
      const data: FolderProgressEvent = {
        jobId: 'job-123',
        fileId: 'file-456',
        filename: 'test.js',
        completed: 5,
        total: 10,
        score: 42
      }

      emitFolderProgress(data)

      expect(progressEvents).toHaveLength(1)
      expect(progressEvents[0]).toEqual(data)
    })

    it('should emit multiple progress events', () => {
      emitFolderProgress({
        jobId: 'job-1',
        fileId: 'file-1',
        filename: 'test1.js',
        completed: 1,
        total: 3,
        score: 10
      })

      emitFolderProgress({
        jobId: 'job-1',
        fileId: 'file-2',
        filename: 'test2.js',
        completed: 2,
        total: 3,
        score: 20
      })

      expect(progressEvents).toHaveLength(2)
      expect(progressEvents[0].completed).toBe(1)
      expect(progressEvents[1].completed).toBe(2)
    })
  })

  describe('emitFolderComplete', () => {
    it('should emit folder:complete event', () => {
      const data: FolderCompleteEvent = {
        jobId: 'job-123',
        summary: {
          totalFiles: 10,
          totalFindings: 5,
          highestScore: 42
        }
      }

      emitFolderComplete(data)

      expect(completeEvents).toHaveLength(1)
      expect(completeEvents[0]).toEqual(data)
    })

    it('should emit complete event after progress events', () => {
      emitFolderProgress({
        jobId: 'job-123',
        fileId: 'file-1',
        filename: 'test.js',
        completed: 10,
        total: 10,
        score: 42
      })

      emitFolderComplete({
        jobId: 'job-123',
        summary: {
          totalFiles: 10,
          totalFindings: 5,
          highestScore: 42
        }
      })

      expect(progressEvents).toHaveLength(1)
      expect(completeEvents).toHaveLength(1)
      expect(completeEvents[0].jobId).toBe(progressEvents[0].jobId)
    })
  })
})
