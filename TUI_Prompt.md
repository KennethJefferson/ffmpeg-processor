# TUI Application Prompt Template

Use this prompt template to instruct Claude Code to create a TUI application using the OpenTUI + SolidJS workflow.

---

## Before You Start

### Prerequisites Checklist

- [ ] Bun 1.3+ installed (`bun --version`)
- [ ] Clear idea of what your CLI app should do
- [ ] Know the CLI options you need (input paths, flags, settings)
- [ ] Read `Workflow.md` for technical reference

---

## Prompt Template

Copy and customize this prompt for Claude Code:

```
Create a TUI (Terminal User Interface) application using OpenTUI + SolidJS.

## Application Details

**Name**: [YOUR_APP_NAME]
**Purpose**: [WHAT IT DOES]
**Primary Color**: [HEX COLOR, e.g., #A855F7 for violet]

## CLI Options

Required:
- -i, --input <path>: [DESCRIPTION]

Optional:
- -r, --recursive: [DESCRIPTION]
- -c, --concurrency <n>: [DESCRIPTION]
- -d, --dry-run: [DESCRIPTION]
- [ADD MORE AS NEEDED]

## Core Features

1. [FEATURE 1]
2. [FEATURE 2]
3. [FEATURE 3]

## UI Components Needed

- [ ] ASCII Logo header
- [ ] Progress bar (overall)
- [ ] File/item list with status icons
- [ ] Statistics panel
- [ ] Footer with keyboard hints

## Reference

Use the patterns from `Workflow.md` in this project:
- Entry point chain: cli-setup.ts → launcher.ts → app.tsx
- CRITICAL: Import @opentui/solid/preload before any TSX
- Context system with createSimpleContext()
- Theme JSON with dark/light mode support
- SolidJS reactive patterns (signals, memos, effects)

## Directory Structure

Follow this structure:
```
src/
├── runtime/cli-setup.ts
├── core/types.ts, [logic].ts
└── cli/tui/
    ├── app.tsx, launcher.ts
    ├── component/
    ├── context/
    └── routes/
```

## Technical Requirements

- Use Bun as runtime
- TypeScript with strict mode
- OpenTUI 0.1.48 + SolidJS 1.9.9
- Commander.js for CLI parsing
- Graceful Ctrl+C shutdown handling
```

---

## Example: File Converter App

```
Create a TUI application using OpenTUI + SolidJS.

## Application Details

**Name**: image-optimizer
**Purpose**: Batch optimize images in a directory using sharp
**Primary Color**: #10B981 (emerald green)

## CLI Options

Required:
- -i, --input <path>: Directory containing images to optimize

Optional:
- -r, --recursive: Process subdirectories
- -q, --quality <n>: JPEG quality 1-100 (default: 80)
- -f, --format <type>: Output format: jpeg, png, webp (default: jpeg)
- -d, --dry-run: Preview without processing

## Core Features

1. Scan directory for image files (jpg, png, gif, webp)
2. Skip already-optimized images (check for .optimized marker)
3. Process images in parallel (configurable concurrency)
4. Show before/after file sizes
5. Calculate total space saved

## UI Components Needed

- [x] ASCII Logo header (IMAGE OPTIMIZER)
- [x] Progress bar with percentage and count
- [x] File list showing: pending, processing, completed, failed
- [x] Stats panel: files processed, space saved, time elapsed
- [x] Footer: Ctrl+C hints

## Reference

Use the patterns from `Workflow.md` in this project.
```

---

## Customization Points

### Theme Colors

| Use Case | Suggested Color |
|----------|-----------------|
| Video/Media | Violet `#A855F7` |
| Images | Emerald `#10B981` |
| Data/Analytics | Blue `#3B82F6` |
| Security | Red `#EF4444` |
| Files/Docs | Amber `#F59E0B` |
| Network | Cyan `#06B6D4` |

### Common CLI Patterns

```
# File processor
-i, --input <path>     Input directory
-o, --output <path>    Output directory
-r, --recursive        Process subdirectories
-c, --concurrency <n>  Parallel workers

# Converter
-f, --format <type>    Output format
-q, --quality <n>      Quality setting

# General
-d, --dry-run          Preview mode
-v, --verbose          Show detailed output
--force                Overwrite existing
```

### UI Component Options

**Logo Styles**:
- Block letters (█ characters)
- Outline letters (box-drawing characters)
- Simple text header

**Progress Indicators**:
- Full progress bar with percentage
- Mini progress bar in file list
- Spinner for indeterminate progress

**List Item States**:
- ○ Pending (muted)
- ● Running (primary color)
- ✓ Completed (green)
- ✗ Failed (red)
- ⊘ Cancelled (yellow)

---

## Post-Generation Checklist

After Claude Code generates the app:

1. [ ] Verify `@opentui/solid/preload` is imported first in launcher.ts
2. [ ] Check package.json has correct dependencies
3. [ ] Run `bun install` to install dependencies
4. [ ] Test with `bun start -- -i <test-path> --dry-run`
5. [ ] Verify Ctrl+C graceful shutdown works
6. [ ] Check theme colors render correctly

---

## Troubleshooting

### "Export not found" errors
- Ensure launcher.ts uses `await import('@opentui/solid/preload')` before any TSX
- Use dynamic imports for app.tsx: `const { startTUI } = await import('./app.js')`

### Build fails with JSX errors
- Run from source with `bun start` instead of building
- The `--compile` flag may have JSX runtime issues

### Colors not showing
- Check terminal supports true color (most modern terminals do)
- Verify theme JSON has valid hex colors
- Use RGBA.fromHex() for color parsing

### Progress not updating
- Ensure state changes use setSignal(), not direct mutation
- Check effects have proper dependencies
- Verify render fps is set (default: 30)
