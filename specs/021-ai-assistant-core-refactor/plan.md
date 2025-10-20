# Implementation Plan: AI Assistant Core Refactoring

**Branch**: `021-ai-assistant-core-refactor` | **Date**: 2025-10-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/021-ai-assistant-core-refactor/spec.md`

## Summary

Refactor the monolithic 1605-line AI assistant implementation in lama.electron to a component-based architecture with platform-agnostic business logic in lama.core. This follows the handler pattern already established in lama.core where handlers receive dependencies via constructor injection and contain zero platform-specific imports. The refactoring splits AI functionality into focused components (AITopicManager, AIMessageProcessor, AIPromptBuilder, AIContactManager, AITaskManager) while maintaining all existing features and external API contracts.

## Technical Context

**Language/Version**: TypeScript 5.x (both lama.core and lama.electron)
**Primary Dependencies**:
- `@refinio/one.core` - Core recipes, crypto, storage, hashing
- `@refinio/one.models` - Domain models (ChannelManager, TopicModel, LeuteModel)
- `electron` (lama.electron only) - IPC, BrowserWindow events

**Storage**: ONE.core versioned object storage (file-based in Node.js, IndexedDB in browser)
**Testing**: Jest (existing test infrastructure in lama.electron)
**Target Platform**: Multi-platform - Node.js (Electron main process), Browser (future), React Native (future)
**Project Type**: Dual-package monorepo
- `lama.core/` - Platform-agnostic business logic
- `lama.electron/` - Electron-specific adapters and IPC handlers

**Performance Goals**:
- AI response streaming maintains current <100ms first token latency
- Component instantiation <10ms overhead vs current implementation
- Message processing throughput unchanged (current: ~50 msgs/sec)

**Constraints**:
- Zero breaking changes to IPC handler signatures or event contracts
- All existing AI features must work identically (welcome messages, analysis, context enrichment, default chats)
- Refactoring must be incrementally testable (no big-bang migration)
- Components must work without Electron-specific APIs (no BrowserWindow, no ipcMain imports in core)

**Scale/Scope**:
- 1605 lines → 5-6 components averaging <300 lines each
- 10 functional requirements to maintain
- 7 measurable success criteria
- Affects ~15 IPC handlers in lama.electron

## Constitution Check

*GATE: No project-specific constitution found. Using architectural principles from CLAUDE.md.*

### Architectural Principles (from CLAUDE.md)

✅ **Platform Separation**:
- lama.core contains platform-agnostic handlers with NO ambient pattern
- lama.electron creates instances with injected dependencies
- **Status**: This refactoring directly enforces this principle

✅ **Dependency Injection**:
- Handlers receive dependencies via constructor (no global state)
- **Status**: Core requirement (FR-003)

✅ **Fail Fast**:
- No fallbacks, fix problems not work around them
- **Status**: Refactoring will use proper TypeScript types and error handling

✅ **Single Responsibility**:
- Components have focused, clearly defined responsibilities
- **Status**: Core requirement (FR-002)

### Gates

| Gate | Status | Notes |
|------|--------|-------|
| Zero lama.electron imports in lama.core | REQUIRED | FR-001, verified via static analysis (SC-003) |
| All components <400 lines | REQUIRED | SC-004, enforces single responsibility |
| IPC handlers <100 lines (thin adapters) | REQUIRED | SC-006, enforces handler pattern |
| All existing features work identically | REQUIRED | SC-005, regression testing |
| No breaking API changes | REQUIRED | FR-010, contract preservation |

**Result**: ✅ PASS - All gates are requirements in the spec

## Project Structure

### Documentation (this feature)

```
specs/021-ai-assistant-core-refactor/
├── plan.md              # This file
├── research.md          # Phase 0: Component boundaries, dependency injection patterns
├── data-model.md        # Phase 1: Component architecture, dependency graph
├── quickstart.md        # Phase 1: Developer guide for using refactored components
├── contracts/           # Phase 1: Component interfaces, IPC contracts
│   ├── ai-handler.ts    # AIHandler interface (lama.core)
│   ├── components.ts    # Component interfaces and dependencies
│   └── ipc-contracts.ts # IPC handler signatures (must remain unchanged)
└── tasks.md             # Phase 2: Created by /speckit.tasks
```

### Source Code (repository root)

```
lama.core/
├── handlers/
│   ├── AIHandler.ts              # NEW: Main AI handler orchestrator
│   └── (existing handlers remain unchanged)
├── services/
│   ├── llm-manager.ts            # MOVED from lama.electron (refactored)
│   ├── ollama.ts                 # ALREADY EXISTS (platform-agnostic HTTP)
│   ├── lmstudio.ts               # ALREADY EXISTS (platform-agnostic HTTP)
│   └── claude.ts                 # ALREADY EXISTS (platform-agnostic HTTP)
├── models/
│   └── ai/                       # NEW: AI assistant components
│       ├── AITopicManager.ts     # Topic lifecycle, mappings, loading states
│       ├── AIMessageProcessor.ts # Message queuing, processing, LLM invocation
│       ├── AIPromptBuilder.ts    # Context assembly, prompt construction
│       ├── AIContactManager.ts   # AI contact creation (Person/Profile/Someone)
│       ├── AITaskManager.ts      # Task associations, subject channel
│       └── index.ts              # Component exports
└── one-ai/
    └── (existing topic analysis - unchanged)

lama.electron/
├── main/
│   ├── core/
│   │   └── node-one-core.ts           # Unchanged - instantiates handlers
│   ├── ipc/handlers/
│   │   ├── ai.ts                      # REFACTORED: Thin adapter to AIHandler
│   │   ├── chat.ts                    # MODIFIED: Use AIHandler for AI topics
│   │   └── llm.ts                     # REFACTORED: Delegate to LLMManager in core
│   └── services/
│       ├── llm-manager.js             # REMOVED (moved to lama.core)
│       └── ai-assistant-model.ts      # REMOVED (replaced by AIHandler)
└── tests/
    └── ai-assistant/                   # NEW: Component tests
        ├── topic-manager.test.ts
        ├── message-processor.test.ts
        ├── prompt-builder.test.ts
        ├── contact-manager.test.ts
        └── integration.test.ts         # End-to-end AI assistant tests

reference/lama/src/models/ai/assistant/
└── (reference implementation - inspiration only, may be outdated)
```

**Structure Decision**: Dual-package approach with clear separation:

1. **lama.core** receives all business logic:
   - `handlers/AIHandler.ts` - Main orchestrator (receives NodeOneCore, ChannelManager, etc.)
   - `models/ai/*` - Focused components with single responsibilities
   - `services/llm-manager.ts` - Moved from lama.electron, refactored to be platform-agnostic

2. **lama.electron** keeps only platform-specific code:
   - IPC handlers become <100 line thin adapters
   - Instantiate AIHandler with NodeOneCore and other dependencies
   - Wire component events to Electron UI (BrowserWindow)

3. **Migration Strategy**:
   - Reference implementation in `reference/lama` provides component boundaries
   - Adapt patterns to current architecture (don't copy blindly)
   - Incremental: Create components one at a time, test, then wire into handler

## Complexity Tracking

*No constitution violations - this refactoring enforces existing architectural principles.*

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| AI Assistant LOC | 1605 | ~1800 (split into 6 components) | +12% (better organized) |
| Largest component | 1605 lines | <400 lines | -75% complexity per file |
| Platform coupling | High (Electron imports in business logic) | Zero (core has no platform imports) | Eliminated |
| Component testability | Low (monolithic, mocked Electron) | High (isolated, mocked dependencies) | Vastly improved |
| Code duplication for new platforms | 100% (would need to rewrite) | 0% (reuse core components) | Eliminated |

