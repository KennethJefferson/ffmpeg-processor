/** @jsxImportSource @opentui/solid */
import { For, Show, createMemo } from 'solid-js';
import { useTheme } from '../context/theme.js';
import { MiniProgressBar } from './progress-bar.js';
import type { ConversionJob } from '../../../core/types.js';
import { formatFileSize } from '../../../core/scanner.js';
import { basename } from 'node:path';

/** How long to keep completed jobs visible at the top (ms) */
const RECENTLY_COMPLETED_DURATION = 1500;

export interface FileListProps {
  /** List of conversion jobs */
  jobs: ConversionJob[];
  /** Maximum number of visible items */
  visibleCount?: number;
}

/**
 * Status icon for a job
 */
function StatusIcon(props: { status: ConversionJob['status']; isRecent?: boolean }) {
  const { theme } = useTheme();

  const icon = () => {
    switch (props.status) {
      case 'pending':
        return { char: '○', color: theme.textMuted };
      case 'running':
        return { char: '●', color: theme.primary };
      case 'completed':
        return { char: '✓', color: props.isRecent ? theme.success : theme.textMuted };
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
function FileItem(props: { job: ConversionJob; isRecent?: boolean }) {
  const { theme } = useTheme();

  const fileName = () => basename(props.job.inputPath);
  const truncatedName = () => {
    const name = fileName();
    return name.length > 50 ? name.substring(0, 47) + '...' : name;
  };

  // Dim text for non-recent completed jobs
  const textColor = () => {
    if (props.job.status === 'completed' && !props.isRecent) {
      return theme.textMuted;
    }
    return theme.text;
  };

  return (
    <box flexDirection="row" gap={1}>
      <StatusIcon status={props.job.status} isRecent={props.isRecent} />
      <text style={{ fg: textColor(), width: 52 }}>{truncatedName()}</text>

      <Show when={props.job.status === 'running'}>
        <MiniProgressBar progress={props.job.progress} width={10} />
        <text style={{ fg: theme.textMuted }}>{props.job.progress}%</text>
      </Show>

      <Show when={props.job.status === 'pending'}>
        <text style={{ fg: theme.textMuted }}>[waiting...]</text>
      </Show>

      <Show when={props.job.status === 'completed'}>
        <text style={{ fg: props.isRecent ? theme.success : theme.textMuted }}>[completed]</text>
        <Show when={props.job.outputSize}>
          <text style={{ fg: theme.textMuted }}> {formatFileSize(props.job.outputSize!)}</text>
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
 * Get sort priority for job status (lower = higher priority = shown first)
 */
function getStatusPriority(job: ConversionJob, now: number): number {
  switch (job.status) {
    case 'running':
      return 0; // Running jobs always at top
    case 'failed':
      return 1; // Failed jobs next (important to see)
    case 'completed':
      // Recently completed jobs stay near top briefly
      if (job.endTime && now - job.endTime < RECENTLY_COMPLETED_DURATION) {
        return 2; // Recently completed
      }
      return 5; // Old completed jobs at bottom
    case 'pending':
      return 3; // Pending jobs in middle
    case 'cancelled':
      return 4; // Cancelled jobs
    default:
      return 6;
  }
}

/**
 * Check if a job was recently completed
 */
function isRecentlyCompleted(job: ConversionJob, now: number): boolean {
  return (
    job.status === 'completed' &&
    job.endTime !== undefined &&
    now - job.endTime < RECENTLY_COMPLETED_DURATION
  );
}

/**
 * Scrollable file list component with sorted display
 *
 * Jobs are displayed in priority order:
 * 1. Running (actively processing)
 * 2. Failed (errors to notice)
 * 3. Recently completed (within 1.5s, shows completion briefly)
 * 4. Pending (waiting to start)
 * 5. Cancelled
 * 6. Completed (older, faded)
 */
export function FileList(props: FileListProps) {
  const { theme } = useTheme();

  const visibleCount = () => props.visibleCount ?? 12;

  // Sort jobs by status priority for display
  const sortedJobs = createMemo(() => {
    const now = Date.now();
    return [...props.jobs].sort((a, b) => {
      const priorityA = getStatusPriority(a, now);
      const priorityB = getStatusPriority(b, now);
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      // Within same priority, sort by start time (newer first for running)
      if (a.status === 'running' && b.status === 'running') {
        return (b.startTime ?? 0) - (a.startTime ?? 0);
      }
      // For completed, sort by end time (newer first)
      if (a.status === 'completed' && b.status === 'completed') {
        return (b.endTime ?? 0) - (a.endTime ?? 0);
      }
      return 0;
    });
  });

  // Get visible slice of sorted jobs
  const visibleJobs = createMemo(() => {
    return sortedJobs().slice(0, visibleCount());
  });

  const hasMore = () => sortedJobs().length > visibleCount();
  const remainingCount = () => sortedJobs().length - visibleCount();

  // Track which jobs are recently completed for highlighting
  const recentlyCompletedIds = createMemo(() => {
    const now = Date.now();
    return new Set(
      props.jobs
        .filter((j) => isRecentlyCompleted(j, now))
        .map((j) => j.id)
    );
  });

  return (
    <box flexDirection="column" paddingX={2}>
      <Show
        when={props.jobs.length > 0}
        fallback={<text style={{ fg: theme.textMuted }}>No files to process</text>}
      >
        <For each={visibleJobs()}>
          {(job) => <FileItem job={job} isRecent={recentlyCompletedIds().has(job.id)} />}
        </For>

        <Show when={hasMore()}>
          <text style={{ fg: theme.textMuted }}>... and {remainingCount()} more files</text>
        </Show>
      </Show>
    </box>
  );
}
