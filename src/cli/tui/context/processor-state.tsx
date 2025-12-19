/** @jsxImportSource @opentui/solid */
import { createSignal, createEffect, onCleanup, batch } from 'solid-js';
import { createSimpleContext } from './helper.js';
import type { CLIOptions, ConversionJob, QueueState, AppStatus } from '../../../core/types.js';
import { scanDirectoryStreamParallel, validateInputDirectory, type ScanStats } from '../../../core/scanner.js';
import { validateFFmpeg } from '../../../core/converter.js';
import { createQueue, type ConversionQueue } from '../../../core/queue.js';
import { openConversionDB, type ConversionDB } from '../../../core/db.js';

/** Maximum number of jobs to keep in UI state (memory optimization) */
const MAX_UI_JOBS = 500;

/**
 * Trim old completed/failed jobs from the job list to prevent memory growth.
 * Keeps running and pending jobs, removes oldest completed/failed first.
 */
function trimOldJobs(jobs: ConversionJob[], maxJobs: number): ConversionJob[] {
  if (jobs.length <= maxJobs) return jobs;

  // Separate by status
  const running = jobs.filter((j) => j.status === 'running');
  const pending = jobs.filter((j) => j.status === 'pending');
  const terminal = jobs.filter((j) => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled');

  // Always keep running and pending
  const keep = [...running, ...pending];

  // Calculate how many terminal jobs we can keep
  const terminalSlots = maxJobs - keep.length;

  if (terminalSlots > 0 && terminal.length > 0) {
    // Sort terminal jobs by end time (newest first), keep most recent
    const sortedTerminal = terminal.sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0));
    keep.push(...sortedTerminal.slice(0, terminalSlots));
  }

  return keep;
}

export interface ProcessorStateValue {
  // Status
  status: AppStatus;
  error: string | null;

  // CLI options
  options: CLIOptions;

  // Scanning state (streaming mode)
  isScanning: boolean;
  scanStats: ScanStats | null;
  currentScanDir: string | null;

  // Queue state
  jobs: ConversionJob[];
  activeCount: number;
  completedCount: number;
  failedCount: number;
  totalCount: number;

  // Timing
  startTime: number;
  elapsedTime: number;
  estimatedRemaining: number | null;

  // Output
  totalOutputSize: number;

  // Shutdown state
  isShuttingDown: boolean;
  ctrlCCount: number;
}

export interface ProcessorActions {
  initialize(): Promise<void>;
  startProcessing(): Promise<void>;
  requestShutdown(): void;
}

export const { use: useProcessorState, provider: ProcessorStateProvider } = createSimpleContext({
  name: 'ProcessorState',
  init: (props: { options: CLIOptions }) => {
    // State signals
    const [status, setStatus] = createSignal<AppStatus>('idle');
    const [error, setError] = createSignal<string | null>(null);

    // Scanning state
    const [isScanning, setIsScanning] = createSignal(false);
    const [scanStats, setScanStats] = createSignal<ScanStats | null>(null);
    const [currentScanDir, setCurrentScanDir] = createSignal<string | null>(null);

    // Queue state
    const [jobs, setJobs] = createSignal<ConversionJob[]>([]);
    const [activeCount, setActiveCount] = createSignal(0);
    const [completedCount, setCompletedCount] = createSignal(0);
    const [failedCount, setFailedCount] = createSignal(0);
    const [totalCount, setTotalCount] = createSignal(0);
    const [startTime, setStartTime] = createSignal(0);
    const [elapsedTime, setElapsedTime] = createSignal(0);
    const [totalOutputSize, setTotalOutputSize] = createSignal(0);
    const [isShuttingDown, setIsShuttingDown] = createSignal(false);
    const [ctrlCCount, setCtrlCCount] = createSignal(0);

    let queue: ConversionQueue | null = null;
    let db: ConversionDB | null = null;
    let elapsedTimer: ReturnType<typeof setInterval> | null = null;

    // Update elapsed time every second during processing
    createEffect(() => {
      if (status() === 'processing' && startTime() > 0) {
        elapsedTimer = setInterval(() => {
          setElapsedTime(Date.now() - startTime());
        }, 1000);
      } else if (elapsedTimer) {
        clearInterval(elapsedTimer);
        elapsedTimer = null;
      }
    });

    onCleanup(() => {
      if (elapsedTimer) {
        clearInterval(elapsedTimer);
      }
      // Close database connection
      if (db) {
        db.close();
      }
    });

    // Estimate remaining time based on progress
    const estimatedRemaining = () => {
      const completed = completedCount();
      const total = totalCount();
      const elapsed = elapsedTime();

      if (completed === 0 || total === 0) return null;

      const avgTimePerFile = elapsed / completed;
      const remaining = total - completed;

      return Math.round(avgTimePerFile * remaining);
    };

    // Initialize: validate FFmpeg and input directory
    const initialize = async () => {
      setStatus('scanning');
      setError(null);

      try {
        // Validate FFmpeg
        const ffmpegResult = await validateFFmpeg();
        if (!ffmpegResult.valid) {
          setError(ffmpegResult.error || 'FFmpeg validation failed');
          setStatus('error');
          return;
        }

        // Validate input directory
        const inputResult = await validateInputDirectory(props.options.input);
        if (!inputResult.valid) {
          setError(inputResult.error || 'Input directory validation failed');
          setStatus('error');
          return;
        }

        // If dry run, do a full scan first (batch mode)
        if (props.options.dryRun) {
          const { scanDirectory } = await import('../../../core/scanner.js');
          // Initialize database for status checking (reads only, no writes in dry-run)
          db = openConversionDB(props.options.input);
          const result = await scanDirectory(props.options.input, props.options.recursive, undefined, db);

          if (result.filesToProcess.length === 0) {
            if (result.totalFound === 0) {
              setError('No video files found in the specified directory');
            } else {
              setError(`All ${result.totalFound} video files already have MP3 or SRT companions`);
            }
          }

          setScanStats({
            totalFound: result.totalFound,
            toProcess: result.filesToProcess.length,
            skippedMP3: result.skippedMP3,
            skippedSRT: result.skippedSRT,
            errors: 0,
          });

          setStatus('completed');
          return;
        }

        // Ready to start streaming processing
        setStatus('idle');
      } catch (err) {
        setError((err as Error).message);
        setStatus('error');
      }
    };

    // Start streaming processing (producer-consumer pipeline)
    const startProcessing = async () => {
      setStatus('processing');
      setStartTime(Date.now());
      setElapsedTime(0);
      setCompletedCount(0);
      setFailedCount(0);
      setTotalCount(0);
      setTotalOutputSize(0);
      setIsScanning(true);
      setScanStats({ totalFound: 0, toProcess: 0, skippedMP3: 0, skippedSRT: 0, errors: 0 });

      // Initialize conversion database in input directory
      db = openConversionDB(props.options.input);

      // Create queue with callbacks and database
      queue = createQueue({
        concurrency: props.options.concurrency,
        verbose: props.options.verbose,
        db,
        callbacks: {
          onFileAdded: (job) => {
            // Increment actual total count (never decremented)
            setTotalCount((prev) => prev + 1);
            // Add job to UI list with sliding window to prevent memory growth
            setJobs((prev) => {
              const newJobs = [...prev, job];
              return trimOldJobs(newJobs, MAX_UI_JOBS);
            });
          },
          onJobStart: (job) => {
            batch(() => {
              setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'running' } : j)));
              setActiveCount((prev) => prev + 1);
            });
          },
          onJobProgress: (job, progress) => {
            setJobs((prev) =>
              prev.map((j) => (j.id === job.id ? { ...j, progress, currentTime: job.currentTime } : j))
            );
          },
          onJobComplete: (result) => {
            batch(() => {
              setJobs((prev) => {
                const updated = prev.map((j) =>
                  j.id === result.job.id
                    ? {
                        ...j,
                        status: result.success ? 'completed' : 'failed',
                        progress: result.success ? 100 : j.progress,
                        error: result.error,
                        outputSize: result.outputSize,
                        endTime: Date.now(),
                      }
                    : j
                );
                // Trim old jobs periodically to prevent memory growth
                return trimOldJobs(updated, MAX_UI_JOBS);
              });
              setActiveCount((prev) => Math.max(0, prev - 1));

              if (result.success) {
                setCompletedCount((prev) => prev + 1);
                if (result.outputSize) {
                  setTotalOutputSize((prev) => prev + result.outputSize!);
                }
              } else {
                setFailedCount((prev) => prev + 1);
              }
            });
          },
          onScanComplete: () => {
            setIsScanning(false);
          },
          onQueueComplete: () => {
            setElapsedTime(Date.now() - startTime());
            const wasShuttingDown = isShuttingDown();
            setStatus(wasShuttingDown ? 'cancelled' : 'completed');

            // Exit after graceful shutdown completes
            if (wasShuttingDown) {
              setTimeout(() => process.exit(0), 100);
            }
          },
          onStateChange: (state: QueueState) => {
            setIsShuttingDown(state.isShuttingDown);
          },
        },
      });

      // Start the queue (it will wait for files to be added)
      const queuePromise = queue.start();

      // Run scanner as producer - add files to queue as they're found
      const runScanner = async () => {
        let stats: ScanStats = { totalFound: 0, toProcess: 0, skippedMP3: 0, skippedSRT: 0, errors: 0 };

        try {
          // Use parallel scanner for faster file discovery
          // Directory workers from CLI, 10 file workers per directory
          const parallelOptions = { directoryConcurrency: props.options.scanners, fileConcurrency: 10 };
          for await (const event of scanDirectoryStreamParallel(props.options.input, props.options.recursive, parallelOptions, db!)) {
            // Check if shutdown was requested
            if (isShuttingDown()) {
              break;
            }

            switch (event.type) {
              case 'file':
                // Add file to queue immediately (hot start)
                queue!.addFile(event.file);
                stats.toProcess++;
                stats.totalFound++;
                break;

              case 'skipped':
                stats.totalFound++;
                if (event.reason === 'mp3') stats.skippedMP3++;
                else stats.skippedSRT++;
                break;

              case 'directory':
                setCurrentScanDir(event.path);
                break;

              case 'error':
                stats.errors++;
                break;

              case 'complete':
                stats = event.stats;
                break;
            }

            // Update stats in UI
            setScanStats({ ...stats });
          }
        } finally {
          // Signal that scanning is complete
          setIsScanning(false);
          setCurrentScanDir(null);
          queue!.markScanComplete();
        }

        // Handle case where no files were found
        if (stats.toProcess === 0) {
          if (stats.totalFound === 0) {
            setError('No video files found in the specified directory');
          } else {
            setError(`All ${stats.totalFound} video files already have MP3 or SRT companions`);
          }
        }
      };

      // Run scanner in parallel with processing
      runScanner();

      // Wait for queue to complete
      await queuePromise;
    };

    // Request shutdown (handles Ctrl+C)
    const requestShutdown = () => {
      const count = ctrlCCount() + 1;
      setCtrlCCount(count);
      setIsShuttingDown(true);

      if (!queue) {
        // No queue yet - exit after brief delay so UI can show notification
        if (count >= 2) {
          process.exit(0);
        } else {
          // First Ctrl+C without queue: schedule exit after showing banner
          setTimeout(() => process.exit(0), 500);
        }
        return;
      }

      if (count === 1) {
        // First Ctrl+C: graceful shutdown
        queue.requestGracefulShutdown();
      } else {
        // Second Ctrl+C: immediate shutdown
        queue.requestImmediateShutdown();
        setTimeout(() => process.exit(0), 100);
      }
    };

    return {
      // Getters for state
      get status() {
        return status();
      },
      get error() {
        return error();
      },
      get options() {
        return props.options;
      },
      get isScanning() {
        return isScanning();
      },
      get scanStats() {
        return scanStats();
      },
      get currentScanDir() {
        return currentScanDir();
      },
      get jobs() {
        return jobs();
      },
      get activeCount() {
        return activeCount();
      },
      get completedCount() {
        return completedCount();
      },
      get failedCount() {
        return failedCount();
      },
      get totalCount() {
        return totalCount();
      },
      get startTime() {
        return startTime();
      },
      get elapsedTime() {
        return elapsedTime();
      },
      get estimatedRemaining() {
        return estimatedRemaining();
      },
      get totalOutputSize() {
        return totalOutputSize();
      },
      get isShuttingDown() {
        return isShuttingDown();
      },
      get ctrlCCount() {
        return ctrlCCount();
      },

      // Actions
      initialize,
      startProcessing,
      requestShutdown,
    };
  },
});
