/**
 * Parallel Conversion Queue
 *
 * Manages parallel FFmpeg conversion jobs with concurrency control.
 * Supports streaming mode (producer-consumer pattern) where files
 * can be added while processing is in progress.
 */

import type {
  ConversionJob,
  ConversionResult,
  QueueSummary,
  QueueState,
  QueueCallbacks,
  FFmpegSettings,
  VideoFile,
} from './types.js';
import { DEFAULT_FFMPEG_SETTINGS } from './types.js';
import { createConversionJob, executeConversion, killJob, killAllJobs } from './converter.js';

/** Extended callbacks for streaming mode */
export interface StreamingQueueCallbacks extends QueueCallbacks {
  /** Called when a new file is added to the queue */
  onFileAdded?: (job: ConversionJob) => void;
  /** Called when scanning completes */
  onScanComplete?: () => void;
}

/**
 * Parallel Conversion Queue
 *
 * Manages a queue of conversion jobs with configurable concurrency.
 * Supports pause/resume, graceful/immediate shutdown, and streaming mode.
 *
 * Streaming Mode:
 * - Call start() to begin processing (can start empty)
 * - Add files with addFile() as they're discovered
 * - Call markScanComplete() when no more files will be added
 * - Queue completes when scan is done AND all jobs are processed
 */
export class ConversionQueue {
  private jobs: ConversionJob[] = [];
  private pendingJobs: ConversionJob[] = [];
  private activeJobs: Map<string, Promise<ConversionResult>> = new Map();
  private completedResults: ConversionResult[] = [];

  private concurrency: number;
  private settings: FFmpegSettings;
  private verbose: boolean;
  private callbacks: StreamingQueueCallbacks;

  private isPaused: boolean = false;
  private isShuttingDown: boolean = false;
  private isImmediateShutdown: boolean = false;
  private startTime: number = 0;

  // Streaming mode support
  private isStarted: boolean = false;
  private isScanComplete: boolean = false;

  private resolveQueue?: (summary: QueueSummary) => void;

  constructor(options: {
    concurrency?: number;
    settings?: FFmpegSettings;
    verbose?: boolean;
    callbacks?: StreamingQueueCallbacks;
  } = {}) {
    this.concurrency = Math.min(Math.max(options.concurrency || 10, 1), 25);
    this.settings = options.settings || DEFAULT_FFMPEG_SETTINGS;
    this.verbose = options.verbose || false;
    this.callbacks = options.callbacks || {};
  }

  /**
   * Add a video file to the queue
   *
   * In streaming mode, this can be called while processing is in progress.
   * The job will be picked up by the next available worker.
   */
  addFile(videoFile: VideoFile): ConversionJob {
    const job = createConversionJob(videoFile);
    this.jobs.push(job);
    this.pendingJobs.push(job);

    // Notify that a file was added
    this.callbacks.onFileAdded?.(job);
    this.notifyStateChange();

    // If queue is already running, trigger processing
    if (this.isStarted && !this.isPaused && !this.isShuttingDown) {
      this.processNext();
    }

    return job;
  }

  /**
   * Add multiple video files to the queue
   */
  addFiles(videoFiles: VideoFile[]): ConversionJob[] {
    return videoFiles.map((file) => this.addFile(file));
  }

  /**
   * Get current queue state
   */
  getState(): QueueState {
    return {
      jobs: [...this.jobs],
      activeJobIds: new Set(this.activeJobs.keys()),
      completedCount: this.completedResults.filter((r) => r.success).length,
      failedCount: this.completedResults.filter((r) => !r.success).length,
      isPaused: this.isPaused,
      isShuttingDown: this.isShuttingDown,
      isImmediateShutdown: this.isImmediateShutdown,
    };
  }

  /**
   * Notify callbacks of state change
   */
  private notifyStateChange(): void {
    this.callbacks.onStateChange?.(this.getState());
  }

  /**
   * Start processing the queue
   *
   * In streaming mode, call this before adding files.
   * Processing will begin as files are added.
   */
  async start(): Promise<QueueSummary> {
    this.startTime = Date.now();
    this.isStarted = true;
    this.isShuttingDown = false;
    this.isImmediateShutdown = false;
    this.isPaused = false;

    return new Promise((resolve) => {
      this.resolveQueue = resolve;
      this.processNext();
    });
  }

  /**
   * Mark that scanning is complete (no more files will be added)
   *
   * In streaming mode, call this when the scanner finishes.
   * The queue will complete once all pending jobs are processed.
   */
  markScanComplete(): void {
    this.isScanComplete = true;
    this.callbacks.onScanComplete?.();
    this.notifyStateChange();

    // Check if we can complete now
    if (this.pendingJobs.length === 0 && this.activeJobs.size === 0) {
      this.complete();
    }
  }

  /**
   * Check if scanning is complete
   */
  isScanningComplete(): boolean {
    return this.isScanComplete;
  }

  /**
   * Process next jobs in the queue
   */
  private async processNext(): Promise<void> {
    // Check for completion (only if scan is complete or shutting down)
    if (this.pendingJobs.length === 0 && this.activeJobs.size === 0) {
      // In streaming mode, only complete if scan is done
      if (this.isScanComplete || this.isShuttingDown) {
        this.complete();
      }
      // Otherwise, wait for more files to be added
      return;
    }

    // Don't start new jobs if shutting down or paused
    if (this.isShuttingDown || this.isPaused) {
      // If immediate shutdown, kill all active jobs
      if (this.isImmediateShutdown && this.activeJobs.size > 0) {
        killAllJobs();
        for (const [jobId] of this.activeJobs) {
          const job = this.jobs.find((j) => j.id === jobId);
          if (job) {
            job.status = 'cancelled';
          }
        }
        this.activeJobs.clear();
        this.complete();
      }
      return;
    }

    // Fill up to concurrency limit
    while (
      this.activeJobs.size < this.concurrency &&
      this.pendingJobs.length > 0 &&
      !this.isShuttingDown &&
      !this.isPaused
    ) {
      const job = this.pendingJobs.shift()!;
      this.startJob(job);
    }
  }

  /**
   * Start a single job
   */
  private startJob(job: ConversionJob): void {
    job.status = 'running';
    job.startTime = Date.now();
    this.callbacks.onJobStart?.(job);
    this.notifyStateChange();

    const jobPromise = executeConversion(
      job,
      (progress, currentTime) => {
        job.progress = progress;
        job.currentTime = currentTime;
        this.callbacks.onJobProgress?.(job, progress);
        this.notifyStateChange();
      },
      this.settings,
      this.verbose
    ).then((result) => {
      this.activeJobs.delete(job.id);
      this.completedResults.push(result);
      this.callbacks.onJobComplete?.(result);
      this.notifyStateChange();

      // Process next job
      this.processNext();

      return result;
    });

    this.activeJobs.set(job.id, jobPromise);
  }

  /**
   * Complete the queue and resolve the promise
   */
  private complete(): void {
    const endTime = Date.now();
    const summary = this.getSummary(endTime);
    this.callbacks.onQueueComplete?.(summary);
    this.resolveQueue?.(summary);
  }

  /**
   * Get queue summary
   */
  private getSummary(endTime: number = Date.now()): QueueSummary {
    const successfulResults = this.completedResults.filter((r) => r.success);
    const failedResults = this.completedResults.filter((r) => !r.success);
    const cancelledJobs = this.jobs.filter((j) => j.status === 'cancelled');

    return {
      total: this.jobs.length,
      completed: successfulResults.length,
      failed: failedResults.length,
      cancelled: cancelledJobs.length + this.pendingJobs.length,
      totalTime: endTime - this.startTime,
      totalOutputSize: successfulResults.reduce((sum, r) => sum + (r.outputSize || 0), 0),
    };
  }

  /**
   * Pause the queue (stop starting new jobs)
   */
  pause(): void {
    this.isPaused = true;
    this.notifyStateChange();
  }

  /**
   * Resume the queue
   */
  resume(): void {
    if (!this.isShuttingDown) {
      this.isPaused = false;
      this.notifyStateChange();
      this.processNext();
    }
  }

  /**
   * Request graceful shutdown
   * Stops adding new jobs but lets active jobs complete
   */
  requestGracefulShutdown(): void {
    this.isShuttingDown = true;
    this.notifyStateChange();

    // Mark pending jobs as cancelled
    for (const job of this.pendingJobs) {
      job.status = 'cancelled';
    }
    this.pendingJobs = [];

    // If no active jobs, complete immediately
    if (this.activeJobs.size === 0) {
      this.complete();
    }
  }

  /**
   * Request immediate shutdown
   * Kills all active FFmpeg processes
   */
  requestImmediateShutdown(): void {
    this.isShuttingDown = true;
    this.isImmediateShutdown = true;
    this.notifyStateChange();

    // Mark pending jobs as cancelled
    for (const job of this.pendingJobs) {
      job.status = 'cancelled';
    }
    this.pendingJobs = [];

    // Kill all active processes
    killAllJobs();

    // Mark active jobs as cancelled
    for (const [jobId] of this.activeJobs) {
      const job = this.jobs.find((j) => j.id === jobId);
      if (job) {
        job.status = 'cancelled';
      }
    }
    this.activeJobs.clear();

    // Complete immediately
    this.complete();
  }

  /**
   * Check if shutdown has been requested
   */
  isShutdownRequested(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Cancel a specific job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) return false;

    if (job.status === 'pending') {
      // Remove from pending queue
      const index = this.pendingJobs.findIndex((j) => j.id === jobId);
      if (index !== -1) {
        this.pendingJobs.splice(index, 1);
      }
      job.status = 'cancelled';
      this.notifyStateChange();
      return true;
    }

    if (job.status === 'running') {
      // Kill the active process
      if (killJob(jobId)) {
        this.activeJobs.delete(jobId);
        job.status = 'cancelled';
        this.notifyStateChange();
        this.processNext();
        return true;
      }
    }

    return false;
  }

  /**
   * Get a specific job by ID
   */
  getJob(jobId: string): ConversionJob | undefined {
    return this.jobs.find((j) => j.id === jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): ConversionJob[] {
    return [...this.jobs];
  }

  /**
   * Get active job count
   */
  getActiveCount(): number {
    return this.activeJobs.size;
  }

  /**
   * Get pending job count
   */
  getPendingCount(): number {
    return this.pendingJobs.length;
  }
}

/**
 * Create a new conversion queue
 */
export function createQueue(options?: {
  concurrency?: number;
  settings?: FFmpegSettings;
  verbose?: boolean;
  callbacks?: StreamingQueueCallbacks;
}): ConversionQueue {
  return new ConversionQueue(options);
}
