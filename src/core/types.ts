/**
 * Core type definitions for FFmpeg Processor
 */

// ============================================================================
// CLI Options
// ============================================================================

export interface CLIOptions {
  /** Input directory to scan for video files */
  input: string;
  /** Search subdirectories recursively */
  recursive: boolean;
  /** Maximum number of concurrent FFmpeg processes (1-25) */
  concurrency: number;
  /** Number of parallel directory scanners (1-20) */
  scanners: number;
  /** Preview files without converting */
  dryRun: boolean;
  /** Show detailed FFmpeg output */
  verbose: boolean;
  /** Verify mode: scan for suspect MP3 files */
  verify: boolean;
  /** Cleanup mode: delete suspect MP3 files */
  cleanup: boolean;
}

// ============================================================================
// Video File Types
// ============================================================================

/** Supported video file extensions */
export const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv', '.wmv', '.mov', '.webm', '.flv'] as const;

export type VideoExtension = (typeof VIDEO_EXTENSIONS)[number];

/** Represents a video file discovered during scanning */
export interface VideoFile {
  /** Full absolute path to the video file */
  path: string;
  /** File name without extension */
  basename: string;
  /** File extension (lowercase, with dot) */
  extension: VideoExtension;
  /** Directory containing the file */
  directory: string;
  /** File size in bytes */
  size: number;
  /** Whether a matching .mp3 file exists and is valid (>= 10KB) */
  hasMP3: boolean;
  /** Whether a matching .srt file exists */
  hasSRT: boolean;
  /** Whether this file should be skipped (has valid .mp3 or .srt) */
  shouldSkip: boolean;
  /** Whether an .mp3 exists but is too small (< 10KB, likely incomplete) */
  mp3TooSmall: boolean;
}

/** Result of scanning a directory for video files */
export interface ScanResult {
  /** All video files found (including those to skip) */
  allFiles: VideoFile[];
  /** Video files to be processed (not skipped) */
  filesToProcess: VideoFile[];
  /** Number of files skipped due to existing .mp3 */
  skippedMP3: number;
  /** Number of files skipped due to existing .srt */
  skippedSRT: number;
  /** Total number of files found */
  totalFound: number;
}

// ============================================================================
// Conversion Job Types
// ============================================================================

/** Status of a conversion job */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Represents a single video-to-MP3 conversion job */
export interface ConversionJob {
  /** Unique job identifier */
  id: string;
  /** Source video file path */
  inputPath: string;
  /** Target MP3 file path */
  outputPath: string;
  /** Current job status */
  status: JobStatus;
  /** Conversion progress (0-100) */
  progress: number;
  /** Total duration of the video in seconds (if known) */
  duration?: number;
  /** Current processing position in seconds */
  currentTime?: number;
  /** Error message if job failed */
  error?: string;
  /** Start time of conversion */
  startTime?: number;
  /** End time of conversion */
  endTime?: number;
  /** Output file size in bytes (after completion) */
  outputSize?: number;
}

/** Result of a completed conversion */
export interface ConversionResult {
  /** Whether conversion succeeded */
  success: boolean;
  /** Job that was processed */
  job: ConversionJob;
  /** Processing duration in milliseconds */
  processingTime: number;
  /** Output file size in bytes */
  outputSize?: number;
  /** Error message if failed */
  error?: string;
}

// ============================================================================
// Queue Types
// ============================================================================

/** Summary statistics for a completed queue */
export interface QueueSummary {
  /** Total number of jobs in queue */
  total: number;
  /** Number of successfully completed jobs */
  completed: number;
  /** Number of failed jobs */
  failed: number;
  /** Number of cancelled jobs */
  cancelled: number;
  /** Total processing time in milliseconds */
  totalTime: number;
  /** Total output file size in bytes */
  totalOutputSize: number;
}

/** Current state of the processing queue */
export interface QueueState {
  /** All jobs in the queue */
  jobs: ConversionJob[];
  /** IDs of currently running jobs */
  activeJobIds: Set<string>;
  /** Number of completed jobs */
  completedCount: number;
  /** Number of failed jobs */
  failedCount: number;
  /** Whether the queue is paused */
  isPaused: boolean;
  /** Whether shutdown was requested */
  isShuttingDown: boolean;
  /** Whether immediate shutdown was requested (double Ctrl+C) */
  isImmediateShutdown: boolean;
}

// ============================================================================
// Queue Event Callbacks
// ============================================================================

export interface QueueCallbacks {
  /** Called when a job starts processing */
  onJobStart?: (job: ConversionJob) => void;
  /** Called when a job's progress updates */
  onJobProgress?: (job: ConversionJob, progress: number) => void;
  /** Called when a job completes (success or failure) */
  onJobComplete?: (result: ConversionResult) => void;
  /** Called when the entire queue finishes */
  onQueueComplete?: (summary: QueueSummary) => void;
  /** Called when queue state changes */
  onStateChange?: (state: QueueState) => void;
}

// ============================================================================
// FFmpeg Types
// ============================================================================

/** FFmpeg conversion settings */
export interface FFmpegSettings {
  /** Path to FFmpeg binary */
  ffmpegPath: string;
  /** Audio sample rate in Hz */
  sampleRate: number;
  /** Number of audio channels (1 = mono, 2 = stereo) */
  channels: number;
  /** Audio bitrate (e.g., '32k', '64k') */
  bitrate: string;
  /** Audio codec to use */
  codec: string;
}

/** Default FFmpeg settings optimized for transcription */
export const DEFAULT_FFMPEG_SETTINGS: FFmpegSettings = {
  ffmpegPath: 'C:\\FFMPEG\\bin\\ffmpeg.exe',
  sampleRate: 16000,
  channels: 1,
  bitrate: '32k',
  codec: 'libmp3lame',
};

// ============================================================================
// Application State
// ============================================================================

/** Overall application status */
export type AppStatus = 'idle' | 'scanning' | 'processing' | 'paused' | 'completed' | 'cancelled' | 'error';

/** Complete application state */
export interface AppState {
  /** Current application status */
  status: AppStatus;
  /** CLI options provided by user */
  options: CLIOptions;
  /** Scan results (after scanning) */
  scanResult?: ScanResult;
  /** Queue state (during processing) */
  queueState?: QueueState;
  /** Queue summary (after completion) */
  summary?: QueueSummary;
  /** Start time of the operation */
  startTime?: number;
  /** Error message if status is 'error' */
  error?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export enum ErrorType {
  FFMPEG_NOT_FOUND = 'FFMPEG_NOT_FOUND',
  INPUT_NOT_FOUND = 'INPUT_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  DISK_FULL = 'DISK_FULL',
  FFMPEG_ERROR = 'FFMPEG_ERROR',
  CODEC_ERROR = 'CODEC_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export interface ProcessorError {
  type: ErrorType;
  message: string;
  details?: string;
  filePath?: string;
}
