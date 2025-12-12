/** @jsxImportSource @opentui/solid */
import { Show } from 'solid-js';
import { useTheme } from '../context/theme.js';

export interface StatsPanelProps {
  /** Number of currently active jobs */
  activeJobs: number;
  /** Number of completed files */
  completed: number;
  /** Number of failed files */
  failed: number;
  /** Number of skipped files */
  skipped?: number;
  /** Whether processing is paused */
  isPaused?: boolean;
  /** Whether shutdown is in progress */
  isShuttingDown?: boolean;
  /** Whether processing is complete */
  isComplete?: boolean;
}

export function StatsPanel(props: StatsPanelProps) {
  const { theme } = useTheme();

  const statusText = () => {
    if (props.isShuttingDown) return 'Stopping...';
    if (props.isPaused) return 'Paused';
    if (props.isComplete) return 'Complete!';
    return 'Processing';
  };

  const statusColor = () => {
    if (props.isShuttingDown) return theme.warning;
    if (props.isPaused) return theme.warning;
    if (props.isComplete) return theme.success;
    return theme.cyan;
  };

  return (
    <box flexDirection="column">
      <text style={{ fg: theme.cyan }}>┌─ Status ───────────┐</text>
      <box flexDirection="row">
        <text style={{ fg: theme.cyan }}>│ </text>
        <text style={{ fg: statusColor() }}>{statusText()}</text>
      </box>
      <box flexDirection="row">
        <text style={{ fg: theme.cyan }}>│ </text>
        <text style={{ fg: theme.textMuted }}>Active: </text>
        <text style={{ fg: theme.primary }}>{props.activeJobs}</text>
      </box>
      <box flexDirection="row">
        <text style={{ fg: theme.cyan }}>│ </text>
        <text style={{ fg: theme.textMuted }}>Done: </text>
        <text style={{ fg: theme.success }}>{props.completed}</text>
        <text style={{ fg: theme.textMuted }}> Fail: </text>
        <text style={{ fg: props.failed > 0 ? theme.error : theme.textMuted }}>{props.failed}</text>
      </box>
      <Show when={props.skipped !== undefined && props.skipped > 0}>
        <box flexDirection="row">
          <text style={{ fg: theme.cyan }}>│ </text>
          <text style={{ fg: theme.textMuted }}>Skip: </text>
          <text style={{ fg: theme.warning }}>{props.skipped}</text>
        </box>
      </Show>
      <text style={{ fg: theme.cyan }}>└────────────────────┘</text>
    </box>
  );
}
