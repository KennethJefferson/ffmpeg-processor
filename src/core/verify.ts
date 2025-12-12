/**
 * MP3 Verification Module
 *
 * Provides utilities for validating MP3 files:
 * - Size-based validation (fast)
 * - FFprobe-based validation (deep, accurate)
 */

import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DEFAULT_FFMPEG_SETTINGS } from './types.js';

// ============================================================================
// Constants
// ============================================================================

/** Minimum valid MP3 file size in bytes (10KB) */
export const MIN_VALID_MP3_SIZE = 10 * 1024;

// ============================================================================
// Types
// ============================================================================

/** Result of FFprobe validation */
export interface FFprobeResult {
  /** Whether the MP3 is valid */
  valid: boolean;
  /** Whether the file contains an audio stream */
  hasAudio: boolean;
  /** Duration in seconds */
  duration?: number;
  /** Bitrate in bits per second */
  bitrate?: number;
  /** Audio codec name */
  codec?: string;
  /** Error message if validation failed */
  error?: string;
}

/** Result of MP3 validation */
export interface MP3ValidationResult {
  /** Full path to the MP3 file */
  path: string;
  /** Whether the MP3 is valid */
  isValid: boolean;
  /** File size in bytes */
  size: number;
  /** Reason for invalidity */
  reason?: 'too_small' | 'invalid_structure' | 'no_audio' | 'ffprobe_error' | 'file_error';
  /** Additional details about the validation result */
  details?: string;
}

/** Summary of verify/cleanup scan */
export interface VerifyScanSummary {
  /** Total number of MP3 files scanned */
  totalMP3s: number;
  /** Number of valid MP3 files */
  validMP3s: number;
  /** List of suspect MP3 files */
  suspectMP3s: MP3ValidationResult[];
  /** Number of errors during scanning */
  errors: number;
}

// ============================================================================
// FFprobe Utilities
// ============================================================================

/**
 * Get the path to ffprobe (sibling to ffmpeg)
 */
export function getFFprobePath(): string {
  const ffmpegPath = DEFAULT_FFMPEG_SETTINGS.ffmpegPath;
  const dir = dirname(ffmpegPath);
  return join(dir, 'ffprobe.exe');
}

/**
 * Validate that ffprobe is available and working
 */
export async function validateFFprobe(): Promise<{
  valid: boolean;
  error?: string;
  version?: string;
}> {
  const ffprobePath = getFFprobePath();

  return new Promise((resolve) => {
    // Try explicit path first, then fallback to PATH
    const probePath = existsSync(ffprobePath) ? ffprobePath : 'ffprobe';
    const useShell = !existsSync(ffprobePath);

    const process = spawn(probePath, ['-version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: useShell,
    });

    let output = '';

    process.stdout?.on('data', (data) => {
      output += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        const versionMatch = output.match(/ffprobe version (\S+)/);
        resolve({ valid: true, version: versionMatch?.[1] || 'unknown' });
      } else {
        resolve({
          valid: false,
          error: 'FFprobe not found. Install FFmpeg suite or ensure ffprobe is in PATH.',
        });
      }
    });

    process.on('error', () => {
      resolve({
        valid: false,
        error: 'FFprobe not found. Install FFmpeg suite or ensure ffprobe is in PATH.',
      });
    });
  });
}

/**
 * Validate an MP3 file using ffprobe
 *
 * Checks for:
 * - Valid audio stream presence
 * - Duration > 1 second
 * - Valid codec
 */
export async function validateMP3WithFFprobe(mp3Path: string): Promise<FFprobeResult> {
  const ffprobePath = getFFprobePath();
  const probePath = existsSync(ffprobePath) ? ffprobePath : 'ffprobe';

  return new Promise((resolve) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      mp3Path,
    ];

    const process = spawn(probePath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    process.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        resolve({
          valid: false,
          hasAudio: false,
          error: stderr || `FFprobe exited with code ${code}`,
        });
        return;
      }

      try {
        const data = JSON.parse(stdout);
        const audioStream = data.streams?.find((s: { codec_type: string }) => s.codec_type === 'audio');

        if (!audioStream) {
          resolve({
            valid: false,
            hasAudio: false,
            error: 'No audio stream found',
          });
          return;
        }

        const duration = parseFloat(data.format?.duration || '0');
        const bitrate = parseInt(data.format?.bit_rate || '0', 10);

        // Check for minimal valid audio (at least 1 second)
        if (duration < 1) {
          resolve({
            valid: false,
            hasAudio: true,
            duration,
            bitrate,
            codec: audioStream.codec_name,
            error: `Audio duration too short (${duration.toFixed(2)}s < 1s)`,
          });
          return;
        }

        resolve({
          valid: true,
          hasAudio: true,
          duration,
          bitrate,
          codec: audioStream.codec_name,
        });
      } catch (e) {
        resolve({
          valid: false,
          hasAudio: false,
          error: 'Failed to parse ffprobe output',
        });
      }
    });

    process.on('error', (err) => {
      resolve({
        valid: false,
        hasAudio: false,
        error: err.message,
      });
    });
  });
}

// ============================================================================
// Size-Based Validation
// ============================================================================

/**
 * Get the size of an MP3 file (async)
 */
export async function getMP3Size(mp3Path: string): Promise<number> {
  try {
    const stats = await stat(mp3Path);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Get the size of an MP3 file (sync, for use in scanner)
 */
export function getMP3SizeSync(mp3Path: string): number {
  try {
    const stats = statSync(mp3Path);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Check if an MP3 file meets the minimum size requirement
 */
export function isMP3SizeValid(size: number): boolean {
  return size >= MIN_VALID_MP3_SIZE;
}

// ============================================================================
// Full MP3 Validation
// ============================================================================

/**
 * Validate an MP3 file with size check and optional FFprobe validation
 *
 * @param mp3Path - Path to the MP3 file
 * @param useFFprobe - Whether to use FFprobe for deep validation (default: false)
 */
export async function validateMP3(
  mp3Path: string,
  useFFprobe: boolean = false
): Promise<MP3ValidationResult> {
  // First check if file exists and get size
  let size: number;
  try {
    size = await getMP3Size(mp3Path);
  } catch {
    return {
      path: mp3Path,
      isValid: false,
      size: 0,
      reason: 'file_error',
      details: 'Cannot read file',
    };
  }

  // Size check
  if (size < MIN_VALID_MP3_SIZE) {
    return {
      path: mp3Path,
      isValid: false,
      size,
      reason: 'too_small',
      details: `${Math.round(size / 1024)}KB < ${MIN_VALID_MP3_SIZE / 1024}KB minimum`,
    };
  }

  // If FFprobe validation is not requested, size check is enough
  if (!useFFprobe) {
    return {
      path: mp3Path,
      isValid: true,
      size,
    };
  }

  // Deep validation with FFprobe
  const ffprobeResult = await validateMP3WithFFprobe(mp3Path);

  if (!ffprobeResult.valid) {
    return {
      path: mp3Path,
      isValid: false,
      size,
      reason: ffprobeResult.hasAudio ? 'invalid_structure' : 'no_audio',
      details: ffprobeResult.error,
    };
  }

  return {
    path: mp3Path,
    isValid: true,
    size,
    details: `${ffprobeResult.duration?.toFixed(1)}s, ${ffprobeResult.codec}`,
  };
}
