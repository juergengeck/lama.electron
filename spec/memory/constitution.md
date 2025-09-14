# LAMA Electron Constitution

## Core Principles

### I. Single ONE.core Architecture (NON-NEGOTIABLE)
- ONE instance runs in Node.js ONLY (main process)
- Browser (renderer) is UI ONLY - NO ONE.core imports
- ALL data operations via IPC - no exceptions
- NO fallbacks, NO mitigation - fix the root cause

### II. Fail Fast Philosophy
- No delays, no retries without understanding
- Throw errors immediately when things go wrong
- Fix problems at the source, don't work around them
- If IPC fails, operations fail - period

### III. IPC-First Communication
- Browser communicates ONLY through electronAPI.invoke()
- All models (AppModel, LeuteModel, ChannelManager) live in Node.js
- Authentication handled by Node.js SingleUserNoAuth
- Clear contract definitions for all IPC handlers

### IV. Test-Driven Development
- Tests written before implementation
- Integration tests for all IPC handlers
- Real dependencies (actual file system, real ONE.core)
- NO mocks unless absolutely necessary

### V. Simplicity & Clarity
- Use what exists before creating new things
- One source of truth (Node.js ONE.core)
- Clear separation: Browser = UI, Node = Logic
- No complex federation when simple IPC suffices

## Architecture Constraints

### Process Separation
- **Main Process** (Node.js):
  - Location: `/main/`
  - Uses CommonJS (`require`)
  - Runs ONE.core instance
  - File system access
  - All business logic

- **Renderer Process** (Browser):
  - Location: `/electron-ui/`
  - Uses ESM (`import`)
  - UI components only
  - NO direct ONE.core access
  - NO file system access

### Authentication Flow
1. User enters credentials in browser UI
2. Browser calls `onecore:initializeNode` via IPC
3. Node.js initializes ONE.core with SingleUserNoAuth
4. Node.js ONE.core handles all subsequent operations

## Development Workflow

### Feature Development
1. Use `/specify` command to create specification
2. Use `/plan` command to design implementation
3. Use `/tasks` command to generate tasks
4. Follow TDD: write failing tests first
5. Implement to make tests pass
6. Run lint and typecheck before completion

### Common Issues & Solutions
- **"User not authenticated"**: User must log in via UI first
- **"AppModel not found"**: Remove from browser, use IPC instead
- **"Federation timeout"**: Check for ONE.core in browser (remove it)

### Key Files
- `/main/core/node-one-core.js` - Single ONE.core instance
- `/main/ipc/handlers/` - All IPC handler implementations
- `/electron-ui/src/services/browser-init.ts` - UI initialization
- `/electron-ui/src/bridge/lama-bridge.ts` - IPC bridge

## Governance

- This constitution supersedes all other practices
- Changes require documentation of rationale
- CLAUDE.md provides runtime guidance
- All code must follow these principles

**Version**: 1.0.0 | **Ratified**: 2025-09-11 | **Last Amended**: 2025-09-11