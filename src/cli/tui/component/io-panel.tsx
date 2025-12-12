/** @jsxImportSource @opentui/solid */
import { useTheme } from '../context/theme.js';
import { formatFileSize } from '../../../core/scanner.js';
import { basename } from 'node:path';

export interface IOPanelProps {
  inputPath: string;
  recursive: boolean;
  concurrency: number;
  totalOutputSize: number;
  totalFound?: number;
  skippedCount?: number;
}

export function IOPanel(props: IOPanelProps) {
  const { theme } = useTheme();

  const truncatedPath = () => {
    const path = props.inputPath;
    if (path.length <= 18) return path;
    // Show drive + ... + last folder
    const parts = path.split(/[/\\]/);
    if (parts.length <= 2) return path.substring(0, 15) + '...';
    return parts[0] + '/.../' + parts[parts.length - 1].substring(0, 8);
  };

  return (
    <box flexDirection="column">
      <text style={{ fg: theme.teal }}>┌─ I/O ────────────────┐</text>
      <box flexDirection="row">
        <text style={{ fg: theme.teal }}>│ </text>
        <text style={{ fg: theme.textMuted }}>In: </text>
        <text style={{ fg: theme.text }}>{truncatedPath()}</text>
      </box>
      <box flexDirection="row">
        <text style={{ fg: theme.teal }}>│ </text>
        <text style={{ fg: theme.textMuted }}>Mode: </text>
        <text style={{ fg: theme.text }}>{props.recursive ? 'Recursive' : 'Single'}</text>
      </box>
      <box flexDirection="row">
        <text style={{ fg: theme.teal }}>│ </text>
        <text style={{ fg: theme.textMuted }}>Workers: </text>
        <text style={{ fg: theme.teal }}>{props.concurrency}</text>
      </box>
      <box flexDirection="row">
        <text style={{ fg: theme.teal }}>│ </text>
        <text style={{ fg: theme.textMuted }}>Out: </text>
        <text style={{ fg: theme.success }}>{formatFileSize(props.totalOutputSize)}</text>
      </box>
      <text style={{ fg: theme.teal }}>└──────────────────────┘</text>
    </box>
  );
}
