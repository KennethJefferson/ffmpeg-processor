/** @jsxImportSource @opentui/solid */
import { Show, onMount } from 'solid-js';
import { useTheme } from '../context/theme.js';
import { useProcessorState } from '../context/processor-state.js';
import { Logo } from '../component/logo.js';
import { ProgressBar } from '../component/progress-bar.js';
import { StatsPanel } from '../component/stats-panel.js';
import { FileList } from '../component/file-list.js';
import { formatFileSize } from '../../../core/scanner.js';

/**
 * Main processing view - Single column layout
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
            {'\u2022'} {state.scanStats!.toProcess} files to convert
          </text>
          <text style={{ fg: theme.textMuted }}>
            {'\u2022'} {state.scanStats!.skippedMP3} skipped (already have MP3)
          </text>
          <text style={{ fg: theme.textMuted }}>
            {'\u2022'} {state.scanStats!.skippedSRT} skipped (already have SRT)
          </text>
        </box>
      </Show>

      {/* SHUTDOWN NOTIFICATION - Yellow banner (shows regardless of status) */}
      <Show when={state.ctrlCCount >= 1}>
        <box paddingX={2} paddingY={1} flexDirection="column">
          <text style={{ fg: theme.warning, bold: true }}>
            {'\u26A0'} GRACEFUL SHUTDOWN IN PROGRESS
          </text>
          <Show when={state.activeCount > 0}>
            <text style={{ fg: theme.warning }}>
              Waiting for {state.activeCount} active worker(s) to finish...
            </text>
          </Show>
          <text style={{ fg: theme.warning, bold: true }}>
            Press Ctrl+C again to immediately exit application
          </text>
        </box>
      </Show>

      {/* Main processing view */}
      <Show when={state.status === 'processing' || state.status === 'completed' || state.status === 'cancelled'}>
        {/* Keyboard hint - only show when NOT shutting down */}
        <Show when={state.ctrlCCount === 0}>
          <box paddingX={2}>
            <text style={{ fg: theme.textMuted }}>
              Press Ctrl+C to gracefully stop (let active jobs finish)
            </text>
          </box>
        </Show>

        {/* Overall progress */}
        <box paddingX={2} paddingY={1}>
          <ProgressBar
            current={state.completedCount}
            total={state.totalCount}
            width={50}
            showCount
            variant={isComplete() ? 'success' : 'primary'}
          />
        </box>

        {/* Stats panel */}
        <StatsPanel
          totalFiles={state.totalCount}
          completed={state.completedCount}
          failed={state.failedCount}
          skipped={skippedCount()}
          activeJobs={state.activeCount}
          elapsedTime={state.elapsedTime}
          estimatedRemaining={state.estimatedRemaining ?? undefined}
          totalOutputSize={state.totalOutputSize}
          isPaused={false}
          isShuttingDown={state.isShuttingDown}
          isScanning={state.isScanning}
          totalFound={state.scanStats?.totalFound}
        />

        {/* File list */}
        <box paddingY={1}>
          <FileList jobs={state.jobs} visibleCount={25} />
        </box>

        {/* Completion message */}
        <Show when={state.status === 'completed' && !state.options.dryRun && state.completedCount > 0}>
          <box paddingX={2} paddingY={1}>
            <text style={{ fg: theme.success }}>
              {'\u2713'} Processing complete! Converted {state.completedCount} files ({formatFileSize(state.totalOutputSize)})
            </text>
          </box>
        </Show>

        {/* No files found message */}
        <Show when={state.status === 'completed' && state.completedCount === 0 && state.error}>
          <box paddingX={2} paddingY={1}>
            <text style={{ fg: theme.warning }}>{state.error}</text>
          </box>
        </Show>

        {/* Cancellation message */}
        <Show when={state.status === 'cancelled'}>
          <box paddingX={2} paddingY={1}>
            <text style={{ fg: theme.warning }}>
              Processing cancelled. Completed {state.completedCount} of {state.totalCount} files.
            </text>
          </box>
        </Show>
      </Show>

      {/* Footer spacer */}
      <box flexGrow={1} />

      {/* Footer - only for non-processing states */}
      <Show when={state.status !== 'processing'}>
        <box paddingX={2} paddingY={1}>
          <text style={{ fg: theme.textMuted }}>Press Ctrl+C to exit</text>
        </box>
      </Show>
    </box>
  );
}
