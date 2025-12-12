/** @jsxImportSource @opentui/solid */
import { Show } from 'solid-js';
import { useTheme } from '../context/theme.js';
import { formatFileSize } from '../../../core/scanner.js';

export interface StatsPanelProps {
  /** Total number of files to process */
  totalFiles: number;
  /** Number of completed files */
  completed: number;
  /** Number of failed files */
  failed: number;
  /** Number of skipped files */
  skipped: number;
  /** Number of currently active jobs */
  activeJobs: number;
  /** Elapsed time in milliseconds */
  elapsedTime: number;
  /** Estimated remaining time in milliseconds */
  estimatedRemaining?: number;
  /** Total output file size in bytes */
  totalOutputSize: number;
  /** Whether processing is paused */
  isPaused?: boolean;
  /** Whether shutdown is in progress */
  isShuttingDown?: boolean;
  /** Whether scanning is in progress */
  isScanning?: boolean;
  /** Total files found by scanner */
  totalFound?: number;
}

/**
 * Format milliseconds as HH:MM:SS
 */
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Statistics panel showing processing status
 */
export function StatsPanel(props: StatsPanelProps) {
  const { theme } = useTheme();

  const progressPercent = () =>
    props.totalFiles > 0 ? Math.round((props.completed / props.totalFiles) * 100) : 0;

  const statusText = () => {
    if (props.isShuttingDown) return 'Shutting down...';
    if (props.isPaused) return 'Paused';
    if (props.completed === props.totalFiles && props.totalFiles > 0) return 'Complete!';
    if (props.isScanning) return 'Scanning & Processing';
    return 'Processing';
  };

  const statusColor = () => {
    if (props.isShuttingDown) return theme.warning;
    if (props.isPaused) return theme.warning;
    if (props.completed === props.totalFiles && props.totalFiles > 0) return theme.success;
    return theme.primary;
  };

  return (
    <box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Top border */}
      <text style={{ fg: theme.border }}>{'┌─ Statistics ────────────────────────────────────────────────────────┐'}</text>

      {/* Status line */}
      <box flexDirection="row">
        <text style={{ fg: theme.border }}>│ </text>
        <text style={{ fg: theme.text }}>Status: </text>
        <text style={{ fg: statusColor() }}>{statusText()}</text>
        <text style={{ fg: theme.textMuted }}> │ </text>
        <text style={{ fg: theme.text }}>Progress: </text>
        <text style={{ fg: theme.primary }}>{props.completed}/{props.totalFiles}</text>
        <text style={{ fg: theme.textMuted }}> ({progressPercent()}%)</text>
        <Show when={props.isScanning}>
          <text style={{ fg: theme.textMuted }}> │ </text>
          <text style={{ fg: theme.pink }}>Scanning...</text>
          <text style={{ fg: theme.textMuted }}> Found: {props.totalFound ?? 0}</text>
        </Show>
      </box>

      {/* Active/Completed/Failed line */}
      <box flexDirection="row">
        <text style={{ fg: theme.border }}>│ </text>
        <text style={{ fg: theme.text }}>Active: </text>
        <text style={{ fg: theme.primary }}>{props.activeJobs}</text>
        <text style={{ fg: theme.textMuted }}> │ </text>
        <text style={{ fg: theme.text }}>Completed: </text>
        <text style={{ fg: theme.success }}>{props.completed}</text>
        <text style={{ fg: theme.textMuted }}> │ </text>
        <text style={{ fg: theme.text }}>Failed: </text>
        <text style={{ fg: props.failed > 0 ? theme.error : theme.textMuted }}>{props.failed}</text>
        <Show when={props.skipped > 0}>
          <text style={{ fg: theme.textMuted }}> │ </text>
          <text style={{ fg: theme.text }}>Skipped: </text>
          <text style={{ fg: theme.warning }}>{props.skipped}</text>
        </Show>
      </box>

      {/* Time line */}
      <box flexDirection="row">
        <text style={{ fg: theme.border }}>│ </text>
        <text style={{ fg: theme.text }}>Elapsed: </text>
        <text style={{ fg: theme.textMuted }}>{formatTime(props.elapsedTime)}</text>
        <Show when={props.estimatedRemaining !== undefined && props.estimatedRemaining > 0}>
          <text style={{ fg: theme.textMuted }}> │ </text>
          <text style={{ fg: theme.text }}>ETA: </text>
          <text style={{ fg: theme.textMuted }}>{formatTime(props.estimatedRemaining!)}</text>
        </Show>
        <text style={{ fg: theme.textMuted }}> │ </text>
        <text style={{ fg: theme.text }}>Output: </text>
        <text style={{ fg: theme.secondary }}>{formatFileSize(props.totalOutputSize)}</text>
      </box>

      {/* Bottom border */}
      <text style={{ fg: theme.border }}>{'└─────────────────────────────────────────────────────────────────────┘'}</text>
    </box>
  );
}
