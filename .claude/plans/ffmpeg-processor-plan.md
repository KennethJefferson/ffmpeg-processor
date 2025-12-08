# FFmpeg Processor - Implementation Plan

## Overview

A CLI-based video-to-MP3 batch converter with a violet-themed TUI interface modeled after CodeMachine-CLI. Converts video files to transcription-optimized MP3s with parallel processing.

---

## Project Location

```
E:\Workspace.Dev.Js\FFMPEG processor\__OtherProjects\ffmpeg-processor\
```

---

## CLI Specification

```bash
# Binary names
ffmpeg-processor -i <path> [options]
fmp -i <path> [options]

# Arguments
-i, --input <path>       # (Required) Input directory to scan for videos
-r, --recursive          # (Optional) Search subdirectories
-c, --concurrency <n>    # (Optional) Max parallel conversions (default: 10, max: 10)
-d, --dry-run            # (Optional) Preview files without converting
-v, --verbose            # (Optional) Show FFmpeg output
```

**Supported Video Formats:** mp4, avi, mkv, wmv, mov, webm, flv

**Skip Logic:** Skip if video already has matching `.mp3` OR `.srt` file (same basename)

**Output:** MP3 placed in same directory as source video

---

## FFmpeg Command

Optimized for smallest file size suitable for transcription:

```bash
ffmpeg -i input.mp4 -vn -ar 16000 -ac 1 -b:a 32k -acodec libmp3lame -y output.mp3
```

| Flag | Value | Purpose |
|------|-------|---------|
| `-vn` | - | No video stream |
| `-ar` | 16000 | 16kHz sample rate (speech standard) |
| `-ac` | 1 | Mono audio |
| `-b:a` | 32k | 32kbps bitrate (minimum for clarity) |
| `-acodec` | libmp3lame | MP3 encoder |
| `-y` | - | Overwrite existing |

---

## Project Structure

```
ffmpeg-processor/
├── bin/
│   └── ffmpeg-processor.js       # Entry point
├── src/
│   ├── runtime/
│   │   └── cli-setup.ts          # Commander CLI + TUI launch
│   ├── cli/
│   │   └── tui/
│   │       ├── app.tsx           # Root TUI app
│   │       ├── launcher.ts       # SolidJS transform loader
│   │       ├── component/
│   │       │   ├── logo.tsx      # ASCII banner (violet)
│   │       │   ├── progress-bar.tsx
│   │       │   ├── file-list.tsx
│   │       │   └── stats-panel.tsx
│   │       ├── context/
│   │       │   ├── theme/
│   │       │   │   └── ffmpeg-processor.json
│   │       │   ├── theme.tsx
│   │       │   └── processor-state.tsx
│   │       └── routes/
│   │           └── processing.tsx
│   └── core/
│       ├── types.ts              # Shared interfaces
│       ├── scanner.ts            # Directory scanning
│       ├── converter.ts          # FFmpeg wrapper
│       └── queue.ts              # Parallel job queue
├── package.json
├── tsconfig.json
└── bunfig.toml
```

---

## Core Modules

### 1. Scanner (`src/core/scanner.ts`)

```typescript
interface VideoFile {
  path: string;
  basename: string;
  directory: string;
  hasMP3: boolean;
  hasSRT: boolean;
  shouldSkip: boolean;
}

async function scanDirectory(inputDir: string, recursive: boolean): Promise<VideoFile[]>
```

### 2. Converter (`src/core/converter.ts`)

```typescript
interface ConversionJob {
  id: string;
  inputPath: string;
  outputPath: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

async function executeConversion(job: ConversionJob, onProgress: (n: number) => void): Promise<void>
```

### 3. Queue (`src/core/queue.ts`)

```typescript
class ConversionQueue {
  constructor(concurrency: number);  // max 10
  addJobs(jobs: ConversionJob[]): void;
  start(): Promise<QueueSummary>;
  cancel(): void;
}
```

---

## Violet Theme (Primary Colors)

Replace CodeMachine's cyan (#00D9FF) with violet:

| Token | Dark Mode | Light Mode |
|-------|-----------|------------|
| primary | #A855F7 | #9333EA |
| secondary | #C084FC | #7C3AED |
| background | #1a1625 | #faf5ff |

---

## TUI Components

### Logo (ASCII Banner)
```
█▀▀ █▀▀ █▀▄▀█ █▀█ █▀▀ █▀▀   █▀█ █▀█ █▀█ █▀▀ █▀▀ █▀ █▀ █▀█ █▀█
█▀  █▀  █ ▀ █ █▀▀ ██▄ █▄█   █▀▀ █▀▄ █▄█ █▄▄ ██▄ ▄█ ▄█ █▄█ █▀▄
```

### Progress Display
```
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

---

## Dependencies

```json
{
  "dependencies": {
    "@opentui/core": "0.1.48",
    "@opentui/solid": "0.1.48",
    "commander": "^14.0.1",
    "solid-js": "1.9.9"
  },
  "devDependencies": {
    "@types/bun": "1.3.0",
    "typescript": "^5.4.5"
  }
}
```

---

## Implementation Order

### Phase 1: Project Setup
1. Create project directory and `package.json`
2. Set up `tsconfig.json` and `bunfig.toml`
3. Create `bin/ffmpeg-processor.js` entry point

### Phase 2: Core Logic
4. Implement `src/core/types.ts` - all interfaces
5. Implement `src/core/scanner.ts` - file discovery with skip logic
6. Implement `src/core/converter.ts` - FFmpeg spawning with progress parsing
7. Implement `src/core/queue.ts` - parallel job management

### Phase 3: CLI Setup
8. Implement `src/runtime/cli-setup.ts` - Commander args + TUI launch

### Phase 4: TUI Framework
9. Create violet theme JSON
10. Implement theme provider
11. Create processor-state context
12. Implement TUI launcher

### Phase 5: TUI Components
13. Logo component
14. Progress bar component
15. File list component
16. Stats panel component
17. Main app.tsx with processing route

### Phase 6: Polish
18. Keyboard shortcuts (Ctrl+C graceful exit)
19. Error handling and display
20. Dry-run mode

---

## Reference Files (CodeMachine-CLI)

| Purpose | Path |
|---------|------|
| CLI setup pattern | `src/runtime/cli-setup.ts` |
| TUI root app | `src/cli/tui/app.tsx` |
| Theme JSON structure | `src/cli/tui/context/theme/codemachine.json` |
| Theme provider | `src/cli/tui/context/theme.tsx` |
| State management | `src/cli/tui/context/ui-state.tsx` |
| Package config | `package.json` |

---

## Pre-flight Checks

Before starting conversion:
1. Verify FFmpeg exists at `C:\FFMPEG\bin\ffmpeg.exe` or in PATH
2. Verify input directory exists and is readable
3. Check disk space (warn if < 500MB free)

---

## Error Handling

- FFmpeg not found → Show installation instructions
- Permission denied → Skip file, log error, continue
- FFmpeg crash → Mark job failed, continue with others

## Shutdown Behavior

- **Ctrl+C (once)** → Graceful shutdown: stop queuing new jobs, let active FFmpeg processes finish, then exit
- **Ctrl+C (twice)** → Immediate shutdown: kill all active FFmpeg processes and exit immediately
