# Feature Specification: AI Assistant Core Refactoring

**Feature Branch**: `021-ai-assistant-core-refactor`
**Created**: 2025-10-20
**Status**: Draft
**Input**: User description: "we must refactor ai assistant and we can use reference/lama as a template. the template may be inacurate and outdated, beware. to objective is to move llm manager and ai assistant to lama.core after the refactoring, so plans and changes we make should assume that"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Platform-Agnostic AI Components (Priority: P1)

Developers can use AI assistant and LLM management functionality in any platform (Electron, Browser, React Native) without duplicating business logic. The AI assistant components work identically whether called from Node.js (Electron main process) or browser environments (Web Workers, service workers).

**Why this priority**: This is the foundational requirement that enables all other improvements. Without proper separation, any future platform support requires duplicating and maintaining parallel implementations. This creates the architecture that prevents technical debt.

**Independent Test**: Can be fully tested by importing and instantiating AI assistant handlers in both a Node.js script and a browser test environment, verifying they accept the same dependencies via constructor and execute the same business logic successfully.

**Acceptance Scenarios**:

1. **Given** an Electron app with AI assistant, **When** a developer imports ChatHandler from lama.core, **Then** the handler instantiates successfully with only ONE.core dependencies (no Electron-specific imports required)
2. **Given** a browser-based LAMA app, **When** a developer imports the same ChatHandler from lama.core, **Then** the handler works identically with browser-compatible ONE.core instance
3. **Given** lama.core handlers in production, **When** examining import statements, **Then** zero imports reference lama.electron or platform-specific modules

---

### User Story 2 - Component-Based AI Architecture (Priority: P2)

Developers can modify specific AI functionality (topic management, message processing, prompt building) without understanding or risking changes to unrelated AI features. Each AI component has a single, clearly defined responsibility.

**Why this priority**: Reduces cognitive load and change risk for developers. A 1605-line monolithic class makes even simple changes dangerous. Component-based architecture enables safe, incremental improvements and easier testing.

**Independent Test**: Can be tested by modifying prompt building logic (e.g., changing context window calculation) and verifying that topic management and contact management behavior remains completely unchanged (no cascading effects).

**Acceptance Scenarios**:

1. **Given** the refactored AI assistant, **When** a developer needs to change how prompts are constructed, **Then** they only modify files in the prompt builder component without touching message processor or topic manager
2. **Given** isolated AI components, **When** running unit tests for AITopicManager, **Then** tests execute without requiring LLM services or message processing logic
3. **Given** the component architecture, **When** reviewing code for topic display name changes, **Then** the relevant logic exists in exactly one component (AITopicManager) with no duplication

---

### User Story 3 - Consistent Handler Pattern (Priority: P3)

Platform-specific code (Electron IPC handlers, browser API handlers) follows a consistent thin-adapter pattern where handlers instantiate lama.core components with injected dependencies and delegate all business logic.

**Why this priority**: Establishes a maintainable pattern for future features. Once the pattern is proven with AI assistant refactoring, it can be applied to other handlers (chat, contacts, export) reducing overall codebase complexity.

**Independent Test**: Can be tested by examining any IPC handler and verifying it contains <50 lines of code, performs only dependency injection and method delegation, and contains zero business logic or conditional statements.

**Acceptance Scenarios**:

1. **Given** the refactored Electron IPC handlers, **When** examining main/ipc/handlers/ai.ts, **Then** the file contains only component instantiation, dependency injection, and method calls to lama.core handlers
2. **Given** a business logic change (e.g., welcome message generation), **When** implementing the change, **Then** developers modify only lama.core files without touching any platform-specific IPC handlers
3. **Given** the handler pattern, **When** adding a new AI feature, **Then** developers can implement it by adding methods to lama.core handlers and exposing them via thin IPC adapters

---

### Edge Cases

- What happens when a component depends on functionality from another component (e.g., AIMessageProcessor needs AIPromptBuilder)?
  - Solution: Components accept dependencies via constructor injection. Circular dependencies are broken using interfaces or delayed initialization.

- How does the system handle platform-specific requirements (e.g., Electron BrowserWindow for progress events)?
  - Solution: Platform-specific concerns remain in lama.electron adapters. Core handlers use callbacks/events that platforms can wire to their UI frameworks.

- What happens when the reference implementation in reference/lama is outdated or incorrect?
  - Solution: Use reference implementation as inspiration for component boundaries, not as code to copy directly. Adapt patterns to match current lama.electron capabilities and architectural decisions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST separate AI assistant business logic into platform-agnostic handlers in lama.core that depend only on @refinio/one.core and @refinio/one.models
- **FR-002**: System MUST organize AI functionality into focused components with single responsibilities: AITopicManager (topic lifecycle), AIMessageProcessor (message handling), AIPromptBuilder (context/prompts), AIContactManager (AI contact creation), AITaskManager (task associations)
- **FR-003**: All lama.core handlers MUST receive dependencies via constructor parameters with NO ambient imports or global state
- **FR-004**: lama.electron IPC handlers MUST act as thin adapters that instantiate lama.core handlers with dependencies and delegate method calls
- **FR-005**: System MUST maintain all existing AI assistant functionality during refactoring (topic management, message processing, welcome messages, context enrichment, analysis, default chats)
- **FR-006**: LLM service implementations (ollama.ts, lmstudio.ts, claude.ts) MUST move to lama.core/services with platform-agnostic HTTP client usage
- **FR-007**: LLM manager orchestration logic MUST move to lama.core with provider abstraction that works in Node.js and browser environments
- **FR-008**: System MUST break component circular dependencies using constructor injection, interfaces, or setter methods for delayed dependencies
- **FR-009**: Platform-specific code (Electron BrowserWindow events, IPC mechanisms) MUST remain isolated in lama.electron adapters
- **FR-010**: Refactoring MUST not change external API contracts (IPC handler signatures, event names, return types)

### Key Entities

- **AIHandler**: Platform-agnostic business logic for AI operations (chat processing, welcome messages, analysis integration) that receives dependencies via constructor
- **AITopicManager**: Component responsible for topic-to-model mappings, topic loading states, display names, and topic lifecycle management
- **AIMessageProcessor**: Component responsible for message queuing, processing, LLM invocation, streaming, and progress tracking
- **AIPromptBuilder**: Component responsible for context assembly, prompt construction, conversation history formatting, and context enrichment
- **AIContactManager**: Component responsible for AI contact creation, Person/Profile/Someone object management for LLM models
- **AITaskManager**: Component responsible for subject channel initialization and dynamic task associations
- **LLMManager**: Platform-agnostic LLM provider orchestration that manages model loading, context creation, and provider abstraction
- **IPC Adapter**: Thin wrapper in lama.electron that instantiates handlers with dependencies and exposes methods via Electron IPC

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Developers can import and use AI handler components in browser environment without any platform-specific build errors or missing dependencies
- **SC-002**: AI functionality test suite runs successfully against handlers in both Node.js and simulated browser environments using same test cases
- **SC-003**: lama.core package has zero imports from lama.electron (verified by static analysis checking import statements)
- **SC-004**: Each AI component (AITopicManager, AIMessageProcessor, AIPromptBuilder, AIContactManager, AITaskManager) exists as a separate file under 400 lines
- **SC-005**: All existing AI features (welcome messages, topic analysis, context enrichment, default chats) work identically before and after refactoring
- **SC-006**: IPC handler files in lama.electron average <100 lines and contain only dependency injection and method delegation
- **SC-007**: Component coupling is verifiable: modifying AIPromptBuilder prompt logic requires changes to only one file and zero changes to other components

## Assumptions

- The reference implementation in reference/lama provides useful component boundary examples but may contain outdated patterns
- ONE.core and ONE.models packages provide all necessary functionality for platform-agnostic operation
- HTTP-based LLM providers (Ollama, LM Studio, Claude) can use platform-agnostic fetch/HTTP clients available in both Node.js and browsers
- Electron-specific UI feedback (BrowserWindow events) can be decoupled using callback patterns or event emitters provided at construction
- Existing test infrastructure can be adapted to test handlers with mocked dependencies
- The refactoring can be done incrementally without a full system rewrite (gradual migration pattern)

## Out of Scope

- Changing AI assistant feature functionality or adding new capabilities beyond architectural refactoring
- Migrating other handlers (chat, contacts, export) to the same pattern (future work after pattern is proven)
- Optimizing AI performance or changing LLM interaction patterns beyond what's needed for proper separation
- Creating browser-based LAMA application (architecture enables it but implementation is separate)
- Changing IPC protocol or event contracts used by existing UI components
