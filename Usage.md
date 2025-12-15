# FFmpeg Processor - Complete Usage Guide

This guide provides a comprehensive walkthrough of every command-line option available in FFmpeg Processor. Whether you're new to the command line or just want to understand all the features, this guide has you covered.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Command Structure](#command-structure)
3. [Required Arguments](#required-arguments)
   - [Input Directory (-i, --input)](#input-directory--i---input)
4. [Optional Arguments](#optional-arguments)
   - [Recursive Scanning (-r, --recursive)](#recursive-scanning--r---recursive)
   - [Concurrency (-c, --concurrency)](#concurrency--c---concurrency)
   - [Scanners (-s, --scanners)](#scanners--s---scanners)
   - [Dry Run (-d, --dry-run)](#dry-run--d---dry-run)
   - [Verbose Output (-v, --verbose)](#verbose-output--v---verbose)
   - [Verify Mode (--verify)](#verify-mode---verify)
   - [Cleanup Mode (--cleanup)](#cleanup-mode---cleanup)
5. [Argument Combinations](#argument-combinations)
6. [Understanding the Skip Logic](#understanding-the-skip-logic)
7. [Keyboard Controls](#keyboard-controls)
8. [Common Scenarios](#common-scenarios)
9. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

Before using FFmpeg Processor, ensure you have:

1. **Bun** (version 1.3 or higher) OR **Node.js** (version 20.10 or higher)
2. **FFmpeg** installed and available in your system PATH
   - Default expected location: `C:\FFMPEG\bin\ffmpeg.exe`
   - Can also be anywhere in your system PATH

### Installation

```bash
# Navigate to the project directory
cd ffmpeg-processor

# Install dependencies
bun install
# OR
npm install
```

---

## Command Structure

FFmpeg Processor follows a standard command-line structure:

```
bun start -- [OPTIONS]
```

**Important**: The `--` (double dash) separates Bun's arguments from the application's arguments. Always include it when passing options.

### Alternative Ways to Run

```bash
# Using Bun (recommended)
bun start -- [OPTIONS]

# Using npm
npm start -- [OPTIONS]

# Development mode (with hot reload)
bun dev -- [OPTIONS]

# Direct execution (after building)
./bin/ffmpeg-processor [OPTIONS]
```

---

## Required Arguments

### Input Directory (-i, --input)

**Purpose**: Specifies the directory containing video files to convert.

**Syntax**:
```
-i <path>
--input <path>
```

This is the **only required argument**. The program will not run without it.

#### Examples

**Example 1: Simple directory path**
```bash
bun start -- -i "C:\Videos"
```
Scans the `C:\Videos` folder for video files.

**Example 2: Using the long form**
```bash
bun start -- --input "C:\Videos"
```
Same as above, using the full argument name.

**Example 3: Network drive path**
```bash
bun start -- -i "Z:\Recordings\2024"
```
Scans a network or mapped drive location.

**Example 4: Path with spaces**
```bash
bun start -- -i "C:\My Videos\Family Movies"
```
Always wrap paths containing spaces in quotes.

**Example 5: Relative path**
```bash
bun start -- -i "./videos"
```
Uses a path relative to your current directory.

**Example 6: Current directory**
```bash
bun start -- -i "."
```
Scans the current working directory.

#### Common Errors

```bash
# Missing input argument - WILL FAIL
bun start --

# Error: Input directory is required. Use -i or --input <path>
```

```bash
# Non-existent directory - WILL FAIL
bun start -- -i "C:\NonExistentFolder"

# Error: Input directory not found
```

---

## Optional Arguments

### Recursive Scanning (-r, --recursive)

**Purpose**: Search for video files in all subdirectories, not just the specified folder.

**Syntax**:
```
-r
--recursive
```

**Default**: `false` (only scans the specified directory)

#### Examples

**Example 1: Scan only top-level directory (default behavior)**
```bash
bun start -- -i "C:\Videos"
```
Only finds videos directly in `C:\Videos`, ignores subfolders.

**Example 2: Scan all subdirectories**
```bash
bun start -- -i "C:\Videos" -r
```
Finds videos in `C:\Videos` AND all folders inside it.

**Example 3: Using long form**
```bash
bun start -- -i "C:\Videos" --recursive
```
Same as above with the full argument name.

#### Use Cases

**When to use recursive scanning:**
- You have a folder structure like `Videos/2024/January/`, `Videos/2024/February/`
- You want to process an entire drive or large archive
- Your videos are organized in nested folders

**When NOT to use recursive scanning:**
- You only want to process videos in one specific folder
- You have subfolders you want to exclude
- You're testing with a small batch first

#### Visual Example

```
C:\Videos\
├── movie1.mp4          ← Found with or without -r
├── movie2.avi          ← Found with or without -r
├── 2024\
│   ├── vacation.mp4    ← Only found with -r
│   └── birthday.mkv    ← Only found with -r
└── Archives\
    └── old_video.wmv   ← Only found with -r
```

---

### Concurrency (-c, --concurrency)

**Purpose**: Control how many video files are converted simultaneously.

**Syntax**:
```
-c <number>
--concurrency <number>
```

**Default**: `10`
**Range**: `1` to `25`

#### Examples

**Example 1: Default (10 parallel conversions)**
```bash
bun start -- -i "C:\Videos"
```
Converts up to 10 videos at once - a good balance for most systems.

**Example 2: Single file at a time**
```bash
bun start -- -i "C:\Videos" -c 1
```
Converts one video at a time. Slower but uses minimal resources.

**Example 3: Moderate concurrency**
```bash
bun start -- -i "C:\Videos" -c 5
```
A balanced approach - good speed without overwhelming your system.

**Example 4: Using long form**
```bash
bun start -- -i "C:\Videos" --concurrency 3
```
Process 3 videos simultaneously.

**Example 5: Maximum throughput**
```bash
bun start -- -i "C:\Videos" -c 25
```
Maximum parallel conversions for fastest processing on powerful systems.

**Example 6: Values above 25 are capped**
```bash
bun start -- -i "C:\Videos" -c 50
```
This will be automatically reduced to 25 (the maximum).

#### Performance Guidelines

| Concurrency | Best For | CPU Usage | Memory |
|-------------|----------|-----------|--------|
| 1 | Old/slow computers, background tasks | Low | Low |
| 2-3 | Laptops, working while converting | Medium | Medium |
| 5-10 | Desktop computers, balanced approach | Medium-High | Medium |
| 15-25 | Fast multi-core systems, dedicated conversion | High | High |

#### Choosing the Right Value

- **Slow computer or laptop**: Use `-c 2` or `-c 3`
- **Want to use computer while converting**: Use `-c 3` or `-c 5`
- **Dedicated conversion (not using PC)**: Use `-c 10` to `-c 25`
- **System becomes unresponsive**: Lower the value

---

### Scanners (-s, --scanners)

**Purpose**: Control how many directories are scanned in parallel for faster file discovery.

**Syntax**:
```
-s <number>
--scanners <number>
```

**Default**: `5`
**Range**: `1` to `20`

#### How It Works

The scanner searches for video files across your directory tree. With parallel scanners, multiple directories are explored simultaneously instead of one at a time.

```
Sequential scanning (default before):
  Folder1 → Folder2 → Folder3 → Folder4 → Folder5
  (one at a time)

Parallel scanning (-s 5):
  [Scanner1: Folder1] [Scanner2: Folder2] [Scanner3: Folder3] ...
  (5 folders scanned simultaneously)
```

#### Examples

**Example 1: Default (5 parallel scanners)**
```bash
bun start -- -i "C:\Videos" -r
```
Scans up to 5 directories at once - good balance for local drives.

**Example 2: Single scanner (sequential)**
```bash
bun start -- -i "C:\Videos" -r -s 1
```
Scans one directory at a time. Slowest but most predictable.

**Example 3: Fast local scanning**
```bash
bun start -- -i "C:\Videos" -r -s 10
```
Aggressive scanning for fast SSDs with many subdirectories.

**Example 4: Network drive optimization**
```bash
bun start -- -i "Z:\Archive" -r -s 20
```
Maximum scanners - ideal for network drives where I/O latency is high.

**Example 5: Using long form**
```bash
bun start -- -i "C:\Videos" -r --scanners 15
```
Same as `-s 15`.

#### Performance Guidelines

| Scanners | Best For | I/O Load |
|----------|----------|----------|
| 1-3 | Slow HDDs, limited resources | Low |
| 5 | Local SSDs, balanced approach | Medium |
| 10-15 | Fast NVMe drives, wide directory trees | High |
| 15-20 | Network drives, high-latency storage | Very High |

#### When to Increase Scanners

- **Network/NAS drives**: Higher values (15-20) help overcome network latency
- **Wide directory trees**: Many sibling folders benefit from parallel scanning
- **Fast storage**: SSDs and NVMe can handle more parallel I/O

#### When to Decrease Scanners

- **Slow HDDs**: Too many parallel reads can cause thrashing
- **Limited RAM**: Each scanner uses memory for directory listings
- **Shared storage**: Be considerate of other users on network drives

---

### Dry Run (-d, --dry-run)

**Purpose**: Preview which files would be converted WITHOUT actually converting them.

**Syntax**:
```
-d
--dry-run
```

**Default**: `false` (conversions happen normally)

#### Examples

**Example 1: Preview files in a directory**
```bash
bun start -- -i "C:\Videos" -d
```
Shows what would be converted without doing anything.

**Example 2: Preview with recursive scanning**
```bash
bun start -- -i "C:\Videos" -r -d
```
Shows all files in all subdirectories that would be converted.

**Example 3: Using long form**
```bash
bun start -- -i "C:\Videos" --dry-run
```
Same as `-d`.

#### Why Use Dry Run?

1. **Verify your selection** - Make sure you're targeting the right folder
2. **Check skip logic** - See which files will be skipped (already have .mp3 or .srt)
3. **Estimate the job** - Count how many files will be processed
4. **Safe testing** - Experiment with options without risk

#### Dry Run Output Example

```
DRY RUN MODE - No files will be converted

Scanning: C:\Videos (recursive)

Found 25 video files:
  ✓ Will convert: 18 files
  ○ Skipped (has .mp3): 5 files
  ○ Skipped (has .srt): 2 files

Files to convert:
  1. movie1.mp4 (1.2 GB)
  2. movie2.avi (856 MB)
  3. recording.mkv (2.1 GB)
  ...
```

---

### Verbose Output (-v, --verbose)

**Purpose**: Display detailed FFmpeg output during conversion for debugging.

**Syntax**:
```
-v
--verbose
```

**Default**: `false` (minimal output)

#### Examples

**Example 1: Normal mode (clean interface)**
```bash
bun start -- -i "C:\Videos"
```
Shows progress bars and status without FFmpeg details.

**Example 2: Verbose mode**
```bash
bun start -- -i "C:\Videos" -v
```
Shows FFmpeg's complete output for each conversion.

**Example 3: Using long form**
```bash
bun start -- -i "C:\Videos" --verbose
```
Same as `-v`.

#### When to Use Verbose Mode

- **Debugging failed conversions** - See exactly why FFmpeg failed
- **Checking codec details** - View input file information
- **Learning** - Understand what FFmpeg is doing
- **Troubleshooting audio issues** - Identify codec problems

#### Normal vs Verbose Output

**Normal mode:**
```
● video1.mp4 [████████░░] 80%
● video2.mp4 [██░░░░░░░░] 20%
```

**Verbose mode:**
```
● video1.mp4 [████████░░] 80%
  [ffmpeg] Input #0, mov, from 'video1.mp4':
  [ffmpeg]   Duration: 00:45:32.15, bitrate: 2500 kb/s
  [ffmpeg]   Stream #0:0: Video: h264, 1920x1080
  [ffmpeg]   Stream #0:1: Audio: aac, 48000 Hz, stereo
  [ffmpeg] frame=65432 fps=245 time=00:36:25.00 speed=3.2x
```

---

### Verify Mode (--verify)

**Purpose**: Find incomplete or failed conversions using the database.

**Syntax**:
```
--verify
```

**Default**: `false` (normal conversion mode)

#### How It Works

Verify mode queries the `.ffmpeg-processor.db` database in the input directory to find:
1. **Incomplete conversions**: Status = `processing` (interrupted by shutdown)
2. **Failed conversions**: Status = `failed` (FFmpeg error occurred)

**Note**: The `-r` flag is not needed for verify/cleanup modes since the database tracks all conversions from that directory.

#### Examples

**Example 1: Check for incomplete conversions**
```bash
bun start -- --verify -i "C:\Videos"
```
Queries the database in `C:\Videos` for incomplete/failed conversions.

#### Sample Output

```
=== FFmpeg Processor: Verify Mode ===

Configuration:
  Input:     C:\Videos
  Mode:      Verify (report only)

Checking conversion database...

Results:
  Incomplete (interrupted): 2
  Failed conversions:       1

Incomplete conversions (interrupted):
  Video: C:\Videos\lecture.mp4
    MP3:    C:\Videos\lecture.mp3
    Status: processing
    MP3 exists: Yes (45.2 KB)
    Started: 12/15/2024, 1:30:00 PM

  Video: C:\Videos\meeting.mp4
    MP3:    C:\Videos\meeting.mp3
    Status: processing
    MP3 exists: Yes (12.8 KB)
    Started: 12/15/2024, 1:32:00 PM

Failed conversions:
  Video: C:\Videos\corrupted.mp4
    MP3:    C:\Videos\corrupted.mp3
    Status: failed
    MP3 exists: No
    Error:  Invalid or corrupted input file
    Started: 12/15/2024, 1:25:00 PM

To clean up these conversions, run with --cleanup flag.
```

#### No Database Found

If the directory doesn't have a conversion database:
```
No conversion database found in this directory.
Run a conversion first to create the tracking database.

Database would be created at: C:\Videos/.ffmpeg-processor.db
```

---

### Cleanup Mode (--cleanup)

**Purpose**: Delete partial MP3 files AND remove database records to allow reconversion.

**Syntax**:
```
--cleanup
```

**Default**: `false` (normal conversion mode)

#### How It Works

Cleanup mode:
1. Finds all incomplete (`processing`) and failed conversions in the database
2. Deletes the MP3 files (if they exist)
3. Removes the database records (allows the videos to be reconverted)

Use with `--dry-run` to preview what would be deleted/removed.

#### Examples

**Example 1: Preview cleanup (safe)**
```bash
bun start -- --cleanup --dry-run -i "C:\Videos"
```
Shows what WOULD be deleted without actually doing it.

**Example 2: Actually cleanup**
```bash
bun start -- --cleanup -i "C:\Videos"
```
Deletes partial MP3 files and removes database records.

#### Sample Output (Dry Run)

```
=== FFmpeg Processor: Verify Mode ===

Configuration:
  Input:     C:\Videos
  Mode:      Cleanup (DRY RUN)

Checking conversion database...

Results:
  Incomplete (interrupted): 2
  Failed conversions:       1

...

DRY RUN - Would clean up:
  MP3 files to delete:    2
  DB records to remove:   3

Files that would be deleted:
  [WOULD DELETE] C:\Videos\lecture.mp3
  [WOULD DELETE] C:\Videos\meeting.mp3

Run without --dry-run to actually delete these files.
```

#### Sample Output (Actual Cleanup)

```
Cleaning up suspect conversions...

Cleanup complete:
  MP3 files deleted:     2
  DB records removed:    3

Deleted files:
  [DELETED] C:\Videos\lecture.mp3
  [DELETED] C:\Videos\meeting.mp3

Run the converter again to re-process these videos.
```

#### Typical Workflow

```bash
# Step 1: Find incomplete/failed conversions
bun start -- --verify -i "C:\Videos"

# Step 2: Preview what would be cleaned up
bun start -- --cleanup --dry-run -i "C:\Videos"

# Step 3: Actually cleanup (if preview looks correct)
bun start -- --cleanup -i "C:\Videos"

# Step 4: Re-run conversion to process the videos again
bun start -- -i "C:\Videos" -r
```

---

## Argument Combinations

Here are practical examples combining multiple arguments:

### Basic Combinations

**Convert all videos in a folder:**
```bash
bun start -- -i "C:\Videos"
```

**Convert videos in all subfolders:**
```bash
bun start -- -i "C:\Videos" -r
```

**Preview what would be converted:**
```bash
bun start -- -i "C:\Videos" -d
```

### Intermediate Combinations

**Recursive scan with limited concurrency:**
```bash
bun start -- -i "C:\Videos" -r -c 5
```

**Preview recursive scan:**
```bash
bun start -- -i "C:\Videos" -r -d
```

**Single file processing with verbose output:**
```bash
bun start -- -i "C:\Videos" -c 1 -v
```

### Advanced Combinations

**Full scan, moderate speed, with debugging:**
```bash
bun start -- -i "C:\Videos" -r -c 5 -v
```

**Safe preview of everything:**
```bash
bun start -- -i "C:\Videos" -r -d -v
```

**Maximum throughput (dedicated conversion):**
```bash
bun start -- -i "Z:\VideoArchive" -r -c 25 -s 15
```

**Network drive with fast scanning:**
```bash
bun start -- -i "Z:\Archive" -r -c 10 -s 20
```

**Gentle background processing:**
```bash
bun start -- -i "C:\Videos" -r -c 2 -s 3
```

### Real-World Scenarios

**Scenario 1: First time converting a large archive**
```bash
# Step 1: Preview what will be converted
bun start -- -i "Z:\VideoArchive" -r -d

# Step 2: If looks good, run the actual conversion
bun start -- -i "Z:\VideoArchive" -r
```

**Scenario 2: Converting while working on the computer**
```bash
bun start -- -i "C:\Videos" -r -c 3
```

**Scenario 3: Debugging a problematic video**
```bash
bun start -- -i "C:\ProblemVideos" -c 1 -v
```

**Scenario 4: Quick conversion of a single folder**
```bash
bun start -- -i "C:\Downloads\NewVideos"
```

---

## Understanding the Skip Logic

FFmpeg Processor uses a SQLite database to track conversion status. The database file (`.ffmpeg-processor.db`) is created in the input directory when processing starts.

### Skip Rules

A video file will be **skipped** if:
- Database status = `complete` **AND** the MP3 file still exists
- A `.srt` file exists with the same basename (already transcribed)

A video file will be **converted** if:
- No database record exists (new file)
- Database status = `processing` (interrupted conversion)
- Database status = `failed` (previous attempt failed)
- Database status = `complete` but MP3 is missing (user deleted it)

### Database Status Flow

```
[New video discovered]
        ↓
[FFmpeg starts] → status = 'processing'
        ↓
    Success? ─────┬───── Yes → status = 'complete'
                  └───── No  → status = 'failed'
```

### Examples

```
C:\Videos\
├── lecture.mp4           → CONVERT (no DB record)
├── meeting.mp4           → SKIP (DB status = 'complete', .mp3 exists)
├── meeting.mp3           (successfully converted)
├── interrupted.mp4       → CONVERT (DB status = 'processing')
├── interrupted.mp3       (partial file from interruption)
├── failed.mp4            → CONVERT (DB status = 'failed')
├── presentation.mp4      → SKIP (presentation.srt exists)
├── presentation.srt
├── deleted.mp4           → CONVERT (DB status = 'complete' but .mp3 missing)
└── .ffmpeg-processor.db  (conversion tracking database)
```

### Database Location

The database is created in the **input directory** you specify:
- `bun start -- -i "C:\Videos"` → creates `C:\Videos\.ffmpeg-processor.db`
- `bun start -- -i "Z:\Archive"` → creates `Z:\Archive\.ffmpeg-processor.db`

### Checking Skip Status

Use dry run to see which files will be skipped:

```bash
bun start -- -i "C:\Videos" -d
```

Output shows:
```
Found 10 video files:
  ✓ Will convert: 6 files
  ○ Skipped (has .mp3): 3 files
  ○ Skipped (has .srt): 1 file
```

---

## Keyboard Controls

During conversion, you can control the process:

### Graceful Shutdown (Ctrl+C once)

- Stops adding new jobs to the queue
- Displays a prominent warning banner showing how many workers are finishing
- Lets currently running FFmpeg processes finish
- Exits cleanly after active jobs complete

**When to use**: You need to stop but want to keep partial progress.

### Immediate Shutdown (Ctrl+C twice)

- Kills all running FFmpeg processes immediately
- **Automatically deletes partial output files** (prevents broken MP3s)
- Exits right away

**When to use**: Emergency stop, something went wrong. Partial files are cleaned up automatically.

### Visual Feedback

```
[During normal processing]
Press Ctrl+C to gracefully stop (let active jobs finish)

[After first Ctrl+C - Warning banner appears]
⚠ SHUTTING DOWN - Waiting for 18 active worker(s) to finish...
Press Ctrl+C again to force stop immediately

[After second Ctrl+C]
Immediate shutdown - All processes killed
```

---

## Common Scenarios

### Scenario 1: Preparing Videos for Transcription

You have recorded lectures and want to transcribe them.

```bash
# Preview first
bun start -- -i "C:\Lectures\2024" -r -d

# Then convert
bun start -- -i "C:\Lectures\2024" -r
```

The output MP3s will be small (32kbps mono) - perfect for speech-to-text services.

### Scenario 2: Processing a Network Drive Overnight

You want to convert a large archive while you sleep.

```bash
bun start -- -i "Z:\VideoArchive" -r -c 25 -s 20
```

Maximum workers and scanners for fastest processing on network storage.

### Scenario 3: Converting Specific Folder Without Subfolders

You only want videos in one specific location.

```bash
bun start -- -i "C:\Downloads"
```

No `-r` flag means only the Downloads folder is scanned.

### Scenario 4: Re-running After Partial Completion

You stopped a previous run and want to continue.

```bash
bun start -- -i "C:\Videos" -r
```

The skip logic automatically ignores videos that already have .mp3 files.

### Scenario 5: Debugging a Failed Conversion

A specific video keeps failing.

```bash
bun start -- -i "C:\ProblemVideo" -c 1 -v
```

Single file at a time with verbose output shows exactly what's wrong.

---

## Troubleshooting

### "FFmpeg not found"

**Problem**: FFmpeg is not installed or not in PATH.

**Solutions**:
1. Install FFmpeg from https://ffmpeg.org/
2. Add FFmpeg to your system PATH
3. Verify with: `ffmpeg -version`

### "Input directory not found"

**Problem**: The specified path doesn't exist.

**Solutions**:
1. Check for typos in the path
2. Ensure the drive is mounted (for network drives)
3. Use quotes around paths with spaces

### "Permission denied"

**Problem**: Cannot read videos or write MP3s.

**Solutions**:
1. Run as administrator
2. Check folder permissions
3. Ensure the drive isn't read-only

### Progress stuck at 0%

**Problem**: FFmpeg is running but no progress shows.

**Solutions**:
1. Use `-v` to see FFmpeg output
2. Check if the video file is corrupted
3. Try with a different video to test

### System becomes slow/unresponsive

**Problem**: Too many concurrent conversions.

**Solutions**:
1. Stop the process (Ctrl+C)
2. Restart with lower concurrency: `-c 2` or `-c 3`

### Partial/corrupted MP3 files

**Problem**: Conversion was interrupted, leaving broken MP3 files.

**Solutions**:

**Automatic (built-in)**:
- Database tracks conversion status - interrupted conversions are reconverted automatically
- Double Ctrl+C automatically deletes partial output files
- Files with status = 'processing' (interrupted) are always reconverted

**Manual cleanup**:
```bash
# Step 1: Find incomplete/failed conversions
bun start -- --verify -i "C:\Videos"

# Step 2: Preview what would be cleaned up
bun start -- --cleanup --dry-run -i "C:\Videos"

# Step 3: Delete partial MP3s and reset DB records
bun start -- --cleanup -i "C:\Videos"

# Step 4: Re-run conversion
bun start -- -i "C:\Videos" -r
```

### No database found in verify mode

**Problem**: Running `--verify` shows "No conversion database found".

**Solutions**:
1. Run a normal conversion first - the database is created when processing starts
2. Check that you're pointing to the correct input directory
3. The database file is named `.ffmpeg-processor.db` in the input directory

---

## Quick Reference Card

```
ffmpeg-processor -i <path> [options]

REQUIRED:
  -i, --input <path>      Directory to scan for videos

OPTIONAL:
  -r, --recursive         Scan subdirectories (default: false)
  -c, --concurrency <n>   Parallel FFmpeg workers 1-25 (default: 10)
  -s, --scanners <n>      Parallel directory scanners 1-20 (default: 5)
  -d, --dry-run           Preview without converting (default: false)
  -v, --verbose           Show FFmpeg output (default: false)
  --verify                Find incomplete/failed conversions (database query)
  --cleanup               Delete partial MP3s + DB records (use with -d to preview)

KEYBOARD:
  Ctrl+C (once)           Graceful shutdown (finish active jobs, shows warning)
  Ctrl+C (twice)          Immediate shutdown (kill all + cleanup partial files)

UI LAYOUT:
  Stats bar: Scanner status, Progress, I/O info, Performance metrics
  File list: Sorted by status (running at top, completed fade down)
             Header shows Workers/Done/Failed/Total

PARALLEL STREAMING:
  - Multiple scanners discover files in parallel (-s option)
  - Processing starts immediately as files are found (hot start)
  - Scanning and conversion run concurrently (producer-consumer)
  - Especially effective on network drives or wide directory trees

FORMATS:
  Input:  mp4, avi, mkv, wmv, mov, webm, flv
  Output: MP3 (16kHz mono, 32kbps) - optimized for transcription

DATABASE TRACKING:
  - .ffmpeg-processor.db created in input directory
  - Status: 'processing' → 'complete' or 'failed'
  - Skip logic checks database status, not file size
  - Interrupted conversions (status = 'processing') are reconverted

SKIP LOGIC:
  - Skips videos with DB status = 'complete' (AND .mp3 file exists)
  - Skips videos with .srt files (already transcribed)
  - Reconverts if status = 'processing' or 'failed'
  - Reconverts if .mp3 was deleted (DB record cleaned up automatically)

INCOMPLETE CONVERSION HANDLING:
  - Database tracking: Interrupted = status stays 'processing'
  - Shutdown cleanup: Double Ctrl+C deletes partial files
  - Verify mode: --verify queries DB for incomplete/failed
  - Cleanup mode: --cleanup deletes MP3s + removes DB records
```

---

## Need More Help?

- Check the [README.md](README.md) for a project overview
- Review [CLAUDE.md](CLAUDE.md) for technical architecture details
- Report issues at the project repository
