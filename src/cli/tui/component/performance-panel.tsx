/** @jsxImportSource @opentui/solid */
import { useTheme } from '../context/theme.js';

export interface PerformancePanelProps {
  elapsedTime: number;
  completedCount: number;
  estimatedRemaining?: number | null;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function PerformancePanel(props: PerformancePanelProps) {
  const { theme } = useTheme();

  const filesPerMinute = () => {
    if (props.elapsedTime < 1000 || props.completedCount === 0) return '---';
    const minutes = props.elapsedTime / 60000;
    return (props.completedCount / minutes).toFixed(1);
  };

  const avgTimePerFile = () => {
    if (props.completedCount === 0) return '---';
    const avgMs = props.elapsedTime / props.completedCount;
    return formatTime(avgMs);
  };

  return (
    <box flexDirection="column">
      <text style={{ fg: theme.orange }}>┌─ Performance ────────┐</text>
      <box flexDirection="row">
        <text style={{ fg: theme.orange }}>│ </text>
        <text style={{ fg: theme.textMuted }}>Speed: </text>
        <text style={{ fg: theme.orange }}>{filesPerMinute()}</text>
        <text style={{ fg: theme.textMuted }}>/min</text>
      </box>
      <box flexDirection="row">
        <text style={{ fg: theme.orange }}>│ </text>
        <text style={{ fg: theme.textMuted }}>Avg: </text>
        <text style={{ fg: theme.text }}>{avgTimePerFile()}</text>
        <text style={{ fg: theme.textMuted }}>/file</text>
      </box>
      <box flexDirection="row">
        <text style={{ fg: theme.orange }}>│ </text>
        <text style={{ fg: theme.textMuted }}>Time: </text>
        <text style={{ fg: theme.text }}>{formatTime(props.elapsedTime)}</text>
      </box>
      <box flexDirection="row">
        <text style={{ fg: theme.orange }}>│ </text>
        <text style={{ fg: theme.textMuted }}>ETA: </text>
        <text style={{ fg: props.estimatedRemaining ? theme.warning : theme.textMuted }}>
          {props.estimatedRemaining ? formatTime(props.estimatedRemaining) : '---'}
        </text>
      </box>
      <text style={{ fg: theme.orange }}>└──────────────────────┘</text>
    </box>
  );
}
