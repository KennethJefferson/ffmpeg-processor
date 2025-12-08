/**
 * Directory Scanner Module
 *
 * Scans directories for video files and checks for existing
 * companion files (.mp3, .srt) to determine which files to skip.
 */

import { readdir, stat } from 'node:fs/promises';
import { join, extname, basename, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import type { VideoFile, ScanResult, VideoExtension } from './types.js';
import { VIDEO_EXTENSIONS } from './types.js';

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
