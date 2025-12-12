# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is FFmpeg Processor?

A CLI-based batch video-to-MP3 converter with a violet-themed TUI interface. Converts video files to transcription-optimized MP3s with parallel processing (up to 25 concurrent FFmpeg jobs). Features a streaming producer-consumer pipeline where scanning and processing run concurrently.

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
-c, --concurrency <n>    Max parallel FFmpeg workers (1-25, default: 10)
-s, --scanners <n>       Parallel directory scanners (1-20, default: 5)
-d, --dry-run            Preview files without converting
-v, --verbose            Show FFmpeg output
--verify                 Scan for suspect MP3 files (too small or invalid)
--cleanup                Delete suspect MP3 files (use with --dry-run to preview)
```

### Verify/Cleanup Mode

Handle incomplete or broken MP3 files from interrupted conversions:

```bash
# Find broken MP3s (size-based + FFprobe validation)
ffmpeg-processor --verify -i "C:\Videos" -r

# Preview what would be deleted
ffmpeg-processor --cleanup --dry-run -i "C:\Videos" -r

# Actually delete broken MP3s (then re-run normal conversion)
ffmpeg-processor --cleanup -i "C:\Videos" -r
```

## Architecture

```
src/
├── core/                    # Business logic
│   ├── types.ts             # Type definitions (CLIOptions, VideoFile, ConversionJob)
│   ├── scanner.ts           # Directory scanning (batch + streaming async generator)
│   ├── converter.ts         # FFmpeg spawning, progress parsing, shutdown cleanup
│   ├── queue.ts             # Parallel job queue with streaming mode support
│   ├── verify.ts            # MP3 validation (size-based + FFprobe)
│   └── index.ts             # Core exports
├── runtime/
│   ├── cli-setup.ts         # Entry point: Commander.js CLI parsing, TUI launch
│   └── verify-mode.ts       # Console-based verify/cleanup mode
└── cli/
    ├── index.ts             # CLI exports
    └── tui/                  # Terminal User Interface
        ├── app.tsx           # Root app with keyboard Ctrl+C handler
        ├── launcher.ts       # SolidJS transform preload
        ├── component/        # UI components
        │   ├── logo.tsx          # ASCII art header
        │   ├── progress-bar.tsx  # Progress bar widget
        │   ├── file-list.tsx     # Scrolling file list with header stats
        │   ├── scan-panel.tsx    # Scanner status (pink)
        │   ├── progress-panel.tsx # Overall progress (violet)
        │   ├── stats-panel.tsx   # Active/done/failed counts (cyan)
        │   ├── io-panel.tsx      # Input/output info (teal)
        │   └── performance-panel.tsx # Speed/ETA metrics (orange)
        ├── context/          # State management
        │   ├── theme/        # Violet theme (#A855F7) + accent colors
        │   ├── processor-state.tsx  # Main state with streaming support
        │   └── helper.tsx
        └── routes/
            └── processing.tsx # Main processing view with stats bar + file list
```

## Key Behaviors

**Parallel Streaming Pipeline**: Multiple directory scanners (configurable via `-s`) discover files in parallel. Queue (consumer) starts processing immediately while scanning continues. This enables "hot start" - no waiting for full scan before processing begins. Especially effective on network drives or wide directory trees.

**Skip Logic**: Videos skipped if valid `.mp3` (>= 10KB) OR `.srt` with same basename exists. MP3 files smaller than 10KB are considered incomplete and will be reconverted.

**FFmpeg Command**: `ffmpeg -i input -vn -ar 16000 -ac 1 -b:a 32k -acodec libmp3lame -y output.mp3`

**Shutdown**:
- Ctrl+C once → Graceful: finish active jobs, skip pending (shows warning banner)
- Ctrl+C twice → Immediate: kill all FFmpeg processes AND delete partial output files

**Incomplete MP3 Handling**:
- Size validation: MP3s < 10KB are considered incomplete and reconverted automatically
- Shutdown cleanup: Partial files from killed processes are deleted automatically
- Verify mode: Use `--verify` to scan for broken MP3s (FFprobe validation)
- Cleanup mode: Use `--cleanup` to delete broken MP3s (preview with `--dry-run`)

**UI Layout**: Single-column design with consolidated stats bar above file list. Stats bar shows Scanner status, Progress, I/O, and Performance info horizontally. File list displays with header showing Workers/Done/Failed/Total and sorted by status (running at top, completed fade down).

## Tech Stack

- Bun 1.3+ / Node.js 20.10+
- OpenTUI + SolidJS (TUI)
- Commander.js (CLI)
- Violet theme (#A855F7) with pink, cyan, teal, orange accents
