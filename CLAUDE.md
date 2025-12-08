# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is FFmpeg Processor?

A CLI-based batch video-to-MP3 converter with a violet-themed TUI interface. Converts video files to transcription-optimized MP3s with parallel processing (up to 10 concurrent FFmpeg jobs).

## Development Commands

```bash
# Install dependencies
bun install

# Run from source
bun dev -- -i "C:\Videos" -r -c 5
bun start -- -i "C:\Videos" -r

# Build standalone executable
bun build
```

## CLI Usage

```bash
ffmpeg-processor -i <path> [options]
fmp -i <path> [options]

# Required
-i, --input <path>       Input directory to scan for video files

# Optional
-r, --recursive          Search subdirectories
-c, --concurrency <n>    Max parallel conversions (1-10, default: 10)
-d, --dry-run            Preview files without converting
-v, --verbose            Show FFmpeg output
```

## Architecture

### Core (`src/core/`)
- `types.ts` - Type definitions (CLIOptions, VideoFile, ConversionJob, etc.)
- `scanner.ts` - Directory scanning, companion file detection
- `converter.ts` - FFmpeg spawning, progress parsing
- `queue.ts` - Parallel job queue with concurrency control

### Runtime (`src/runtime/`)
- `cli-setup.ts` - Commander.js CLI parsing, TUI launch

### TUI (`src/cli/tui/`)
- `app.tsx` - Root app with Ctrl+C shutdown handler
- `launcher.ts` - SolidJS transform preload
- `component/` - Logo, ProgressBar, FileList, StatsPanel
- `context/` - ThemeProvider (violet), ProcessorStateProvider
- `routes/processing.tsx` - Main processing view

## Key Behaviors

**Skip Logic**: Videos skipped if `.mp3` OR `.srt` with same basename exists.

**FFmpeg Command**: `ffmpeg -i input -vn -ar 16000 -ac 1 -b:a 32k -acodec libmp3lame -y output.mp3`

**Shutdown**:
- Ctrl+C once → Graceful: finish active jobs, skip pending
- Ctrl+C twice → Immediate: kill all FFmpeg processes

## Tech Stack

- Bun 1.3+ / Node.js 20.10+
- OpenTUI + SolidJS (TUI)
- Commander.js (CLI)
- Violet theme (#A855F7)
