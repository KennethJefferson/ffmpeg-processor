/**
 * Verify Mode - Console-based MP3 verification and cleanup
 *
 * Scans for suspect MP3 files (too small or invalid) and optionally deletes them.
 * Uses console output (no TUI) for scripting and automation.
 */

import { readdir } from 'node:fs/promises';
import { unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { CLIOptions } from '../core/types.js';
import {
  validateFFprobe,
  validateMP3,
  MIN_VALID_MP3_SIZE,
  type MP3ValidationResult,
} from '../core/verify.js';

// ============================================================================
// ANSI Colors
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  violet: '\x1b[38;2;168;85;247m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Run verify/cleanup mode
 */
export async function runVerifyMode(options: CLIOptions): Promise<void> {
  const mode = options.cleanup ? (options.dryRun ? 'cleanup-dry' : 'cleanup') : 'verify';

  // Header
  console.log();
  console.log(`${colors.violet}${colors.bold}=== FFmpeg Processor: Verify Mode ===${colors.reset}`);
  console.log();

  // Check FFprobe availability
  const ffprobeResult = await validateFFprobe();
  if (!ffprobeResult.valid) {
    console.log(`${colors.yellow}Warning: FFprobe not available - using size-only validation${colors.reset}`);
    console.log(`  ${colors.dim}${ffprobeResult.error}${colors.reset}`);
    console.log();
  } else {
    console.log(`${colors.green}FFprobe version: ${ffprobeResult.version}${colors.reset}`);
    console.log();
  }

  // Show configuration
  console.log(`${colors.cyan}Configuration:${colors.reset}`);
  console.log(`  Input:     ${options.input}`);
  console.log(`  Recursive: ${options.recursive ? 'Yes' : 'No'}`);
  console.log(`  Mode:      ${getModeDescription(mode)}`);
  console.log(`  Min size:  ${MIN_VALID_MP3_SIZE / 1024}KB`);
  console.log();

  // Scan for MP3 files
  console.log(`${colors.cyan}Scanning for MP3 files...${colors.reset}`);

  const suspectFiles: MP3ValidationResult[] = [];
  let totalMP3s = 0;
  let scannedDirs = 0;

  // Process all MP3 files
  await scanMP3Files(options.input, options.recursive, async (mp3Path) => {
    totalMP3s++;

    // Show progress every 100 files
    if (totalMP3s % 100 === 0) {
      process.stdout.write(`\r  Scanned ${totalMP3s} MP3 files...`);
    }

    // Validate the MP3 (use FFprobe if available)
    const result = await validateMP3(mp3Path, ffprobeResult.valid);

    if (!result.isValid) {
      suspectFiles.push(result);
    }
  }, () => {
    scannedDirs++;
  });

  // Clear progress line
  if (totalMP3s >= 100) {
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
  }

  console.log(`  Scanned ${scannedDirs} directories`);
  console.log();

  // Results summary
  console.log(`${colors.cyan}Results:${colors.reset}`);
  console.log(`  Total MP3 files:   ${totalMP3s}`);
  console.log(`  Valid MP3 files:   ${colors.green}${totalMP3s - suspectFiles.length}${colors.reset}`);
  console.log(`  Suspect MP3 files: ${suspectFiles.length > 0 ? colors.yellow : colors.green}${suspectFiles.length}${colors.reset}`);
  console.log();

  if (suspectFiles.length === 0) {
    console.log(`${colors.green}No suspect MP3 files found.${colors.reset}`);
    console.log();
    return;
  }

  // List suspect files
  console.log(`${colors.yellow}Suspect files:${colors.reset}`);
  for (const file of suspectFiles) {
    console.log(`  ${file.path}`);
    console.log(`    ${colors.dim}Reason: ${formatReason(file.reason)} - ${file.details}${colors.reset}`);
  }
  console.log();

  // Handle cleanup mode
  if (mode === 'cleanup-dry') {
    console.log(`${colors.yellow}DRY RUN - Would delete ${suspectFiles.length} files:${colors.reset}`);
    for (const file of suspectFiles) {
      console.log(`  ${colors.dim}[WOULD DELETE]${colors.reset} ${file.path}`);
    }
    console.log();
    console.log(`${colors.cyan}Run without --dry-run to actually delete these files.${colors.reset}`);
    console.log();
  } else if (mode === 'cleanup') {
    console.log(`${colors.red}Deleting ${suspectFiles.length} suspect files...${colors.reset}`);
    console.log();

    let deleted = 0;
    let errors = 0;

    for (const file of suspectFiles) {
      try {
        await unlink(file.path);
        console.log(`  ${colors.green}[DELETED]${colors.reset} ${file.path}`);
        deleted++;
      } catch (err) {
        console.log(`  ${colors.red}[ERROR]${colors.reset} ${file.path}: ${(err as Error).message}`);
        errors++;
      }
    }

    console.log();
    console.log(`${colors.green}Deleted ${deleted} files${colors.reset}`);
    if (errors > 0) {
      console.log(`${colors.red}Failed to delete ${errors} files${colors.reset}`);
    }
    console.log();
    console.log(`${colors.cyan}Run the converter again to re-process these videos.${colors.reset}`);
    console.log();
  } else {
    // Verify mode - just show summary
    console.log(`${colors.cyan}To delete these files, run with --cleanup flag.${colors.reset}`);
    console.log(`${colors.cyan}To preview deletion, run with --cleanup --dry-run flags.${colors.reset}`);
    console.log();
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get human-readable mode description
 */
function getModeDescription(mode: string): string {
  switch (mode) {
    case 'verify':
      return 'Verify (report only)';
    case 'cleanup-dry':
      return 'Cleanup (DRY RUN)';
    case 'cleanup':
      return 'Cleanup (DELETE files)';
    default:
      return mode;
  }
}

/**
 * Format validation reason for display
 */
function formatReason(reason?: string): string {
  switch (reason) {
    case 'too_small':
      return 'File too small';
    case 'invalid_structure':
      return 'Invalid audio structure';
    case 'no_audio':
      return 'No audio stream';
    case 'ffprobe_error':
      return 'FFprobe validation failed';
    case 'file_error':
      return 'Cannot read file';
    default:
      return reason || 'Unknown';
  }
}

/**
 * Recursively scan for MP3 files
 */
async function scanMP3Files(
  dirPath: string,
  recursive: boolean,
  onMP3: (path: string) => Promise<void>,
  onDir?: () => void
): Promise<void> {
  let entries;

  try {
    entries = await readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  onDir?.();

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory() && recursive) {
      await scanMP3Files(fullPath, recursive, onMP3, onDir);
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === '.mp3') {
      await onMP3(fullPath);
    }
  }
}
