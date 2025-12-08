/**
 * TUI Launcher
 *
 * Registers the SolidJS transform before importing TUI components.
 */

import type { CLIOptions } from '../../core/types.js';

// Register OpenTUI SolidJS transform
// This must happen before any TSX imports
await import('@opentui/solid/preload');

/**
 * Start the TUI application
 */
export async function startTUI(options: CLIOptions): Promise<void> {
  // Dynamically import app after transform is registered
  const { startTUI: start } = await import('./app.js');
  await start(options);
}
