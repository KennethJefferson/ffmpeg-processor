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
  // Clamp percentage to 0-100 to prevent >100% display
  const percentage = () => (props.total > 0 ? Math.min(100, Math.round((props.current / props.total) * 100)) : 0);
  // Clamp filled width to prevent overflow
  const filledWidth = () => (props.total > 0 ? Math.min(width(), Math.floor((props.current / props.total) * width())) : 0);

  const filledChar = '\u2588'; // █
  const emptyChar = '\u2591'; // ░

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

  // Build the bar as a single string for proper alignment
  const barString = () => {
    const filled = filledChar.repeat(filledWidth());
    const empty = emptyChar.repeat(width() - filledWidth());
    return filled + empty;
  };

  return (
    <box flexDirection="row">
      <text style={{ fg: theme.borderSubtle }}>{'│'}</text>
      <text style={{ fg: barColor() }}>{barString()}</text>
      <text style={{ fg: theme.borderSubtle }}>{'│'}</text>
      <Show when={props.showPercentage !== false}>
        <text style={{ fg: theme.text }}> {percentage()}%</text>
      </Show>
      <Show when={props.showCount}>
        <text style={{ fg: theme.textMuted }}> ({props.current}/{props.total})</text>
      </Show>
      <Show when={props.label}>
        <text style={{ fg: theme.textMuted }}> {props.label}</text>
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
  // Clamp progress to 0-100 and filled width to prevent overflow
  const filledWidth = () => Math.min(width(), Math.floor((Math.min(100, props.progress) / 100) * width()));

  const filledChar = '\u2588'; // █
  const emptyChar = '\u2591'; // ░

  // Build the entire bar as a single string
  const barString = () => {
    const filled = filledChar.repeat(filledWidth());
    const empty = emptyChar.repeat(width() - filledWidth());
    return '[' + filled + empty + ']';
  };

  return <text style={{ fg: theme.primary }}>{barString()}</text>;
}
