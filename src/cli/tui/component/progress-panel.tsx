/** @jsxImportSource @opentui/solid */
import { useTheme } from '../context/theme.js';
import { ProgressBar } from './progress-bar.js';

export interface ProgressPanelProps {
  current: number;
  total: number;
  isComplete?: boolean;
  isShuttingDown?: boolean;
}

export function ProgressPanel(props: ProgressPanelProps) {
  const { theme } = useTheme();

  const percent = () => (props.total > 0 ? Math.round((props.current / props.total) * 100) : 0);

  const borderColor = () => {
    if (props.isShuttingDown) return theme.warning;
    if (props.isComplete) return theme.success;
    return theme.violet;
  };

  return (
    <box flexDirection="column">
      <text style={{ fg: borderColor() }}>┌─ Progress ────────┐</text>
      <box flexDirection="row">
        <text style={{ fg: borderColor() }}>│ </text>
        <ProgressBar current={props.current} total={props.total} width={12} />
        <text style={{ fg: theme.text }}> {percent()}%</text>
      </box>
      <box flexDirection="row">
        <text style={{ fg: borderColor() }}>│ </text>
        <text style={{ fg: theme.textMuted }}>{props.current}/{props.total} files</text>
      </box>
      <text style={{ fg: borderColor() }}>└────────────────────┘</text>
    </box>
  );
}
