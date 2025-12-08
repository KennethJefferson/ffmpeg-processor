/** @jsxImportSource @opentui/solid */
import { For, Show, createMemo } from 'solid-js';
import { useTheme } from '../context/theme.js';
import { MiniProgressBar } from './progress-bar.js';
import type { ConversionJob } from '../../../core/types.js';
import { formatFileSize } from '../../../core/scanner.js';
import { basename } from 'node:path';

export interface FileListProps {
  /** List of conversion jobs */
  jobs: ConversionJob[];
  /** Maximum number of visible items */
  visibleCount?: number;
  /** Index of the first visible item (for scrolling) */
  scrollOffset?: number;
}

/**
 * Status icon for a job
 */
function StatusIcon(props: { status: ConversionJob['status'] }) {
  const { theme } = useTheme();

  const icon = () => {
    switch (props.status) {
      case 'pending':
        return { char: '○', color: theme.textMuted };
      case 'running':
        return { char: '●', color: theme.primary };
      case 'completed':
        return { char: '✓', color: theme.success };
      case 'failed':
        return { char: '✗', color: theme.error };
      case 'cancelled':
        return { char: '⊘', color: theme.warning };
      default:
        return { char: '?', color: theme.textMuted };
    }
  };

  return <text style={{ fg: icon().color }}>{icon().char}</text>;
}

/**
 * Single file item in the list
 */
function FileItem(props: { job: ConversionJob }) {
  const { theme } = useTheme();

  const fileName = () => basename(props.job.inputPath);
  const truncatedName = () => {
    const name = fileName();
    return name.length > 40 ? name.substring(0, 37) + '...' : name;
  };

  return (
    <box flexDirection="row" gap={1}>
      <StatusIcon status={props.job.status} />
      <text style={{ fg: theme.text, width: 42 }}>{truncatedName()}</text>

      <Show when={props.job.status === 'running'}>
        <MiniProgressBar progress={props.job.progress} width={10} />
        <text style={{ fg: theme.textMuted }}>{props.job.progress}%</text>
      </Show>

      <Show when={props.job.status === 'pending'}>
        <text style={{ fg: theme.textMuted }}>[waiting...]</text>
      </Show>

      <Show when={props.job.status === 'completed'}>
        <text style={{ fg: theme.success }}>[completed]</text>
        <Show when={props.job.outputSize}>
          <text style={{ fg: theme.textMuted }}>{formatFileSize(props.job.outputSize!)}</text>
        </Show>
      </Show>

      <Show when={props.job.status === 'failed'}>
        <text style={{ fg: theme.error }}>[failed: {props.job.error || 'unknown error'}]</text>
      </Show>

      <Show when={props.job.status === 'cancelled'}>
        <text style={{ fg: theme.warning }}>[cancelled]</text>
      </Show>
    </box>
  );
}

/**
 * Scrollable file list component
 */
export function FileList(props: FileListProps) {
  const { theme } = useTheme();

  const visibleCount = () => props.visibleCount ?? 10;
  const scrollOffset = () => props.scrollOffset ?? 0;

  const visibleJobs = createMemo(() => {
    return props.jobs.slice(scrollOffset(), scrollOffset() + visibleCount());
  });

  const hasMore = () => props.jobs.length > scrollOffset() + visibleCount();
  const remainingCount = () => props.jobs.length - scrollOffset() - visibleCount();

  return (
    <box flexDirection="column" paddingX={2}>
      <Show
        when={props.jobs.length > 0}
        fallback={<text style={{ fg: theme.textMuted }}>No files to process</text>}
      >
        <For each={visibleJobs()}>{(job) => <FileItem job={job} />}</For>

        <Show when={hasMore()}>
          <text style={{ fg: theme.textMuted }}>... and {remainingCount()} more files</text>
        </Show>
      </Show>
    </box>
  );
}
