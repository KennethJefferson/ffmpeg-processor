/** @jsxImportSource @opentui/solid */
import { Show, onMount } from 'solid-js';
import { useTheme } from '../context/theme.js';
import { useProcessorState } from '../context/processor-state.js';
import { Logo } from '../component/logo.js';
import { FileList } from '../component/file-list.js';
import { ProgressPanel } from '../component/progress-panel.js';
import { StatsPanel } from '../component/stats-panel.js';
import { IOPanel } from '../component/io-panel.js';
import { PerformancePanel } from '../component/performance-panel.js';
import { ScanPanel } from '../component/scan-panel.js';
import { formatFileSize } from '../../../core/scanner.js';

/**
 * Main processing view - Two column layout
 * Supports streaming mode (scan + process in parallel)
 */
export function ProcessingRoute() {
  const { theme } = useTheme();
  const state = useProcessorState();

  // Initialize on mount
  onMount(async () => {
    await state.initialize();

    // Auto-start processing if not dry run (streaming mode)
    if (state.status === 'idle' && !state.options.dryRun) {
      await state.startProcessing();
    }
  });

  // Calculate scroll offset to keep active jobs visible
  const scrollOffset = () => {
    const jobs = state.jobs;
    if (jobs.length === 0) return 0;

    // Find first running job
    const firstRunningIndex = jobs.findIndex((j) => j.status === 'running');
    if (firstRunningIndex === -1) return 0;

    // Keep a few completed jobs visible above
    return Math.max(0, firstRunningIndex - 2);
  };

  const isComplete = () => state.status === 'completed';
  const skippedCount = () => (state.scanStats?.skippedMP3 ?? 0) + (state.scanStats?.skippedSRT ?? 0);

  return (
    <box flexDirection="column" flexGrow={1}>
      {/* Logo */}
      <Logo />

      {/* Status/Error display */}
      <Show when={state.status === 'error'}>
        <box paddingX={2} paddingY={1}>
          <text style={{ fg: theme.error }}>Error: {state.error}</text>
        </box>
      </Show>

      {/* Initial scanning status (before streaming starts) */}
      <Show when={state.status === 'scanning'}>
        <box paddingX={2} paddingY={1}>
          <text style={{ fg: theme.primary }}>Validating FFmpeg and input directory...</text>
        </box>
      </Show>

      {/* Dry run results */}
      <Show when={state.options.dryRun && state.scanStats}>
        <box flexDirection="column" paddingX={2} paddingY={1}>
          <text style={{ fg: theme.warning }}>DRY RUN - No files will be converted</text>
          <box height={1} />
          <text style={{ fg: theme.text }}>
            Found {state.scanStats!.totalFound} video files:
          </text>
          <text style={{ fg: theme.success }}>
            - {state.scanStats!.toProcess} files to convert
          </text>
          <text style={{ fg: theme.textMuted }}>
            - {state.scanStats!.skippedMP3} skipped (already have MP3)
          </text>
          <text style={{ fg: theme.textMuted }}>
            - {state.scanStats!.skippedSRT} skipped (already have SRT)
          </text>
        </box>
      </Show>

      {/* Main processing view - Two Column Layout */}
      <Show when={state.status === 'processing' || state.status === 'completed' || state.status === 'cancelled'}>
        <box flexDirection="row" flexGrow={1}>
          {/* LEFT COLUMN: File list */}
          <box flexDirection="column" flexGrow={1} paddingX={1}>
            <box paddingY={1}>
              <FileList
                jobs={state.jobs}
                visibleCount={18}
                scrollOffset={scrollOffset()}
                activeWorkers={state.options.concurrency}
                completedCount={state.completedCount}
                failedCount={state.failedCount}
                totalCount={state.scanStats?.toProcess ?? state.jobs.length}
              />
            </box>

            {/* Completion message */}
            <Show when={state.status === 'completed' && !state.options.dryRun && state.completedCount > 0}>
              <box paddingX={1} paddingY={1}>
                <text style={{ fg: theme.success }}>
                  Done! Converted {state.completedCount} files ({formatFileSize(state.totalOutputSize)})
                </text>
              </box>
            </Show>

            {/* No files found message */}
            <Show when={state.status === 'completed' && state.completedCount === 0 && state.error}>
              <box paddingX={1} paddingY={1}>
                <text style={{ fg: theme.warning }}>{state.error}</text>
              </box>
            </Show>

            {/* Cancellation message */}
            <Show when={state.status === 'cancelled'}>
              <box paddingX={1} paddingY={1}>
                <text style={{ fg: theme.warning }}>
                  Cancelled. Completed {state.completedCount} of {state.jobs.length} files.
                </text>
              </box>
            </Show>
          </box>

          {/* RIGHT COLUMN: Info panels */}
          <box flexDirection="column" width={26}>
            {/* Scanner Panel (pink) - shows scanning progress */}
            <ScanPanel
              isScanning={state.isScanning}
              stats={state.scanStats}
              currentDir={state.currentScanDir}
            />

            <box height={1} />

            {/* Progress Panel (violet) */}
            <ProgressPanel
              current={state.completedCount}
              total={state.jobs.length}
              isComplete={isComplete()}
              isShuttingDown={state.isShuttingDown}
            />

            <box height={1} />

            {/* Stats Panel (cyan) */}
            <StatsPanel
              activeJobs={state.activeCount}
              completed={state.completedCount}
              failed={state.failedCount}
              skipped={skippedCount()}
              isShuttingDown={state.isShuttingDown}
              isComplete={isComplete()}
            />

            <box height={1} />

            {/* I/O Panel (teal) */}
            <IOPanel
              inputPath={state.options.input}
              recursive={state.options.recursive}
              concurrency={state.options.concurrency}
              totalOutputSize={state.totalOutputSize}
              totalFound={state.scanStats?.totalFound}
              skippedCount={skippedCount()}
            />

            <box height={1} />

            {/* Performance Panel (orange) */}
            <PerformancePanel
              elapsedTime={state.elapsedTime}
              completedCount={state.completedCount}
              estimatedRemaining={state.estimatedRemaining}
            />

            {/* Push panels to top */}
            <box flexGrow={1} />
          </box>
        </box>
      </Show>

      {/* Footer spacer */}
      <box flexGrow={1} />

      {/* Shutdown notification banner */}
      <Show when={state.isShuttingDown && state.ctrlCCount >= 1}>
        <box paddingX={2} paddingY={1}>
          <text style={{ fg: theme.warning, bold: true }}>
            ⚠ SHUTTING DOWN - Waiting for {state.activeCount} active worker(s) to finish...
          </text>
        </box>
      </Show>

      {/* Footer with keyboard hints */}
      <box paddingX={2} paddingY={1}>
        <Show
          when={state.status === 'processing'}
          fallback={
            <text style={{ fg: theme.textMuted }}>Press Ctrl+C to exit</text>
          }
        >
          <text style={{ fg: state.ctrlCCount > 0 ? theme.warning : theme.textMuted }}>
            {state.ctrlCCount === 0
              ? 'Press Ctrl+C to gracefully stop (let active jobs finish)'
              : 'Press Ctrl+C again to force stop immediately'}
          </text>
        </Show>
      </box>
    </box>
  );
}
