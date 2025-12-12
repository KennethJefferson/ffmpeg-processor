/**
 * FFmpeg Converter Module
 *
 * Handles spawning FFmpeg processes and parsing progress output.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { existsSync, unlinkSync } from 'node:fs';
import type { ConversionJob, ConversionResult, FFmpegSettings, VideoFile } from './types.js';
import { DEFAULT_FFMPEG_SETTINGS } from './types.js';
import { getOutputPath } from './scanner.js';

// Track active processes for shutdown handling
const activeProcesses = new Map<string, ChildProcess>();

// Track output paths for cleanup on immediate shutdown
const activeOutputPaths = new Map<string, string>();

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a conversion job from a video file
 */
export function createConversionJob(videoFile: VideoFile): ConversionJob {
  return {
    id: generateJobId(),
    inputPath: videoFile.path,
    outputPath: getOutputPath(videoFile),
    status: 'pending',
    progress: 0,
  };
}

/**
 * Parse duration from FFmpeg output (in seconds)
 * Format: Duration: HH:MM:SS.ss
 */
function parseDuration(output: string): number | null {
  const match = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);

  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const centiseconds = parseInt(match[4], 10);

    return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
  }

  return null;
}

/**
 * Parse current time from FFmpeg progress output (in seconds)
 * Format: out_time_ms=12345678 or time=HH:MM:SS.ss
 */
function parseCurrentTime(output: string): number | null {
  // Try out_time_ms first (more precise)
  const msMatch = output.match(/out_time_ms=(\d+)/);
  if (msMatch) {
    return parseInt(msMatch[1], 10) / 1000000; // microseconds to seconds
  }

  // Try time= format
  const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = parseInt(timeMatch[3], 10);
    const centiseconds = parseInt(timeMatch[4], 10);

    return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
  }

  return null;
}

/**
 * Calculate progress percentage
 */
function calculateProgress(currentTime: number, duration: number): number {
  if (duration <= 0) return 0;
  return Math.min(100, Math.round((currentTime / duration) * 100));
}

/**
 * Validate FFmpeg is installed and accessible
 */
export async function validateFFmpeg(settings: FFmpegSettings = DEFAULT_FFMPEG_SETTINGS): Promise<{
  valid: boolean;
  error?: string;
  version?: string;
}> {
  return new Promise((resolve) => {
    // First check if the explicit path exists
    if (!existsSync(settings.ffmpegPath)) {
      // Try to find ffmpeg in PATH
      const ffmpegProcess = spawn('ffmpeg', ['-version'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      let output = '';

      ffmpegProcess.stdout?.on('data', (data) => {
        output += data.toString();
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          const versionMatch = output.match(/ffmpeg version (\S+)/);
          resolve({
            valid: true,
            version: versionMatch?.[1] || 'unknown',
          });
        } else {
          resolve({
            valid: false,
            error: `FFmpeg not found. Please install FFmpeg and ensure it's in your PATH, or verify it exists at: ${settings.ffmpegPath}`,
          });
        }
      });

      ffmpegProcess.on('error', () => {
        resolve({
          valid: false,
          error: `FFmpeg not found. Please install FFmpeg and ensure it's in your PATH, or verify it exists at: ${settings.ffmpegPath}`,
        });
      });

      return;
    }

    // Verify the explicit path works
    const ffmpegProcess = spawn(settings.ffmpegPath, ['-version'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';

    ffmpegProcess.stdout?.on('data', (data) => {
      output += data.toString();
    });

    ffmpegProcess.on('close', (code) => {
      if (code === 0) {
        const versionMatch = output.match(/ffmpeg version (\S+)/);
        resolve({
          valid: true,
          version: versionMatch?.[1] || 'unknown',
        });
      } else {
        resolve({
          valid: false,
          error: `FFmpeg at ${settings.ffmpegPath} returned error code ${code}`,
        });
      }
    });

    ffmpegProcess.on('error', (err) => {
      resolve({
        valid: false,
        error: `Cannot execute FFmpeg at ${settings.ffmpegPath}: ${err.message}`,
      });
    });
  });
}

/**
 * Execute a conversion job
 *
 * @param job - The conversion job to execute
 * @param onProgress - Callback for progress updates (0-100)
 * @param settings - FFmpeg settings
 * @param verbose - Whether to log FFmpeg output
 * @returns ConversionResult
 */
export async function executeConversion(
  job: ConversionJob,
  onProgress?: (progress: number, currentTime?: number) => void,
  settings: FFmpegSettings = DEFAULT_FFMPEG_SETTINGS,
  verbose: boolean = false
): Promise<ConversionResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    // Build FFmpeg arguments
    const args = [
      '-i', job.inputPath,
      '-vn',                              // No video
      '-ar', settings.sampleRate.toString(), // Sample rate
      '-ac', settings.channels.toString(),   // Channels
      '-b:a', settings.bitrate,           // Bitrate
      '-acodec', settings.codec,          // Codec
      '-progress', 'pipe:2',              // Progress to stderr
      '-y',                               // Overwrite output
      job.outputPath,
    ];

    // Determine which FFmpeg path to use
    const ffmpegPath = existsSync(settings.ffmpegPath) ? settings.ffmpegPath : 'ffmpeg';

    const ffmpegProcess = spawn(ffmpegPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // Track this process and output path for shutdown handling
    activeProcesses.set(job.id, ffmpegProcess);
    activeOutputPaths.set(job.id, job.outputPath);

    let duration: number | null = null;
    let stderrOutput = '';

    // Parse stderr for progress and duration
    ffmpegProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      stderrOutput += output;

      if (verbose) {
        process.stderr.write(output);
      }

      // Try to parse duration if we don't have it yet
      if (duration === null) {
        duration = parseDuration(output);
        if (duration) {
          job.duration = duration;
        }
      }

      // Parse current time and calculate progress
      const currentTime = parseCurrentTime(output);
      if (currentTime !== null && duration !== null) {
        job.currentTime = currentTime;
        const progress = calculateProgress(currentTime, duration);
        job.progress = progress;
        onProgress?.(progress, currentTime);
      }
    });

    ffmpegProcess.on('close', async (code) => {
      activeProcesses.delete(job.id);
      activeOutputPaths.delete(job.id);
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      if (code === 0) {
        // Get output file size
        let outputSize: number | undefined;
        try {
          const outputStats = await stat(job.outputPath);
          outputSize = outputStats.size;
        } catch {
          // Ignore stat errors
        }

        job.status = 'completed';
        job.progress = 100;
        job.endTime = endTime;
        job.outputSize = outputSize;

        resolve({
          success: true,
          job,
          processingTime,
          outputSize,
        });
      } else {
        // Extract error message from stderr
        let errorMessage = `FFmpeg exited with code ${code}`;

        // Look for common error patterns
        if (stderrOutput.includes('No such file or directory')) {
          errorMessage = 'Input file not found';
        } else if (stderrOutput.includes('Permission denied')) {
          errorMessage = 'Permission denied';
        } else if (stderrOutput.includes('Invalid data found')) {
          errorMessage = 'Invalid or corrupted input file';
        } else if (stderrOutput.includes('No space left on device')) {
          errorMessage = 'Disk full';
        } else if (stderrOutput.includes('Unknown encoder')) {
          errorMessage = 'Audio codec not available';
        }

        job.status = 'failed';
        job.error = errorMessage;
        job.endTime = endTime;

        resolve({
          success: false,
          job,
          processingTime,
          error: errorMessage,
        });
      }
    });

    ffmpegProcess.on('error', (err) => {
      activeProcesses.delete(job.id);
      activeOutputPaths.delete(job.id);
      const endTime = Date.now();

      job.status = 'failed';
      job.error = err.message;
      job.endTime = endTime;

      resolve({
        success: false,
        job,
        processingTime: endTime - startTime,
        error: err.message,
      });
    });
  });
}

/**
 * Kill a specific conversion job
 */
export function killJob(jobId: string): boolean {
  const process = activeProcesses.get(jobId);
  if (process) {
    process.kill('SIGTERM');
    activeProcesses.delete(jobId);
    return true;
  }
  return false;
}

/**
 * Kill all active conversion processes
 *
 * @param cleanupOutputs - If true, delete partial output files (default: false)
 * @returns Array of deleted file paths (only when cleanupOutputs is true)
 */
export function killAllJobs(cleanupOutputs: boolean = false): string[] {
  const deletedFiles: string[] = [];

  for (const [jobId, process] of activeProcesses) {
    process.kill('SIGKILL');

    // Clean up partial output files if requested
    if (cleanupOutputs) {
      const outputPath = activeOutputPaths.get(jobId);
      if (outputPath && existsSync(outputPath)) {
        try {
          unlinkSync(outputPath);
          deletedFiles.push(outputPath);
        } catch {
          // Ignore deletion errors - best effort cleanup
        }
      }
    }

    activeProcesses.delete(jobId);
    activeOutputPaths.delete(jobId);
  }

  return deletedFiles;
}

/**
 * Get the number of active conversion processes
 */
export function getActiveJobCount(): number {
  return activeProcesses.size;
}
