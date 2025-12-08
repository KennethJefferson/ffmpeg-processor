/** @jsxImportSource @opentui/solid */
import { render } from '@opentui/solid';
import { onMount, onCleanup } from 'solid-js';
import { ThemeProvider } from './context/theme.js';
import { ProcessorStateProvider, useProcessorState } from './context/processor-state.js';
import { ProcessingRoute } from './routes/processing.js';
import type { CLIOptions } from '../../core/types.js';

// Global shutdown handler reference
let globalShutdownHandler: (() => void) | null = null;

export function setShutdownHandler(handler: () => void) {
  globalShutdownHandler = handler;
}

export function triggerShutdown() {
  if (globalShutdownHandler) {
    globalShutdownHandler();
  }
}

interface AppProps {
  options: CLIOptions;
  mode: 'dark' | 'light';
}

/**
 * Inner app component that has access to processor state
 */
function AppInner() {
  const state = useProcessorState();

  // Register shutdown handler on mount
  onMount(() => {
    setShutdownHandler(() => {
      state.requestShutdown();
    });
  });

  onCleanup(() => {
    globalShutdownHandler = null;
  });

  return <ProcessingRoute />;
}

/**
 * Root application component
 */
function App(props: AppProps) {
  return (
    <ThemeProvider mode={props.mode}>
      <ProcessorStateProvider options={props.options}>
        <box flexDirection="column" flexGrow={1}>
          <AppInner />
        </box>
      </ProcessorStateProvider>
    </ThemeProvider>
  );
}

/**
 * Detect terminal background color and return mode
 */
async function detectTerminalMode(): Promise<'dark' | 'light'> {
  // Default to dark mode - most terminals are dark
  return 'dark';
}

/**
 * Start the TUI application
 */
export async function startTUI(options: CLIOptions): Promise<void> {
  // Detect terminal mode
  const mode = await detectTerminalMode();

  // Clear terminal and hide cursor
  process.stdout.write('\x1b[2J\x1b[H\x1b[?25l');

  // Set up Ctrl+C handler
  const handleSigint = () => {
    if (globalShutdownHandler) {
      globalShutdownHandler();
    } else {
      // If no processor running, just exit
      cleanup();
      process.exit(0);
    }
  };

  process.on('SIGINT', handleSigint);

  // Cleanup function
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
        {/* Main app */}
        <App options={options} mode={mode} />
      </box>
    ),
    {
      fps: 30,
      useMouse: false,
      useKittyKeyboard: true,
    }
  );

  // Wait for render to complete
  await instance.waitUntilExit();

  // Cleanup
  cleanup();
}
