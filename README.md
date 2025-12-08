# FFmpeg Processor

A CLI-based batch video-to-MP3 converter with a beautiful violet-themed Terminal User Interface (TUI). Designed for preparing video files for transcription by converting them to small, speech-optimized MP3 files.

## Features

- **Batch Processing** - Convert entire directories of video files at once
- **Parallel Conversion** - Up to 10 concurrent FFmpeg processes
- **Smart Skip Logic** - Automatically skips videos that already have `.mp3` or `.srt` files
- **Beautiful TUI** - Violet-themed interface with progress bars and real-time status
- **Transcription Optimized** - Outputs small MP3 files (16kHz mono, 32kbps) perfect for speech-to-text
- **Graceful Shutdown** - Ctrl+C once to finish active jobs, twice to force stop

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
| `--concurrency <n>` | `-c` | Max parallel conversions | `10` |
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
- **Ctrl+C (once)** - Graceful shutdown: finish active conversions, skip remaining
- **Ctrl+C (twice)** - Immediate shutdown: kill all FFmpeg processes

## TUI Preview

```
█▀▀ █▀▀ █▀▄▀█ █▀█ █▀▀ █▀▀   █▀█ █▀█ █▀█ █▀▀ █▀▀ █▀ █▀ █▀█ █▀█
█▀  █▀  █ ▀ █ █▀▀ ██▄ █▄█   █▀▀ █▀▄ █▄█ █▄▄ ██▄ ▄█ ▄█ █▄█ █▀▄

│████████████░░░░░░░░│ 60% (6/10)

┌─ Statistics ─────────────────────────┐
│ Progress: 6/10 │ Active: 3           │
│ Elapsed: 00:02:15 │ ETA: 00:01:30    │
│ Output Size: 12.4 MB                 │
└──────────────────────────────────────┘

● video1.mp4 [████████░░] 80%
● video2.mp4 [██░░░░░░░░] 20%
○ video3.mp4 [waiting...]
✓ video4.mp4 [completed] 1.2MB
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
├── core/           # Business logic (scanner, converter, queue)
├── runtime/        # Entry point (cli-setup.ts)
└── cli/tui/        # Terminal UI (SolidJS components, context, routes)
```

## Tech Stack

- **Runtime**: Bun / Node.js
- **TUI**: OpenTUI + SolidJS
- **CLI**: Commander.js
- **Theme**: Violet (#A855F7)

## License

MIT
