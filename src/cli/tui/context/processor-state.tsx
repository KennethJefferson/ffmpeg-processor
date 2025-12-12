/** @jsxImportSource @opentui/solid */
import { createSignal, createEffect, onCleanup } from 'solid-js';
import { createSimpleContext } from './helper.js';
import type { CLIOptions, ConversionJob, QueueState, ScanResult, AppStatus } from '../../../core/types.js';
import { scanDirectory, validateInputDirectory } from '../../../core/scanner.js';
import { validateFFmpeg } from '../../../core/converter.js';
import { createQueue, type ConversionQueue } from '../../../core/queue.js';

export interface ProcessorStateValue {
  // Status
  status: AppStatus;
  error: string | null;

  // CLI options
  options: CLIOptions;

  // Scan results
  scanResult: ScanResult | null;

  // Queue state
  jobs: ConversionJob[];
  activeCount: number;
  completedCount: number;
  failedCount: number;

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
    const [scanResult, setScanResult] = createSignal<ScanResult | null>(null);
    const [jobs, setJobs] = createSignal<ConversionJob[]>([]);
    const [activeCount, setActiveCount] = createSignal(0);
    const [completedCount, setCompletedCount] = createSignal(0);
    const [failedCount, setFailedCount] = createSignal(0);
    const [startTime, setStartTime] = createSignal(0);
    const [elapsedTime, setElapsedTime] = createSignal(0);
    const [totalOutputSize, setTotalOutputSize] = createSignal(0);
    const [isShuttingDown, setIsShuttingDown] = createSignal(false);
    const [ctrlCCount, setCtrlCCount] = createSignal(0);

    let queue: ConversionQueue | null = null;
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
    });

    // Estimate remaining time based on progress
    const estimatedRemaining = () => {
      const completed = completedCount();
      const total = jobs().length;
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

        // Scan for video files
        const result = await scanDirectory(props.options.input, props.options.recursive);
        setScanResult(result);

        if (result.filesToProcess.length === 0) {
          if (result.totalFound === 0) {
            setError('No video files found in the specified directory');
          } else {
            setError(`All ${result.totalFound} video files already have MP3 or SRT companions`);
          }
          setStatus('completed');
          return;
        }

        // If dry run, just show results
        if (props.options.dryRun) {
          setStatus('completed');
          return;
        }

        // Ready to process
        setStatus('idle');
      } catch (err) {
        setError((err as Error).message);
        setStatus('error');
      }
    };

    // Start processing
    const startProcessing = async () => {
      const result = scanResult();
      if (!result || result.filesToProcess.length === 0) return;

      setStatus('processing');
      setStartTime(Date.now());
      setElapsedTime(0);
      setCompletedCount(0);
      setFailedCount(0);
      setTotalOutputSize(0);

      // Create queue with callbacks
      queue = createQueue({
        concurrency: props.options.concurrency,
        verbose: props.options.verbose,
        callbacks: {
          onJobStart: (job) => {
            setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'running' } : j)));
            setActiveCount((prev) => prev + 1);
          },
          onJobProgress: (job, progress) => {
            setJobs((prev) =>
              prev.map((j) => (j.id === job.id ? { ...j, progress, currentTime: job.currentTime } : j))
            );
          },
          onJobComplete: (result) => {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === result.job.id
                  ? {
                      ...j,
                      status: result.success ? 'completed' : 'failed',
                      progress: result.success ? 100 : j.progress,
                      error: result.error,
                      outputSize: result.outputSize,
                    }
                  : j
              )
            );
            setActiveCount((prev) => Math.max(0, prev - 1));

            if (result.success) {
              setCompletedCount((prev) => prev + 1);
              if (result.outputSize) {
                setTotalOutputSize((prev) => prev + result.outputSize!);
              }
            } else {
              setFailedCount((prev) => prev + 1);
            }
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

      // Add files to queue
      const addedJobs = queue.addFiles(result.filesToProcess);
      setJobs(addedJobs);

      // Start processing
      await queue.start();
    };

    // Request shutdown (handles Ctrl+C)
    const requestShutdown = () => {
      const count = ctrlCCount() + 1;
      setCtrlCCount(count);

      if (!queue) {
        process.exit(0);
        return;
      }

      if (count === 1) {
        // First Ctrl+C: graceful shutdown
        setIsShuttingDown(true);
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
      get scanResult() {
        return scanResult();
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
