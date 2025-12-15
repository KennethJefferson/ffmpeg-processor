/**
 * Verify Mode - Console-based MP3 verification and cleanup
 *
 * Uses database tracking to find incomplete/failed conversions.
 * Uses console output (no TUI) for scripting and automation.
 */

import type { CLIOptions } from '../core/types.js';
import { openConversionDB, conversionDBExists } from '../core/db.js';
import {
  findSuspectConversions,
  cleanupSuspectConversions,
  type SuspectConversion,
} from '../core/verify.js';
import { formatFileSize } from '../core/scanner.js';

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

  // Show configuration
  console.log(`${colors.cyan}Configuration:${colors.reset}`);
  console.log(`  Input:     ${options.input}`);
  console.log(`  Mode:      ${getModeDescription(mode)}`);
  console.log();

  // Check if database exists
  if (!conversionDBExists(options.input)) {
    console.log(`${colors.yellow}No conversion database found in this directory.${colors.reset}`);
    console.log(`${colors.dim}Run a conversion first to create the tracking database.${colors.reset}`);
    console.log();
    console.log(`${colors.dim}Database would be created at: ${options.input}/.ffmpeg-processor.db${colors.reset}`);
    console.log();
    return;
  }

  // Open database
  const db = openConversionDB(options.input);

  try {
    // Find suspect conversions
    console.log(`${colors.cyan}Checking conversion database...${colors.reset}`);
    console.log();

    const summary = findSuspectConversions(db);

    // Results summary
    console.log(`${colors.cyan}Results:${colors.reset}`);
    console.log(`  Incomplete (interrupted): ${summary.incompleteCount > 0 ? colors.yellow : colors.green}${summary.incompleteCount}${colors.reset}`);
    console.log(`  Failed conversions:       ${summary.failedCount > 0 ? colors.red : colors.green}${summary.failedCount}${colors.reset}`);
    console.log();

    if (summary.suspects.length === 0) {
      console.log(`${colors.green}No suspect conversions found.${colors.reset}`);
      console.log();
      return;
    }

    // List suspect files grouped by status
    const incomplete = summary.suspects.filter((s) => s.status === 'processing');
    const failed = summary.suspects.filter((s) => s.status === 'failed');

    if (incomplete.length > 0) {
      console.log(`${colors.yellow}Incomplete conversions (interrupted):${colors.reset}`);
      for (const suspect of incomplete) {
        printSuspect(suspect);
      }
      console.log();
    }

    if (failed.length > 0) {
      console.log(`${colors.red}Failed conversions:${colors.reset}`);
      for (const suspect of failed) {
        printSuspect(suspect);
      }
      console.log();
    }

    // Handle cleanup mode
    if (mode === 'cleanup-dry') {
      const result = cleanupSuspectConversions(db, true);
      console.log(`${colors.yellow}DRY RUN - Would clean up:${colors.reset}`);
      console.log(`  MP3 files to delete:    ${result.deleted.length}`);
      console.log(`  DB records to remove:   ${result.dbRecordsRemoved}`);
      console.log();

      if (result.deleted.length > 0) {
        console.log(`${colors.dim}Files that would be deleted:${colors.reset}`);
        for (const file of result.deleted) {
          console.log(`  ${colors.dim}[WOULD DELETE]${colors.reset} ${file}`);
        }
        console.log();
      }

      console.log(`${colors.cyan}Run without --dry-run to actually delete these files.${colors.reset}`);
      console.log();
    } else if (mode === 'cleanup') {
      console.log(`${colors.red}Cleaning up suspect conversions...${colors.reset}`);
      console.log();

      const result = cleanupSuspectConversions(db, false);

      console.log(`${colors.green}Cleanup complete:${colors.reset}`);
      console.log(`  MP3 files deleted:     ${result.deleted.length}`);
      console.log(`  DB records removed:    ${result.dbRecordsRemoved}`);
      console.log();

      if (result.deleted.length > 0) {
        console.log(`${colors.dim}Deleted files:${colors.reset}`);
        for (const file of result.deleted) {
          console.log(`  ${colors.green}[DELETED]${colors.reset} ${file}`);
        }
        console.log();
      }

      console.log(`${colors.cyan}Run the converter again to re-process these videos.${colors.reset}`);
      console.log();
    } else {
      // Verify mode - just show summary
      console.log(`${colors.cyan}To clean up these conversions, run with --cleanup flag.${colors.reset}`);
      console.log(`${colors.cyan}To preview cleanup, run with --cleanup --dry-run flags.${colors.reset}`);
      console.log();
    }
  } finally {
    // Always close database
    db.close();
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
      return 'Cleanup (DELETE files + DB records)';
    default:
      return mode;
  }
}

/**
 * Print a suspect conversion
 */
function printSuspect(suspect: SuspectConversion): void {
  console.log(`  Video: ${suspect.videoPath}`);
  console.log(`    MP3:    ${suspect.mp3Path}`);
  console.log(`    Status: ${suspect.status === 'processing' ? colors.yellow : colors.red}${suspect.status}${colors.reset}`);

  if (suspect.mp3Exists) {
    console.log(`    MP3 exists: ${colors.yellow}Yes${colors.reset} (${suspect.mp3Size ? formatFileSize(suspect.mp3Size) : 'unknown size'})`);
  } else {
    console.log(`    MP3 exists: ${colors.dim}No${colors.reset}`);
  }

  if (suspect.error) {
    console.log(`    Error:  ${colors.dim}${suspect.error}${colors.reset}`);
  }

  const date = new Date(suspect.startedAt);
  console.log(`    Started: ${colors.dim}${date.toLocaleString()}${colors.reset}`);
}
