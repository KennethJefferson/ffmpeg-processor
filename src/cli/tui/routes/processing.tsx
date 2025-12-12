/** @jsxImportSource @opentui/solid */
import { Show, onMount } from 'solid-js';
import { useTheme } from '../context/theme.js';
import { useProcessorState } from '../context/processor-state.js';
import { Logo } from '../component/logo.js';
import { FileList } from '../component/file-list.js';
import { formatFileSize } from '../../../core/scanner.js';

/**
 * Format milliseconds to MM:SS or HH:MM:SS
 */
function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

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

      {/* Main processing view - Single Column with Stats Above */}
      <Show when={state.status === 'processing' || state.status === 'completed' || state.status === 'cancelled'}>
        <box flexDirection="column" flexGrow={1} paddingX={2}>
          {/* Stats Row - All panels consolidated horizontally */}
          <box flexDirection="row" gap={2} paddingY={1}>
            {/* Scanner info */}
            <box flexDirection="column">
              <text style={{ fg: state.isScanning ? theme.pink : theme.success }}>
                {state.isScanning ? '◉ Scanning' : '✓ Scan Done'}
              </text>
              <text style={{ fg: theme.textMuted }}>
                Found: <text style={{ fg: theme.text }}>{state.scanStats?.totalFound ?? 0}</text>
                {' '}Skip: <text style={{ fg: theme.warning }}>{skippedCount()}</text>
              </text>
            </box>

            {/* Divider */}
            <text style={{ fg: theme.textMuted }}>│</text>

            {/* Progress info */}
            <box flexDirection="column">
              <text style={{ fg: theme.violet }}>
                Progress: {state.completedCount}/{state.jobs.length} ({state.jobs.length > 0 ? Math.round((state.completedCount / state.jobs.length) * 100) : 0}%)
              </text>
              <box flexDirection="row" gap={1}>
                <text style={{ fg: theme.textMuted }}>
                  Active: <text style={{ fg: theme.primary }}>{state.activeCount}</text>
                </text>
                <text style={{ fg: theme.textMuted }}>
                  Failed: <text style={{ fg: state.failedCount > 0 ? theme.error : theme.textMuted }}>{state.failedCount}</text>
                </text>
              </box>
            </box>

            {/* Divider */}
            <text style={{ fg: theme.textMuted }}>│</text>

            {/* I/O info */}
            <box flexDirection="column">
              <text style={{ fg: theme.teal }}>
                Workers: {state.options.concurrency} {state.options.recursive ? '(recursive)' : ''}
              </text>
              <text style={{ fg: theme.textMuted }}>
                Output: <text style={{ fg: theme.success }}>{formatFileSize(state.totalOutputSize)}</text>
              </text>
            </box>

            {/* Divider */}
            <text style={{ fg: theme.textMuted }}>│</text>

            {/* Performance info */}
            <box flexDirection="column">
              <text style={{ fg: theme.orange }}>
                Time: {formatTime(state.elapsedTime)}
                {state.estimatedRemaining ? ` ETA: ${formatTime(state.estimatedRemaining)}` : ''}
              </text>
              <text style={{ fg: theme.textMuted }}>
                Speed: <text style={{ fg: theme.orange }}>
                  {state.elapsedTime > 1000 && state.completedCount > 0
                    ? (state.completedCount / (state.elapsedTime / 60000)).toFixed(1)
                    : '---'}
                </text>/min
              </text>
            </box>
          </box>

          {/* Separator line */}
          <text style={{ fg: theme.textMuted }}>{'─'.repeat(90)}</text>

          {/* File list */}
          <box paddingY={1}>
            <FileList
              jobs={state.jobs}
              visibleCount={18}
              activeWorkers={state.options.concurrency}
              completedCount={state.completedCount}
              failedCount={state.failedCount}
              totalCount={state.scanStats?.toProcess ?? state.jobs.length}
            />
          </box>

          {/* Completion message */}
          <Show when={state.status === 'completed' && !state.options.dryRun && state.completedCount > 0}>
            <box paddingY={1}>
              <text style={{ fg: theme.success }}>
                Done! Converted {state.completedCount} files ({formatFileSize(state.totalOutputSize)})
              </text>
            </box>
          </Show>

          {/* No files found message */}
          <Show when={state.status === 'completed' && state.completedCount === 0 && state.error}>
            <box paddingY={1}>
              <text style={{ fg: theme.warning }}>{state.error}</text>
            </box>
          </Show>

          {/* Cancellation message */}
          <Show when={state.status === 'cancelled'}>
            <box paddingY={1}>
              <text style={{ fg: theme.warning }}>
                Cancelled. Completed {state.completedCount} of {state.jobs.length} files.
              </text>
            </box>
          </Show>
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
