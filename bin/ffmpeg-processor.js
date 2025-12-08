#!/usr/bin/env node

/**
 * FFmpeg Processor CLI Entry Point
 *
 * This script bootstraps the FFmpeg Processor CLI tool.
 * It handles both direct node/bun execution and compiled binary scenarios.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set package root for resource resolution
process.env.FFMPEG_PROCESSOR_PACKAGE_ROOT = resolve(__dirname, '..');

// Launch the CLI
const cliPath = resolve(__dirname, '..', 'src', 'runtime', 'cli-setup.ts');

// Use Bun to run the TypeScript file directly
const child = spawn('bun', ['--conditions=browser', cliPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env
});

child.on('close', (code) => {
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('Failed to start FFmpeg Processor:', err.message);
  process.exit(1);
});
