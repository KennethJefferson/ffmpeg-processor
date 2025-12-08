# OpenTUI + SolidJS TUI Workflow

A complete guide for building Terminal User Interface (TUI) applications using OpenTUI with SolidJS reactivity.

## Overview

This workflow enables you to create beautiful, reactive terminal applications with:
- **SolidJS reactivity** - Signals, memos, effects for efficient updates
- **OpenTUI rendering** - Flexbox layout, colors, text styling
- **Commander.js CLI** - Structured argument parsing
- **Theming system** - Dark/light mode with JSON color definitions
- **Component architecture** - Reusable UI components

---

## 1. Dependencies

### package.json

```json
{
  "name": "your-tui-app",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "your-app": "bin/your-app.js"
  },
  "scripts": {
    "dev": "bun --conditions=browser src/runtime/cli-setup.ts",
    "start": "bun --conditions=browser src/runtime/cli-setup.ts",
    "build": "bun build src/runtime/cli-setup.ts --compile --outfile=your-app"
  },
  "dependencies": {
    "@opentui/core": "0.1.48",
    "@opentui/solid": "0.1.48",
    "commander": "^14.0.1",
    "solid-js": "1.9.9"
  },
  "devDependencies": {
    "@types/bun": "1.3.0",
    "@types/node": "^20.12.7",
    "typescript": "^5.4.5"
  },
  "engines": {
    "node": ">=20.10.0",
    "bun": ">=1.3.0"
  }
}
```

### Library Purposes

| Library | Purpose |
|---------|---------|
| `@opentui/core` | Core TUI rendering engine, layout system, RGBA colors |
| `@opentui/solid` | SolidJS JSX integration, render() function, hooks |
| `solid-js` | Reactive primitives (signals, memos, effects) |
| `commander` | CLI argument parsing and help generation |

---

## 2. Project Structure

```
src/
├── runtime/
│   └── cli-setup.ts              # Entry point: CLI parsing, TUI launch
├── core/
│   ├── types.ts                  # Type definitions
│   ├── [business-logic].ts       # Your core logic
│   └── index.ts                  # Core exports
└── cli/
    ├── index.ts                  # CLI exports
    └── tui/
        ├── app.tsx               # Root app, render() setup
        ├── launcher.ts           # SolidJS preload (CRITICAL)
        ├── component/
        │   ├── logo.tsx          # ASCII art header
        │   ├── progress-bar.tsx  # Progress indicators
        │   ├── [components].tsx  # Your components
        │   └── index.ts
        ├── context/
        │   ├── helper.tsx        # createSimpleContext factory
        │   ├── theme.tsx         # Theme provider
        │   ├── [state].tsx       # Your state context
        │   ├── index.ts
        │   └── theme/
        │       └── [app].json    # Theme colors
        └── routes/
            └── [main].tsx        # Main view
```

---

## 3. Entry Point Chain

The TUI launches through a specific chain:

```
cli-setup.ts → launcher.ts → app.tsx
     ↓              ↓            ↓
  Parse CLI    Preload JSX   Render TUI
```

---

## 4. CRITICAL: SolidJS Preload

**This is the most important pattern.** You MUST import the preload before any TSX files.

### launcher.ts

```typescript
/**
 * TUI Launcher - Registers SolidJS transform before importing components
 */
import type { CLIOptions } from '../../core/types.js';

// CRITICAL: This must happen BEFORE any TSX imports
await import('@opentui/solid/preload');

/**
 * Start the TUI application
 */
export async function startTUI(options: CLIOptions): Promise<void> {
  // Dynamic import AFTER preload is registered
  const { startTUI: start } = await import('./app.js');
  await start(options);
}
```

**Why?** The preload registers the SolidJS JSX transform. Without it, TSX syntax won't compile correctly.

---

## 5. CLI Setup Pattern

### cli-setup.ts

```typescript
import { Command } from 'commander';
import { resolve } from 'node:path';
import type { CLIOptions } from '../core/types.js';

const VERSION = '1.0.0';

function parseOptions(options: Record<string, unknown>): CLIOptions {
  const input = options.input as string | undefined;

  if (!input) {
    console.error('Error: Input is required. Use -i or --input <path>');
    process.exit(1);
  }

  return {
    input: resolve(input),
    recursive: Boolean(options.recursive),
    // ... other options
  };
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
  const program = new Command()
    .name('your-app')
    .version(VERSION)
    .description('Your app description')
    .requiredOption('-i, --input <path>', 'Input path')
    .option('-r, --recursive', 'Recursive mode', false)
    .action(async (options) => {
      const cliOptions = parseOptions(options);

      // Launch TUI (uses preload internally)
      const { startTUI } = await import('../cli/tui/launcher.js');
      await startTUI(cliOptions);
    });

  await program.parseAsync(argv);
}

// Auto-run detection
const isMainModule = process.argv[1]?.includes('cli-setup');
if (isMainModule) {
  runCli().catch((error) => {
    console.error('Fatal error:', error.message);
    process.exitCode = 1;
  });
}
```

---

## 6. App Component & Render

### app.tsx

```typescript
/** @jsxImportSource @opentui/solid */
import { render } from '@opentui/solid';
import { onMount, onCleanup } from 'solid-js';
import { ThemeProvider } from './context/theme.js';
import { YourStateProvider } from './context/your-state.js';
import { MainRoute } from './routes/main.js';
import type { CLIOptions } from '../../core/types.js';

interface AppProps {
  options: CLIOptions;
  mode: 'dark' | 'light';
}

function App(props: AppProps) {
  return (
    <ThemeProvider mode={props.mode}>
      <YourStateProvider options={props.options}>
        <box flexDirection="column" flexGrow={1}>
          <MainRoute />
        </box>
      </YourStateProvider>
    </ThemeProvider>
  );
}

export async function startTUI(options: CLIOptions): Promise<void> {
  const mode = 'dark'; // Or detect from terminal

  // Clear terminal and hide cursor
  process.stdout.write('\x1b[2J\x1b[H\x1b[?25l');

  // Ctrl+C handler
  const handleSigint = () => {
    cleanup();
    process.exit(0);
  };
  process.on('SIGINT', handleSigint);

  const cleanup = () => {
    process.stdout.write('\x1b[?25h'); // Show cursor
    process.stdout.write('\x1b[0m');   // Reset colors
    process.off('SIGINT', handleSigint);
  };

  // Render the app
  const instance = render(
    () => (
      <box
        flexDirection="column"
        width="100%"
        height="100%"
        overflow="hidden"
      >
        <App options={options} mode={mode} />
      </box>
    ),
    {
      fps: 30,              // Refresh rate
      useMouse: false,      // Disable mouse input
      useKittyKeyboard: true // Advanced keyboard handling
    }
  );

  // Wait for exit
  await instance.waitUntilExit();
  cleanup();
}
```

### Render Options

| Option | Value | Purpose |
|--------|-------|---------|
| `fps` | 30 | Frame rate for TUI updates |
| `useMouse` | false | Disable mouse (console-only) |
| `useKittyKeyboard` | true | Enable Kitty terminal protocol |

---

## 7. Context System

### helper.tsx - Context Factory

```typescript
/** @jsxImportSource @opentui/solid */
import { createContext, Show, useContext, type ParentProps } from 'solid-js';

type WithOptionalReady = { ready?: boolean };

/**
 * Create a simple context with provider and hook
 */
export function createSimpleContext<T, Props extends Record<string, any>>(input: {
  name: string;
  init: ((input: Props) => T) | (() => T);
}) {
  const ctx = createContext<T>();

  return {
    provider: (props: ParentProps<Props>) => {
      const init = input.init(props);
      const initWithReady = init as T & WithOptionalReady;
      return (
        <Show when={initWithReady.ready === undefined || initWithReady.ready === true}>
          <ctx.Provider value={init}>{props.children}</ctx.Provider>
        </Show>
      );
    },
    use() {
      const value = useContext(ctx);
      if (!value) throw new Error(`${input.name} context must be used within a provider`);
      return value;
    },
  };
}
```

### theme.tsx - Theme Context

```typescript
/** @jsxImportSource solid-js */
import { RGBA } from '@opentui/core';
import { createMemo } from 'solid-js';
import { createSimpleContext } from './helper.js';
import themeJson from './theme/your-app.json' with { type: 'json' };

export type Theme = {
  primary: RGBA;
  secondary: RGBA;
  error: RGBA;
  warning: RGBA;
  success: RGBA;
  text: RGBA;
  textMuted: RGBA;
  border: RGBA;
  borderSubtle: RGBA;
};

type ThemeJson = {
  defs?: Record<string, string>;
  theme: Record<keyof Theme, string | { dark: string; light: string }>;
};

function resolveTheme(theme: ThemeJson, mode: 'dark' | 'light'): Theme {
  const defs = theme.defs ?? {};

  function resolveColor(c: string | { dark: string; light: string }): RGBA {
    if (typeof c === 'string') {
      return c.startsWith('#') ? RGBA.fromHex(c) : resolveColor(defs[c]);
    }
    return resolveColor(c[mode]);
  }

  return Object.fromEntries(
    Object.entries(theme.theme).map(([key, value]) => [key, resolveColor(value)])
  ) as Theme;
}

export const { use: useTheme, provider: ThemeProvider } = createSimpleContext({
  name: 'Theme',
  init: (props: { mode: 'dark' | 'light' }) => {
    const theme = createMemo(() => resolveTheme(themeJson as ThemeJson, props.mode));
    return {
      get theme() { return theme(); },
      mode: props.mode,
    };
  },
});
```

### Theme JSON (theme/your-app.json)

```json
{
  "defs": {
    "darkPrimary": "#A855F7",
    "darkSecondary": "#C084FC",
    "darkRed": "#ef4444",
    "darkGreen": "#22c55e",
    "darkYellow": "#eab308",
    "darkText": "#f3f4f6",
    "darkMuted": "#9ca3af",
    "darkBorder": "#5a4f7a",
    "darkBorderSubtle": "#473e64"
  },
  "theme": {
    "primary": { "dark": "darkPrimary", "light": "#6d28d9" },
    "secondary": { "dark": "darkSecondary", "light": "#9333ea" },
    "error": { "dark": "darkRed", "light": "darkRed" },
    "warning": { "dark": "darkYellow", "light": "darkYellow" },
    "success": { "dark": "darkGreen", "light": "darkGreen" },
    "text": { "dark": "darkText", "light": "#1e1b2e" },
    "textMuted": { "dark": "darkMuted", "light": "#7c3aed" },
    "border": { "dark": "darkBorder", "light": "#c084fc" },
    "borderSubtle": { "dark": "darkBorderSubtle", "light": "#d8b4fe" }
  }
}
```

---

## 8. Component Patterns

### Progress Bar

```typescript
/** @jsxImportSource @opentui/solid */
import { Show } from 'solid-js';
import { useTheme } from '../context/theme.js';

export interface ProgressBarProps {
  current: number;
  total: number;
  width?: number;
  showPercentage?: boolean;
  showCount?: boolean;
  variant?: 'primary' | 'success' | 'error';
}

export function ProgressBar(props: ProgressBarProps) {
  const { theme } = useTheme();

  const width = () => props.width ?? 40;
  const percentage = () => props.total > 0 ? Math.round((props.current / props.total) * 100) : 0;
  const filledWidth = () => props.total > 0 ? Math.floor((props.current / props.total) * width()) : 0;

  const barColor = () => {
    switch (props.variant) {
      case 'success': return theme.success;
      case 'error': return theme.error;
      default: return theme.primary;
    }
  };

  return (
    <box flexDirection="row" gap={1}>
      <text style={{ fg: theme.borderSubtle }}>│</text>
      <text style={{ fg: barColor() }}>{'█'.repeat(filledWidth())}</text>
      <text style={{ fg: theme.borderSubtle }}>{'░'.repeat(width() - filledWidth())}</text>
      <text style={{ fg: theme.borderSubtle }}>│</text>
      <Show when={props.showPercentage !== false}>
        <text style={{ fg: theme.text }}>{percentage()}%</text>
      </Show>
      <Show when={props.showCount}>
        <text style={{ fg: theme.textMuted }}>({props.current}/{props.total})</text>
      </Show>
    </box>
  );
}
```

### List with Scrolling

```typescript
/** @jsxImportSource @opentui/solid */
import { For, Show, createMemo } from 'solid-js';
import { useTheme } from '../context/theme.js';

export interface ListProps<T> {
  items: T[];
  visibleCount?: number;
  scrollOffset?: number;
  renderItem: (item: T) => JSX.Element;
}

export function ScrollableList<T>(props: ListProps<T>) {
  const { theme } = useTheme();

  const visibleCount = () => props.visibleCount ?? 10;
  const visibleItems = createMemo(() =>
    props.items.slice(props.scrollOffset ?? 0, (props.scrollOffset ?? 0) + visibleCount())
  );
  const hasMore = () => props.items.length > (props.scrollOffset ?? 0) + visibleCount();
  const remainingCount = () => props.items.length - (props.scrollOffset ?? 0) - visibleCount();

  return (
    <box flexDirection="column">
      <Show when={props.items.length > 0} fallback={
        <text style={{ fg: theme.textMuted }}>No items</text>
      }>
        <For each={visibleItems()}>{(item) => props.renderItem(item)}</For>
        <Show when={hasMore()}>
          <text style={{ fg: theme.textMuted }}>... and {remainingCount()} more</text>
        </Show>
      </Show>
    </box>
  );
}
```

### Stats Panel with Borders

```typescript
/** @jsxImportSource @opentui/solid */
import { useTheme } from '../context/theme.js';

export interface StatsPanelProps {
  status: string;
  progress: string;
  activeJobs: number;
  completed: number;
}

export function StatsPanel(props: StatsPanelProps) {
  const { theme } = useTheme();

  return (
    <box flexDirection="column" paddingX={2}>
      <text style={{ fg: theme.border }}>┌─ Statistics ─────────────────────────┐</text>
      <box flexDirection="row">
        <text style={{ fg: theme.border }}>│ </text>
        <text style={{ fg: theme.text }}>Status: </text>
        <text style={{ fg: theme.primary }}>{props.status}</text>
        <text style={{ fg: theme.textMuted }}> │ </text>
        <text style={{ fg: theme.text }}>Progress: </text>
        <text style={{ fg: theme.primary }}>{props.progress}</text>
        <text style={{ fg: theme.border }}> │</text>
      </box>
      <text style={{ fg: theme.border }}>└──────────────────────────────────────┘</text>
    </box>
  );
}
```

---

## 9. Box Model Reference

### Box Properties

| Property | Values | Purpose |
|----------|--------|---------|
| `flexDirection` | `"row"` / `"column"` | Layout direction |
| `flexGrow` | number | Grow to fill space |
| `width` | `"100%"` / number | Element width |
| `height` | `"100%"` / number | Element height |
| `paddingX` | number | Horizontal padding |
| `paddingY` | number | Vertical padding |
| `gap` | number | Space between items |
| `alignItems` | `"center"` / `"flex-start"` / `"flex-end"` | Cross-axis alignment |
| `justifyContent` | `"center"` / `"space-between"` | Main-axis alignment |
| `overflow` | `"hidden"` | Clip overflow |

### Examples

```typescript
// Vertical layout with padding
<box flexDirection="column" paddingX={2} paddingY={1}>

// Horizontal row with gap
<box flexDirection="row" gap={1}>

// Fill remaining space
<box flexGrow={1} />

// Full screen container
<box width="100%" height="100%" overflow="hidden">
```

---

## 10. Text Styling

### Foreground Colors

```typescript
const { theme } = useTheme();

<text style={{ fg: theme.primary }}>Primary color</text>
<text style={{ fg: theme.error }}>Error text</text>
<text style={{ fg: theme.success }}>Success text</text>
<text style={{ fg: theme.textMuted }}>Muted text</text>
```

### Bold Text

```typescript
import { TextAttributes } from '@opentui/core';

<text attributes={TextAttributes.BOLD}>Bold text</text>
```

### Inline Spans

```typescript
<text>
  <span style={{ fg: theme.primary }}>Colored</span>
  <span> normal </span>
  <span style={{ fg: theme.success }}>more color</span>
</text>
```

---

## 11. Reactive Patterns

### Signals

```typescript
import { createSignal } from 'solid-js';

const [count, setCount] = createSignal(0);
const [status, setStatus] = createSignal<'idle' | 'running'>('idle');

// Read
console.log(count());

// Write
setCount(count() + 1);
setStatus('running');
```

### Memos (Computed Values)

```typescript
import { createMemo } from 'solid-js';

const percentage = createMemo(() =>
  total() > 0 ? Math.round((current() / total()) * 100) : 0
);

// Use like a signal
<text>{percentage()}%</text>
```

### Effects

```typescript
import { createEffect, onCleanup } from 'solid-js';

createEffect(() => {
  if (status() === 'running') {
    const timer = setInterval(() => {
      setElapsed(Date.now() - startTime());
    }, 1000);

    onCleanup(() => clearInterval(timer));
  }
});
```

### onMount

```typescript
import { onMount } from 'solid-js';

function MyComponent() {
  onMount(async () => {
    await initialize();
  });

  return <box>...</box>;
}
```

---

## 12. Conditional Rendering

### Show Component

```typescript
import { Show } from 'solid-js';

// Simple condition
<Show when={status() === 'loading'}>
  <text>Loading...</text>
</Show>

// With fallback
<Show when={items().length > 0} fallback={<text>No items</text>}>
  <ItemList items={items()} />
</Show>
```

### For Component (Lists)

```typescript
import { For } from 'solid-js';

<For each={items()}>
  {(item, index) => (
    <box>
      <text>{index() + 1}. {item.name}</text>
    </box>
  )}
</For>
```

---

## 13. Type Definitions Template

### types.ts

```typescript
// CLI Options
export interface CLIOptions {
  input: string;
  recursive: boolean;
  concurrency: number;
  dryRun: boolean;
  verbose: boolean;
}

// Job Status
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// Job Definition
export interface Job {
  id: string;
  inputPath: string;
  outputPath: string;
  status: JobStatus;
  progress: number;
  error?: string;
  startTime?: number;
  endTime?: number;
}

// Application Status
export type AppStatus = 'idle' | 'scanning' | 'processing' | 'completed' | 'cancelled' | 'error';

// Scan Result
export interface ScanResult {
  filesToProcess: string[];
  skipped: number;
  totalFound: number;
}
```

---

## 14. Running Commands

### Development

```bash
# Run from source (with hot reload context)
bun dev -- -i "/path/to/input" -r

# Run from source
bun start -- -i "/path/to/input" -r -c 5
```

### Build

```bash
# Compile to standalone executable
bun run build

# Run compiled executable
./your-app -i "/path/to/input" -r
```

---

## 15. Common Patterns

### Terminal Dimensions

```typescript
import { useTerminalDimensions } from '@opentui/solid';

function ResponsiveComponent() {
  const dimensions = useTerminalDimensions();

  const useCompact = () => (dimensions()?.columns ?? 80) < 60;

  return (
    <Show when={!useCompact()} fallback={<CompactView />}>
      <FullView />
    </Show>
  );
}
```

### Keyboard Hints Footer

```typescript
<box flexGrow={1} />
<box paddingX={2} paddingY={1}>
  <Show when={status() === 'processing'} fallback={
    <text style={{ fg: theme.textMuted }}>Press Ctrl+C to exit</text>
  }>
    <text style={{ fg: theme.textMuted }}>Press Ctrl+C to stop gracefully</text>
  </Show>
</box>
```

### Status Icons

```typescript
function StatusIcon(props: { status: JobStatus }) {
  const { theme } = useTheme();

  const icon = () => {
    switch (props.status) {
      case 'pending': return { char: '○', color: theme.textMuted };
      case 'running': return { char: '●', color: theme.primary };
      case 'completed': return { char: '✓', color: theme.success };
      case 'failed': return { char: '✗', color: theme.error };
      default: return { char: '?', color: theme.textMuted };
    }
  };

  return <text style={{ fg: icon().color }}>{icon().char}</text>;
}
```

---

## Quick Reference

```
CRITICAL IMPORT ORDER:
1. await import('@opentui/solid/preload')  ← MUST be first
2. const { ... } = await import('./app.js') ← Then components

RENDER CONFIG:
render(() => <App />, { fps: 30, useMouse: false, useKittyKeyboard: true })

BOX LAYOUT:
<box flexDirection="column" paddingX={2} gap={1}>

TEXT STYLING:
<text style={{ fg: theme.primary }}>Colored</text>

CONDITIONAL:
<Show when={condition} fallback={<Fallback />}><Content /></Show>

LISTS:
<For each={items()}>{(item) => <Item {...item} />}</For>

SIGNALS:
const [value, setValue] = createSignal(initial);
value()  // read
setValue(newValue)  // write
```
