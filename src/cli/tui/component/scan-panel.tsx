/** @jsxImportSource @opentui/solid */
import { Show } from 'solid-js';
import { useTheme } from '../context/theme.js';
import type { ScanStats } from '../../../core/scanner.js';
import { basename } from 'node:path';

export interface ScanPanelProps {
  isScanning: boolean;
  stats: ScanStats | null;
  currentDir: string | null;
}

export function ScanPanel(props: ScanPanelProps) {
  const { theme } = useTheme();

  const truncatedDir = () => {
    const dir = props.currentDir;
    if (!dir) return '...';
    const name = basename(dir);
    return name.length > 12 ? name.substring(0, 9) + '...' : name;
  };

  const borderColor = () => (props.isScanning ? theme.pink : theme.success);
  const statusText = () => (props.isScanning ? 'Scanning...' : 'Scan Done');

  return (
    <box flexDirection="column">
      <text style={{ fg: borderColor() }}>┌─ Scanner ──────────┐</text>
      <box flexDirection="row">
        <text style={{ fg: borderColor() }}>│ </text>
        <text style={{ fg: borderColor() }}>{statusText()}</text>
      </box>
      <Show when={props.isScanning && props.currentDir}>
        <box flexDirection="row">
          <text style={{ fg: borderColor() }}>│ </text>
          <text style={{ fg: theme.textMuted }}>{truncatedDir()}</text>
        </box>
      </Show>
      <box flexDirection="row">
        <text style={{ fg: borderColor() }}>│ </text>
        <text style={{ fg: theme.textMuted }}>Found: </text>
        <text style={{ fg: theme.text }}>{props.stats?.totalFound ?? 0}</text>
      </box>
      <box flexDirection="row">
        <text style={{ fg: borderColor() }}>│ </text>
        <text style={{ fg: theme.textMuted }}>Queue: </text>
        <text style={{ fg: theme.success }}>{props.stats?.toProcess ?? 0}</text>
      </box>
      <box flexDirection="row">
        <text style={{ fg: borderColor() }}>│ </text>
        <text style={{ fg: theme.textMuted }}>Skip: </text>
        <text style={{ fg: theme.warning }}>
          {(props.stats?.skippedMP3 ?? 0) + (props.stats?.skippedSRT ?? 0)}
        </text>
      </box>
      <text style={{ fg: borderColor() }}>└────────────────────┘</text>
    </box>
  );
}
