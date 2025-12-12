# FFmpeg Processor

A CLI-based batch video-to-MP3 converter with a beautiful violet-themed Terminal User Interface (TUI). Designed for preparing video files for transcription by converting them to small, speech-optimized MP3 files.

## Features

- **Batch Processing** - Convert entire directories of video files at once
- **Parallel Conversion** - Up to 25 concurrent FFmpeg processes
- **Parallel Scanning** - Up to 20 concurrent directory scanners for fast file discovery
- **Streaming Pipeline** - Processing starts immediately while scanning continues (hot start)
- **Smart Skip Logic** - Automatically skips videos that already have valid `.mp3` or `.srt` files
- **Incomplete MP3 Detection** - MP3s < 10KB are considered broken and automatically reconverted
- **Verify/Cleanup Mode** - Scan for and delete broken MP3s from interrupted conversions
- **Beautiful TUI** - Clean layout with consolidated stats bar and sorted file list
- **Transcription Optimized** - Outputs small MP3 files (16kHz mono, 32kbps) perfect for speech-to-text
- **Graceful Shutdown** - Ctrl+C once to finish active jobs, twice to force stop AND cleanup partial files

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

# Recursive scan with 25 workers and 10 scanners
bun start -- -i "Z:\Recordings" -r -c 25 -s 10

# Dry run - preview what would be converted
bun start -- -i "C:\Videos" -r --dry-run

# Network drive (more scanners help with latency)
bun start -- -i "Z:\Archive" -r -c 10 -s 20

# Show FFmpeg output for debugging
bun start -- -i "C:\Videos" -v
```

### CLI Options

| Option | Alias | Description | Default |
|--------|-------|-------------|---------|
| `--input <path>` | `-i` | Input directory (required) | - |
| `--recursive` | `-r` | Search subdirectories | `false` |
| `--concurrency <n>` | `-c` | Max parallel FFmpeg workers (1-25) | `10` |
| `--scanners <n>` | `-s` | Parallel directory scanners (1-20) | `5` |
| `--dry-run` | `-d` | Preview without converting | `false` |
| `--verbose` | `-v` | Show FFmpeg output | `false` |
| `--verify` | - | Scan for broken/incomplete MP3 files | `false` |
| `--cleanup` | - | Delete broken MP3 files (use with `--dry-run` to preview) | `false` |

## Supported Formats

**Input**: mp4, avi, mkv, wmv, mov, webm, flv

**Output**: MP3 (16kHz, mono, 32kbps) - optimized for transcription

## Skip Logic

The processor automatically skips video files that already have companion files with the same basename:

- `video.mp4` + `video.mp3` (≥10KB) exists → **Skip** (already converted)
- `video.mp4` + `video.mp3` (<10KB) exists → **Convert** (incomplete, will overwrite)
- `video.mp4` + `video.srt` exists → **Skip** (already transcribed)
- `video.mp4` alone → **Convert**

### Handling Incomplete MP3s

If a conversion was interrupted (double Ctrl+C), the partial MP3 file is automatically deleted. Any remaining broken MP3s from previous runs can be found and removed:

```bash
# Find broken MP3 files
bun start -- --verify -i "C:\Videos" -r

# Preview what would be deleted
bun start -- --cleanup --dry-run -i "C:\Videos" -r

# Actually delete broken MP3s
bun start -- --cleanup -i "C:\Videos" -r
```

## Keyboard Controls

During processing:
- **Ctrl+C (once)** - Graceful shutdown: finish active conversions, skip remaining (shows warning banner)
- **Ctrl+C (twice)** - Immediate shutdown: kill all FFmpeg processes AND delete partial output files

## TUI Preview

```
█▀▀ █▀▀ █▀▄▀█ █▀█ █▀▀ █▀▀   █▀█ █▀█ █▀█ █▀▀ █▀▀ █▀ █▀ █▀█ █▀█
█▀  █▀  █ ▀ █ █▀▀ ██▄ █▄█   █▀▀ █▀▄ █▄█ █▄▄ ██▄ ▄█ ▄█ █▄█ █▀▄
        >>> Video → MP3 >>> Batch Converter >>>

◉ Scanning │ Progress: 12/1871 (1%) │ Workers: 25 (recursive) │ Time: 5:32 ETA: 2:15:00
Found: 1949  Skip: 78 │ Active: 25  Failed: 0 │ Output: 45.2 MB      │ Speed: 2.2/min
──────────────────────────────────────────────────────────────────────────────────────
Workers: 18/25  Done: 12  Failed: 0  Total: 1871
● 1 -Literature Review.mp4    [████░░░░░░] 40%
● 1 -Research Questions.mp4   [██░░░░░░░░] 20%
✓ 1 -Introduction.mp4         [completed] 1.0 MB
○ 1 -Research Methodology.mp4 [waiting...]
○ 1 -Data Collection.mp4      [waiting...]
... and 1853 more files

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
├── core/           # Business logic (scanner, converter, queue, verify)
├── runtime/        # Entry points (cli-setup.ts, verify-mode.ts)
└── cli/tui/        # Terminal UI (SolidJS components, context, routes)
    └── component/  # UI components: logo, file-list, progress-bar
```

## Tech Stack

- **Runtime**: Bun / Node.js
- **TUI**: OpenTUI + SolidJS
- **CLI**: Commander.js
- **Theme**: Violet (#A855F7) with accent colors
- **Architecture**: Parallel producer-consumer streaming pipeline

## License

MIT
