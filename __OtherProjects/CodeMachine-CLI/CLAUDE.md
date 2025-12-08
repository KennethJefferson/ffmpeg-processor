# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is CodeMachine?

CodeMachine is a CLI-native orchestration engine that runs coordinated multi-agent workflows. It coordinates multiple AI CLI engines (Claude Code, Codex, Cursor, etc.) to execute complex development tasks from specifications.

## Development Commands

```bash
# Development (runs from source, no build needed)
bun dev                    # Run with DEBUG=true
bun start                  # Run normally

# Quality checks
bun lint                   # ESLint with zero warnings tolerance
bun typecheck              # TypeScript type checking
bun test                   # Run tests
bun test:watch             # Run tests in watch mode

# Production build
bun build                  # Build platform-specific executables
```

## Architecture Overview

### Source Structure (`src/`)

- **`agents/`** - Agent execution and coordination
  - `coordinator/` - Multi-agent orchestration with parallel (`&`) and sequential (`&&`) execution parsing
  - `runner/` - Low-level agent execution, handles engine auth caching, monitoring, memory storage
  - `memory/` - Agent memory persistence (`.codemachine/memory/`)
  - `monitoring/` - Agent status tracking, logging, SQLite-based registry

- **`infra/engines/`** - AI engine provider implementations
  - `core/` - Base engine interface, factory, and registry
  - `providers/` - Individual engine implementations (claude, codex, cursor, ccr, auggie, opencode)
  - Each provider has: `auth.ts`, `execution/`, `metadata.ts`, `telemetryParser.ts`

- **`workflows/`** - Workflow template system
  - `execution/step.ts` - Executes workflow steps, loads/processes prompts
  - `templates/` - Workflow template definitions

- **`cli/`** - Command-line interface
  - `commands/` - Individual command implementations (start, run, step, agents, auth, templates)
  - `tui/` - Terminal UI components and state management (uses Ink/React)

- **`ui/`** - UI management layer for workflow visualization

### Configuration (`config/`)

- `main.agents.js` - Main workflow agents (architecture, planning, code generation, etc.)
- `sub.agents.js` - Specialized sub-agents (frontend-dev, backend-dev, qa-engineer, etc.)
- `modules.js` - Special workflow modules with behaviors (loop, trigger)
- `placeholders.js` - Dynamic placeholders for prompt templates

### Prompt Templates (`prompts/templates/`)

- `codemachine/` - Core workflow agent prompts
- `dev-codemachine/` - Development/meta agent prompts
- `test-workflows/` - Test agent prompts

## Key Concepts

### Agent Execution Flow
1. Workflow step loaded from template
2. Prompt template processed with placeholders (`processPromptString()`)
3. `executeAgent()` handles: engine auth (cached 5min), monitoring registration, engine execution
4. Output stored in memory, monitoring updated

### Engine Registry
Engines are registered and selected by priority. Auth status is cached globally to avoid repeated 10-30 second auth checks when spawning subagents.

### Coordination DSL
- `agent1 & agent2` - parallel execution
- `agent1 && agent2` - sequential execution

## Project Workspace

When run, CodeMachine creates `.codemachine/` in the project directory containing:
- `inputs/specifications.md` - User specifications
- `agents/` - Agent configurations
- `plan/` - Planning artifacts
- `memory/` - Agent execution memory
- `prompts/` - Generated prompts

## Environment

- Node.js >= 20.10.0
- Bun 1.3.3 (preferred runtime)
- Requires at least one authenticated AI CLI engine
