Break down the plan into executable tasks.

This is the third step in the Spec-Driven Development lifecycle for LAMA Electron.

Given the context provided as an argument, do this:

1. Run `spec/scripts/check-task-prerequisites.sh --json` from repo root and parse FEATURE_DIR and AVAILABLE_DOCS list. All paths must be absolute.
2. Load and analyze available design documents:
   - Always read plan.md for tech stack and libraries
   - IF EXISTS: Read data-model.md for entities
   - IF EXISTS: Read contracts/ for API endpoints
   - IF EXISTS: Read research.md for technical decisions
   - IF EXISTS: Read quickstart.md for test scenarios

   Note: Not all projects have all documents. For example:
   - CLI tools might not have contracts/
   - Simple libraries might not need data-model.md
   - Generate tasks based on what's available

3. Apply LAMA-specific task patterns:
   - **IPC Handler tasks**: One per new IPC operation
   - **Node.js tasks**: Business logic in main process
   - **Browser UI tasks**: React components (UI only)
   - **Test tasks [P]**: Integration tests for IPC handlers
   - NO tasks for browser-side ONE.core (forbidden)

4. Generate tasks following the template:
   - Use `spec/templates/tasks-template.md` as the base
   - Replace example tasks with actual tasks based on:
     * **Setup tasks**: Dependencies, IPC handler registration
     * **Test tasks [P]**: IPC handler tests, integration tests
     * **Core tasks**: Node.js ONE.core operations
     * **UI tasks [P]**: Browser components (can be parallel)
     * **Polish tasks [P]**: Lint, typecheck, docs

5. Task generation rules for LAMA:
   - IPC handlers in `/main/ipc/handlers/` → sequential
   - UI components in `/electron-ui/` → parallel [P]
   - Node.js core in `/main/core/` → sequential
   - Tests → always before implementation (TDD)
   - Different processes = can be parallel [P]

6. Order tasks by LAMA architecture:
   - IPC contract definitions first
   - Tests for IPC handlers (TDD)
   - Node.js implementation
   - IPC handler implementation
   - Browser UI components last
   - Everything before polish

7. Include parallel execution examples:
   - Group [P] tasks that can run together
   - Show actual Task agent commands
   - UI components often parallel
   - Node.js operations usually sequential

8. Create FEATURE_DIR/tasks.md with:
   - Correct feature name from implementation plan
   - Numbered tasks (T001, T002, etc.)
   - Clear file paths for each task
   - Process designation (main/renderer)
   - Dependency notes
   - Parallel execution guidance

Context for task generation: $ARGUMENTS

The tasks.md should be immediately executable - each task must be specific enough that an LLM can complete it without additional context. Remember: Browser = UI only, Node.js = all logic.