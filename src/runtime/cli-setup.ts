/**
 * CLI Setup and Entry Point
 *
 * Initializes Commander.js CLI parsing and launches the TUI.
 */

import { Command } from 'commander';
import { resolve } from 'node:path';
import type { CLIOptions } from '../core/types.js';

// Version - update this with package.json
const VERSION = '1.0.0';

/**
 * Parse and validate CLI options
 */
function parseOptions(options: Record<string, unknown>): CLIOptions {
  const input = options.input as string | undefined;

  if (!input) {
    console.error('Error: Input directory is required. Use -i or --input <path>');
    process.exit(1);
  }

  // Parse concurrency with validation
  let concurrency = 10;
  if (options.concurrency !== undefined) {
    const parsed = parseInt(options.concurrency as string, 10);
    if (isNaN(parsed) || parsed < 1) {
      console.error('Error: Concurrency must be a positive number');
      process.exit(1);
    }
    concurrency = Math.min(parsed, 25); // Cap at 25
  }

  // Parse scanners with validation
  let scanners = 5;
  if (options.scanners !== undefined) {
    const parsed = parseInt(options.scanners as string, 10);
    if (isNaN(parsed) || parsed < 1) {
      console.error('Error: Scanners must be a positive number');
      process.exit(1);
    }
    scanners = Math.min(parsed, 20); // Cap at 20
  }

  const verify = Boolean(options.verify);
  const cleanup = Boolean(options.cleanup);

  return {
    input: resolve(input),
    recursive: Boolean(options.recursive),
    concurrency,
    scanners,
    dryRun: Boolean(options.dryRun),
    verbose: Boolean(options.verbose),
    verify,
    cleanup,
  };
}

/**
 * Main CLI entry point
 */
export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command()
    .name('ffmpeg-processor')
    .version(VERSION)
    .description('Batch video-to-MP3 converter for transcription preparation')
    .requiredOption('-i, --input <path>', 'Input directory to scan for video files')
    .option('-r, --recursive', 'Search subdirectories recursively', false)
    .option('-c, --concurrency <number>', 'Maximum parallel conversions (1-25)', '10')
    .option('-s, --scanners <number>', 'Parallel directory scanners (1-20)', '5')
    .option('-d, --dry-run', 'Preview files without converting', false)
    .option('-v, --verbose', 'Show detailed FFmpeg output', false)
    .option('--verify', 'Scan for suspect MP3 files (too small or invalid)', false)
    .option('--cleanup', 'Delete suspect MP3 files (use with --dry-run to preview)', false)
    .action(async (options) => {
      const cliOptions = parseOptions(options);

      // Handle verify/cleanup modes (console output, no TUI)
      if (cliOptions.verify || cliOptions.cleanup) {
        const { runVerifyMode } = await import('./verify-mode.js');
        await runVerifyMode(cliOptions);
        return;
      }

      // Store options for TUI access
      process.env.FFMPEG_PROCESSOR_OPTIONS = JSON.stringify(cliOptions);

      // Show splash screen
      if (process.stdout.isTTY) {
        const { rows = 24, columns = 80 } = process.stdout;
        const centerY = Math.floor(rows / 2);
        const centerX = Math.floor(columns / 2);

        process.stdout.write('\x1b[2J\x1b[H\x1b[?25l'); // Clear, home, hide cursor
        process.stdout.write(`\x1b[${centerY};${centerX - 8}H`);
        process.stdout.write('\x1b[38;2;168;85;247mFFmpeg\x1b[1m Processor\x1b[0m');
        process.stdout.write(`\x1b[${centerY + 1};${centerX - 8}H`);
        process.stdout.write('\x1b[38;2;192;132;252m━━━━━━━━━━━━━━━━\x1b[0m');
      }

      // Launch TUI
      const { startTUI } = await import('../cli/tui/launcher.js');
      await startTUI(cliOptions);
    });

  await program.parseAsync(argv);
}

// Auto-run if this is the entry point
const isMainModule = (() => {
  try {
    const entry = process.argv[1];
    if (!entry) return false;

    // Check if running directly via bun
    if (typeof Bun !== 'undefined' && Bun.main) {
      const { fileURLToPath } = require('node:url');
      try {
        const mainPath = fileURLToPath(Bun.main);
        const modulePath = fileURLToPath(import.meta.url);
        if (mainPath === modulePath) return true;
      } catch {
        // Continue to fallback
      }
    }

    // Fallback check
    return entry.includes('cli-setup');
  } catch {
    return false;
  }
})();

if (isMainModule) {
  runCli().catch((error) => {
    console.error('Fatal error:', error.message);
    process.exitCode = 1;
  });
}
