/**
 * Directory Scanner Module
 *
 * Scans directories for video files and checks for existing
 * companion files (.mp3, .srt) to determine which files to skip.
 *
 * Supports two modes:
 * - Batch: scanDirectory() returns all files at once
 * - Streaming: scanDirectoryStream() yields files as they're found (producer-consumer pattern)
 */

import { readdir, stat } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { VideoFile, ScanResult, VideoExtension } from './types.js';
import { VIDEO_EXTENSIONS } from './types.js';

/** Event emitted during streaming scan */
export type ScanEvent =
  | { type: 'file'; file: VideoFile }
  | { type: 'skipped'; file: VideoFile; reason: 'mp3' | 'srt' }
  | { type: 'error'; path: string; error: string }
  | { type: 'directory'; path: string }
  | { type: 'complete'; stats: ScanStats };

/** Statistics tracked during streaming scan */
export interface ScanStats {
  totalFound: number;
  toProcess: number;
  skippedMP3: number;
  skippedSRT: number;
  errors: number;
}

/**
 * Check if a file extension is a supported video format
 */
function isVideoExtension(ext: string): ext is VideoExtension {
  return VIDEO_EXTENSIONS.includes(ext.toLowerCase() as VideoExtension);
}

/**
 * Check if companion files (.mp3, .srt) exist for a video file
 */
function checkCompanionFiles(videoPath: string): { hasMP3: boolean; hasSRT: boolean } {
  const dir = dirname(videoPath);
  const base = basename(videoPath, extname(videoPath));

  const mp3Path = join(dir, `${base}.mp3`);
  const srtPath = join(dir, `${base}.srt`);

  return {
    hasMP3: existsSync(mp3Path),
    hasSRT: existsSync(srtPath),
  };
}

/**
 * Create a VideoFile object from a file path
 */
async function createVideoFile(filePath: string): Promise<VideoFile> {
  const fileStats = await stat(filePath);
  const ext = extname(filePath).toLowerCase() as VideoExtension;
  const base = basename(filePath, ext);
  const dir = dirname(filePath);
  const { hasMP3, hasSRT } = checkCompanionFiles(filePath);

  return {
    path: filePath,
    basename: base,
    extension: ext,
    directory: dir,
    size: fileStats.size,
    hasMP3,
    hasSRT,
    shouldSkip: hasMP3 || hasSRT,
  };
}

/**
 * Recursively scan a directory for video files
 */
async function scanDirectoryRecursive(
  dirPath: string,
  recursive: boolean,
  results: VideoFile[],
  onProgress?: (current: string) => void
): Promise<void> {
  let entries;

  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch (error) {
    // Skip directories we can't read (permission issues, etc.)
    console.warn(`Warning: Cannot read directory ${dirPath}: ${(error as Error).message}`);
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory() && recursive) {
      // Recursively scan subdirectories
      await scanDirectoryRecursive(fullPath, recursive, results, onProgress);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();

      if (isVideoExtension(ext)) {
        onProgress?.(fullPath);

        try {
          const videoFile = await createVideoFile(fullPath);
          results.push(videoFile);
        } catch (error) {
          console.warn(`Warning: Cannot process file ${fullPath}: ${(error as Error).message}`);
        }
      }
    }
  }
}

/**
 * Scan a directory for video files
 *
 * @param inputDir - Directory to scan
 * @param recursive - Whether to scan subdirectories
 * @param onProgress - Optional callback for progress updates
 * @returns ScanResult containing all found files and skip statistics
 */
export async function scanDirectory(
  inputDir: string,
  recursive: boolean = false,
  onProgress?: (currentFile: string) => void
): Promise<ScanResult> {
  const allFiles: VideoFile[] = [];

  // Scan the directory
  await scanDirectoryRecursive(inputDir, recursive, allFiles, onProgress);

  // Sort files by path for consistent ordering
  allFiles.sort((a, b) => a.path.localeCompare(b.path));

  // Calculate statistics
  const skippedMP3 = allFiles.filter((f) => f.hasMP3 && !f.hasSRT).length;
  const skippedSRT = allFiles.filter((f) => f.hasSRT).length;
  const filesToProcess = allFiles.filter((f) => !f.shouldSkip);

  return {
    allFiles,
    filesToProcess,
    skippedMP3,
    skippedSRT,
    totalFound: allFiles.length,
  };
}

/** Options for parallel scanner */
export interface ParallelScanOptions {
  /** Number of directories to scan in parallel (default: 5) */
  directoryConcurrency?: number;
  /** Number of files to process in parallel per directory (default: 10) */
  fileConcurrency?: number;
}

/**
 * Parallel streaming directory scanner (async generator)
 *
 * Scans multiple directories simultaneously for faster discovery
 * on large directory trees or network drives.
 *
 * @param inputDir - Directory to scan
 * @param recursive - Whether to scan subdirectories
 * @param options - Parallel scan options
 * @yields ScanEvent for each file found, skipped, or on error
 */
export async function* scanDirectoryStreamParallel(
  inputDir: string,
  recursive: boolean = false,
  options: ParallelScanOptions = {}
): AsyncGenerator<ScanEvent, void, unknown> {
  const dirConcurrency = Math.max(1, Math.min(options.directoryConcurrency ?? 5, 20));
  const fileConcurrency = Math.max(1, Math.min(options.fileConcurrency ?? 10, 50));

  const stats: ScanStats = {
    totalFound: 0,
    toProcess: 0,
    skippedMP3: 0,
    skippedSRT: 0,
    errors: 0,
  };

  // Work queues
  const directoryQueue: string[] = [inputDir];
  const eventBuffer: ScanEvent[] = [];
  let activeWorkers = 0;
  let scanComplete = false;

  // Resolver for when new events are available
  let eventResolver: (() => void) | null = null;

  const notifyEvent = () => {
    if (eventResolver) {
      eventResolver();
      eventResolver = null;
    }
  };

  const waitForEvent = (): Promise<void> => {
    return new Promise((resolve) => {
      eventResolver = resolve;
    });
  };

  // Process a single directory
  const processDirectory = async (dirPath: string): Promise<void> => {
    let entries;

    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      stats.errors++;
      eventBuffer.push({ type: 'error', path: dirPath, error: (error as Error).message });
      notifyEvent();
      return;
    }

    eventBuffer.push({ type: 'directory', path: dirPath });
    notifyEvent();

    // Separate files and directories
    const videoFiles: string[] = [];
    const subdirs: string[] = [];

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory() && recursive) {
        subdirs.push(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (isVideoExtension(ext)) {
          videoFiles.push(fullPath);
        }
      }
    }

    // Add subdirectories to queue
    directoryQueue.push(...subdirs);

    // Process video files in parallel batches
    for (let i = 0; i < videoFiles.length; i += fileConcurrency) {
      const batch = videoFiles.slice(i, i + fileConcurrency);
      const results = await Promise.allSettled(
        batch.map(async (filePath) => {
          const videoFile = await createVideoFile(filePath);
          stats.totalFound++;

          if (videoFile.hasSRT) {
            stats.skippedSRT++;
            return { type: 'skipped' as const, file: videoFile, reason: 'srt' as const };
          } else if (videoFile.hasMP3) {
            stats.skippedMP3++;
            return { type: 'skipped' as const, file: videoFile, reason: 'mp3' as const };
          } else {
            stats.toProcess++;
            return { type: 'file' as const, file: videoFile };
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          eventBuffer.push(result.value);
        } else {
          stats.errors++;
          eventBuffer.push({ type: 'error', path: 'unknown', error: result.reason?.message || 'Unknown error' });
        }
      }
      notifyEvent();
    }
  };

  // Worker function - grabs directories from queue and processes them
  const worker = async (): Promise<void> => {
    while (true) {
      const dir = directoryQueue.shift();
      if (!dir) break;

      await processDirectory(dir);
    }
  };

  // Start workers
  const runWorkers = async (): Promise<void> => {
    while (directoryQueue.length > 0 || activeWorkers > 0) {
      // Spawn workers up to concurrency limit
      while (activeWorkers < dirConcurrency && directoryQueue.length > 0) {
        activeWorkers++;
        worker().finally(() => {
          activeWorkers--;
        });
      }

      // Wait a bit before checking again
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    scanComplete = true;
    notifyEvent();
  };

  // Start the workers in background
  const workerPromise = runWorkers();

  // Yield events as they become available
  while (!scanComplete || eventBuffer.length > 0) {
    if (eventBuffer.length > 0) {
      yield eventBuffer.shift()!;
    } else if (!scanComplete) {
      await waitForEvent();
    }
  }

  await workerPromise;

  // Emit completion event with final stats
  yield { type: 'complete', stats };
}

/**
 * Streaming directory scanner (async generator)
 *
 * Yields VideoFile objects as they're discovered, enabling
 * a producer-consumer pipeline where processing can start
 * immediately while scanning continues.
 *
 * @param inputDir - Directory to scan
 * @param recursive - Whether to scan subdirectories
 * @yields ScanEvent for each file found, skipped, or on error
 *
 * @example
 * ```ts
 * for await (const event of scanDirectoryStream(dir, true)) {
 *   if (event.type === 'file') {
 *     queue.addFile(event.file);
 *   }
 * }
 * ```
 */
export async function* scanDirectoryStream(
  inputDir: string,
  recursive: boolean = false
): AsyncGenerator<ScanEvent, void, unknown> {
  const stats: ScanStats = {
    totalFound: 0,
    toProcess: 0,
    skippedMP3: 0,
    skippedSRT: 0,
    errors: 0,
  };

  // Internal recursive generator
  async function* scanRecursive(dirPath: string): AsyncGenerator<ScanEvent, void, unknown> {
    let entries;

    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      stats.errors++;
      yield { type: 'error', path: dirPath, error: (error as Error).message };
      return;
    }

    yield { type: 'directory', path: dirPath };

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);

      if (entry.isDirectory() && recursive) {
        // Recursively scan subdirectories
        yield* scanRecursive(fullPath);
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();

        if (isVideoExtension(ext)) {
          try {
            const videoFile = await createVideoFile(fullPath);
            stats.totalFound++;

            if (videoFile.hasSRT) {
              stats.skippedSRT++;
              yield { type: 'skipped', file: videoFile, reason: 'srt' };
            } else if (videoFile.hasMP3) {
              stats.skippedMP3++;
              yield { type: 'skipped', file: videoFile, reason: 'mp3' };
            } else {
              stats.toProcess++;
              yield { type: 'file', file: videoFile };
            }
          } catch (error) {
            stats.errors++;
            yield { type: 'error', path: fullPath, error: (error as Error).message };
          }
        }
      }
    }
  }

  // Run the recursive scan
  yield* scanRecursive(inputDir);

  // Emit completion event with final stats
  yield { type: 'complete', stats };
}

/**
 * Get the output MP3 path for a video file
 */
export function getOutputPath(videoFile: VideoFile): string {
  return join(videoFile.directory, `${videoFile.basename}.mp3`);
}

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Validate that the input directory exists and is readable
 */
export async function validateInputDirectory(inputDir: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const stats = await stat(inputDir);

    if (!stats.isDirectory()) {
      return { valid: false, error: `"${inputDir}" is not a directory` };
    }

    // Try to read the directory to check permissions
    await readdir(inputDir);

    return { valid: true };
  } catch (error) {
    const err = error as NodeJS.ErrnoException;

    if (err.code === 'ENOENT') {
      return { valid: false, error: `Directory not found: "${inputDir}"` };
    }

    if (err.code === 'EACCES') {
      return { valid: false, error: `Permission denied: "${inputDir}"` };
    }

    return { valid: false, error: `Cannot access directory: ${err.message}` };
  }
}
