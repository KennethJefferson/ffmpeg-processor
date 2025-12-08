/** @jsxImportSource @opentui/solid */
import { Show, onMount, createEffect } from 'solid-js';
import { useTheme } from '../context/theme.js';
import { useProcessorState } from '../context/processor-state.js';
import { Logo } from '../component/logo.js';
import { ProgressBar } from '../component/progress-bar.js';
import { FileList } from '../component/file-list.js';
import { StatsPanel } from '../component/stats-panel.js';
import { formatFileSize } from '../../../core/scanner.js';

/**
 * Main processing view
 */
export function ProcessingRoute() {
  const { theme } = useTheme();
  const state = useProcessorState();

  // Initialize on mount
  onMount(async () => {
    await state.initialize();

    // Auto-start processing if not dry run and files found
    if (state.status === 'idle' && state.scanResult && state.scanResult.filesToProcess.length > 0) {
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

      {/* Scanning status */}
      <Show when={state.status === 'scanning'}>
        <box paddingX={2} paddingY={1}>
          <text style={{ fg: theme.primary }}>Scanning for video files...</text>
        </box>
      </Show>

      {/* Dry run results */}
      <Show when={state.options.dryRun && state.scanResult}>
        <box flexDirection="column" paddingX={2} paddingY={1}>
          <text style={{ fg: theme.warning }}>DRY RUN - No files will be converted</text>
          <box height={1} />
          <text style={{ fg: theme.text }}>
            Found {state.scanResult!.totalFound} video files:
          </text>
          <text style={{ fg: theme.success }}>
            • {state.scanResult!.filesToProcess.length} files to convert
          </text>
          <text style={{ fg: theme.textMuted }}>
            • {state.scanResult!.skippedMP3} skipped (already have MP3)
          </text>
          <text style={{ fg: theme.textMuted }}>
            • {state.scanResult!.skippedSRT} skipped (already have SRT)
          </text>
        </box>
      </Show>

      {/* Processing view */}
      <Show when={state.status === 'processing' || state.status === 'completed' || state.status === 'cancelled'}>
        {/* Overall progress */}
        <box paddingX={2} paddingY={1}>
          <ProgressBar
            current={state.completedCount}
            total={state.jobs.length}
            width={50}
            showCount
            variant={state.status === 'completed' ? 'success' : 'primary'}
          />
        </box>

        {/* Stats panel */}
        <StatsPanel
          totalFiles={state.jobs.length}
          completed={state.completedCount}
          failed={state.failedCount}
          skipped={state.scanResult?.skippedMP3 ?? 0 + (state.scanResult?.skippedSRT ?? 0)}
          activeJobs={state.activeCount}
          elapsedTime={state.elapsedTime}
          estimatedRemaining={state.estimatedRemaining ?? undefined}
          totalOutputSize={state.totalOutputSize}
          isPaused={false}
          isShuttingDown={state.isShuttingDown}
        />

        {/* File list */}
        <box paddingY={1}>
          <FileList jobs={state.jobs} visibleCount={10} scrollOffset={scrollOffset()} />
        </box>

        {/* Completion message */}
        <Show when={state.status === 'completed' && !state.options.dryRun}>
          <box paddingX={2} paddingY={1}>
            <text style={{ fg: theme.success }}>
              ✓ Processing complete! Converted {state.completedCount} files ({formatFileSize(state.totalOutputSize)})
            </text>
          </box>
        </Show>

        {/* Cancellation message */}
        <Show when={state.status === 'cancelled'}>
          <box paddingX={2} paddingY={1}>
            <text style={{ fg: theme.warning }}>
              Processing cancelled. Completed {state.completedCount} of {state.jobs.length} files.
            </text>
          </box>
        </Show>
      </Show>

      {/* Footer with keyboard hints */}
      <box flexGrow={1} />
      <box paddingX={2} paddingY={1}>
        <Show
          when={state.status === 'processing'}
          fallback={
            <text style={{ fg: theme.textMuted }}>Press Ctrl+C to exit</text>
          }
        >
          <text style={{ fg: theme.textMuted }}>
            {state.ctrlCCount === 0
              ? 'Press Ctrl+C to gracefully stop (let active jobs finish)'
              : 'Press Ctrl+C again to force stop immediately'}
          </text>
        </Show>
      </box>
    </box>
  );
}
