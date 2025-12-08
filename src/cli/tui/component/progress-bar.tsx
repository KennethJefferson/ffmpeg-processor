/** @jsxImportSource @opentui/solid */
import { Show } from 'solid-js';
import { useTheme } from '../context/theme.js';

export interface ProgressBarProps {
  /** Current value */
  current: number;
  /** Total value */
  total: number;
  /** Width of the progress bar in characters */
  width?: number;
  /** Label to show after the progress bar */
  label?: string;
  /** Whether to show percentage */
  showPercentage?: boolean;
  /** Whether to show count (current/total) */
  showCount?: boolean;
  /** Visual variant */
  variant?: 'primary' | 'secondary' | 'success' | 'error';
}

export function ProgressBar(props: ProgressBarProps) {
  const { theme } = useTheme();

  const width = () => props.width ?? 40;
  const percentage = () => (props.total > 0 ? Math.round((props.current / props.total) * 100) : 0);
  const filledWidth = () => (props.total > 0 ? Math.floor((props.current / props.total) * width()) : 0);

  const filledChar = '█';
  const emptyChar = '░';

  const barColor = () => {
    switch (props.variant) {
      case 'secondary':
        return theme.secondary;
      case 'success':
        return theme.success;
      case 'error':
        return theme.error;
      default:
        return theme.primary;
    }
  };

  return (
    <box flexDirection="row" gap={1}>
      <text style={{ fg: theme.borderSubtle }}>│</text>
      <text style={{ fg: barColor() }}>{filledChar.repeat(filledWidth())}</text>
      <text style={{ fg: theme.borderSubtle }}>{emptyChar.repeat(width() - filledWidth())}</text>
      <text style={{ fg: theme.borderSubtle }}>│</text>
      <Show when={props.showPercentage !== false}>
        <text style={{ fg: theme.text }}>{percentage()}%</text>
      </Show>
      <Show when={props.showCount}>
        <text style={{ fg: theme.textMuted }}>
          ({props.current}/{props.total})
        </text>
      </Show>
      <Show when={props.label}>
        <text style={{ fg: theme.textMuted }}>{props.label}</text>
      </Show>
    </box>
  );
}

export interface MiniProgressBarProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Width in characters */
  width?: number;
}

/**
 * Compact progress bar for file list items
 */
export function MiniProgressBar(props: MiniProgressBarProps) {
  const { theme } = useTheme();

  const width = () => props.width ?? 10;
  const filledWidth = () => Math.floor((props.progress / 100) * width());

  const filledChar = '█';
  const emptyChar = '░';

  return (
    <text>
      <span style={{ fg: theme.borderSubtle }}>[</span>
      <span style={{ fg: theme.primary }}>{filledChar.repeat(filledWidth())}</span>
      <span style={{ fg: theme.borderSubtle }}>{emptyChar.repeat(width() - filledWidth())}</span>
      <span style={{ fg: theme.borderSubtle }}>]</span>
    </text>
  );
}
