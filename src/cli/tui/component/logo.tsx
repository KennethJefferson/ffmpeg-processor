/** @jsxImportSource @opentui/solid */
import { TextAttributes, RGBA } from '@opentui/core';
import { For, Show, type JSX } from 'solid-js';
import { useTheme } from '../context/theme.js';
import { useTerminalDimensions } from '@opentui/solid';

// Full ASCII art logo
const FFMPEG_TEXT = [
  '  ███████╗███████╗███╗   ███╗██████╗ ███████╗ ██████╗ ',
  '  ██╔════╝██╔════╝████╗ ████║██╔══██╗██╔════╝██╔════╝ ',
  '  █████╗  █████╗  ██╔████╔██║██████╔╝█████╗  ██║  ███╗',
  '  ██╔══╝  ██╔══╝  ██║╚██╔╝██║██╔═══╝ ██╔══╝  ██║   ██║',
  '  ██║     ██║     ██║ ╚═╝ ██║██║     ███████╗╚██████╔╝',
  '  ╚═╝     ╚═╝     ╚═╝     ╚═╝╚═╝     ╚══════╝ ╚═════╝ ',
];

const PROCESSOR_TEXT = [
  '  ██████╗ ██████╗  ██████╗  ██████╗███████╗███████╗███████╗ ██████╗ ██████╗ ',
  '  ██╔══██╗██╔══██╗██╔═══██╗██╔════╝██╔════╝██╔════╝██╔════╝██╔═══██╗██╔══██╗',
  '  ██████╔╝██████╔╝██║   ██║██║     █████╗  ███████╗███████╗██║   ██║██████╔╝',
  '  ██╔═══╝ ██╔══██╗██║   ██║██║     ██╔══╝  ╚════██║╚════██║██║   ██║██╔══██╗',
  '  ██║     ██║  ██║╚██████╔╝╚██████╗███████╗███████║███████║╚██████╔╝██║  ██║',
  '  ╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚══════╝╚══════╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝',
  '        ▸▸▸  Video → MP3  ▸▸▸  Batch Converter  ▸▸▸  🎵                     ',
];

// Compact version for narrow terminals
const SIMPLE_TEXT = [
  '█▀▀ █▀▀ █▀▄▀█ █▀█ █▀▀ █▀▀   █▀█ █▀█ █▀█ █▀▀ █▀▀ █▀ █▀ █▀█ █▀█',
  '█▀  █▀  █ ▀ █ █▀▀ ██▄ █▄█   █▀▀ █▀▄ █▄█ █▄▄ ██▄ ▄█ ▄█ █▄█ █▀▄',
];

// Helper to render a line with two-tone coloring
function ColoredLine(props: { line: string; blockColor: RGBA; borderColor: RGBA; bold?: boolean }) {
  const segments: JSX.Element[] = [];
  let currentSegment = '';
  let currentType: 'block' | 'border' | null = null;

  const finishSegment = () => {
    if (currentSegment) {
      const color = currentType === 'block' ? props.blockColor : props.borderColor;
      segments.push(<span style={{ fg: color }}>{currentSegment}</span>);
      currentSegment = '';
    }
  };

  for (const char of props.line) {
    const isBlock = char === '█';
    const isBorder = '╔═╗║╚╝╠╣╦╩╬'.includes(char);
    const charType = isBlock ? 'block' : isBorder ? 'border' : null;

    if (charType !== currentType) {
      finishSegment();
      currentType = charType;
    }

    currentSegment += char;
  }

  finishSegment();

  return (
    <box>
      <text attributes={props.bold ? TextAttributes.BOLD : 0}>{segments}</text>
    </box>
  );
}

export function Logo() {
  const { theme } = useTheme();
  const dimensions = useTerminalDimensions();

  // Choose logo variant based on terminal size
  const useCompact = () => {
    const width = dimensions()?.columns ?? 80;
    const height = dimensions()?.rows ?? 24;
    return width < 80 || height < 20;
  };

  const useTall = () => {
    const height = dimensions()?.rows ?? 24;
    return height >= 30;
  };

  return (
    <box flexDirection="column" alignItems="center" paddingY={1}>
      <Show
        when={!useCompact()}
        fallback={
          <box flexDirection="column">
            <For each={SIMPLE_TEXT}>
              {(line) => (
                <ColoredLine line={line} blockColor={theme.primary} borderColor={theme.secondary} bold />
              )}
            </For>
          </box>
        }
      >
        <Show
          when={useTall()}
          fallback={
            // Side by side for medium height terminals
            <box flexDirection="column">
              <For each={FFMPEG_TEXT}>
                {(line) => (
                  <ColoredLine line={line} blockColor={theme.primary} borderColor={theme.secondary} bold />
                )}
              </For>
              <text style={{ fg: theme.textMuted }}>{'  ▸▸▸  Video → MP3  ▸▸▸  Batch Converter  ▸▸▸  🎵'}</text>
            </box>
          }
        >
          {/* Stacked for tall terminals */}
          <box flexDirection="column">
            <For each={FFMPEG_TEXT}>
              {(line) => (
                <ColoredLine line={line} blockColor={theme.primary} borderColor={theme.secondary} bold />
              )}
            </For>
            <box height={1} />
            <For each={PROCESSOR_TEXT}>
              {(line) => (
                <ColoredLine line={line} blockColor={theme.secondary} borderColor={theme.violet} />
              )}
            </For>
          </box>
        </Show>
      </Show>
    </box>
  );
}
