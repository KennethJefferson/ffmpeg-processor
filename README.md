# FFmpeg Processor

A CLI-based batch video-to-MP3 converter with a beautiful violet-themed Terminal User Interface (TUI). Designed for preparing video files for transcription by converting them to small, speech-optimized MP3 files.

## Features

- **Batch Processing** - Convert entire directories of video files at once
- **Parallel Conversion** - Up to 25 concurrent FFmpeg processes
- **Streaming Pipeline** - Processing starts immediately while scanning continues (hot start)
- **Smart Skip Logic** - Automatically skips videos that already have `.mp3` or `.srt` files
- **Beautiful TUI** - Two-column layout with color-coded info panels (violet, pink, cyan, teal, orange)
- **Transcription Optimized** - Outputs small MP3 files (16kHz mono, 32kbps) perfect for speech-to-text
- **Graceful Shutdown** - Ctrl+C once to finish active jobs (with notification), twice to force stop

## Installation

### Prerequisites

- [Bun](https://bun.sh/) 1.3+ or Node.js 20.10+
- [FFmpeg](https://ffmpeg.org/) installed and available in PATH

### Install Dependencies

```bash
cd ffmpeg-processor
bun install
```

## Usage

```bash
# Basic usage - process all videos in a directory
bun start -- -i "C:\Videos"

# Recursive scan with 5 concurrent conversions
bun start -- -i "Z:\Recordings" -r -c 5

# Dry run - preview what would be converted
bun start -- -i "C:\Videos" -r --dry-run

# Show FFmpeg output for debugging
bun start -- -i "C:\Videos" -v
```

### CLI Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--input <path>` | `-i` | Input directory (required) | - |
| `--recursive` | `-r` | Search subdirectories | `false` |
| `--concurrency <n>` | `-c` | Max parallel conversions (1-25) | `10` |
| `--dry-run` | `-d` | Preview without converting | `false` |
| `--verbose` | `-v` | Show FFmpeg output | `false` |

## Supported Formats

**Input**: mp4, avi, mkv, wmv, mov, webm, flv

**Output**: MP3 (16kHz, mono, 32kbps) - optimized for transcription

## Skip Logic

The processor automatically skips video files that already have companion files with the same basename:

- `video.mp4` + `video.mp3` exists → **Skip** (already converted)
- `video.mp4` + `video.srt` exists → **Skip** (already transcribed)
- `video.mp4` alone → **Convert**

## Keyboard Controls

During processing:
- **Ctrl+C (once)** - Graceful shutdown: finish active conversions, skip remaining (shows warning banner)
- **Ctrl+C (twice)** - Immediate shutdown: kill all FFmpeg processes

## TUI Preview

```
█▀▀ █▀▀ █▀▄▀█ █▀█ █▀▀ █▀▀   █▀█ █▀█ █▀█ █▀▀ █▀▀ █▀ █▀ █▀█ █▀█
█▀  █▀  █ ▀ █ █▀▀ ██▄ █▄█   █▀▀ █▀▄ █▄█ █▄▄ ██▄ ▄█ ▄█ █▄█ █▀▄
        >>> Video → MP3 >>> Batch Converter >>>

Workers: 18/25  Done: 12  Failed: 0  Total: 1871    ┌─ Scanner ────────────┐
                                                    │ Scanning...          │
✓ 1 -Introduction.mp4         [completed] 1.0 MB   │ Found: 1949          │
● 1 -Literature Review.mp4    [████░░░░░░] 40%     │ Queue: 1871          │
● 1 -Research Questions.mp4   [██░░░░░░░░] 20%     │ Skip: 78             │
○ 1 -Research Methodology.mp4 [waiting...]         └──────────────────────┘
○ 1 -Data Collection.mp4      [waiting...]
... and 1853 more files                            ┌─ Progress ──────────┐
                                                   │ [██████░░░░░░░░] 1% │
                                                   │ 12/1871 files       │
                                                   └──────────────────────┘

                                                   ┌─ Status ─────────────┐
                                                   │ Processing           │
                                                   │ Active: 25           │
                                                   │ Done: 12  Fail: 0    │
                                                   └──────────────────────┘

Press Ctrl+C to gracefully stop (let active jobs finish)
```

## Development

```bash
# Run in development mode
bun dev -- -i "C:\Videos" -r

# Type check
bun run typecheck

# Build standalone executable
bun run build
```

## Project Structure

```
src/
├── core/           # Business logic (scanner with async generator, converter, queue)
├── runtime/        # Entry point (cli-setup.ts)
└── cli/tui/        # Terminal UI (SolidJS components, context, routes)
    └── component/  # UI panels: scan, progress, stats, io, performance
```

## Tech Stack

- **Runtime**: Bun / Node.js
- **TUI**: OpenTUI + SolidJS
- **CLI**: Commander.js
- **Theme**: Violet (#A855F7) with pink, cyan, teal, orange accent panels
- **Architecture**: Producer-consumer streaming pipeline

## License

MIT
