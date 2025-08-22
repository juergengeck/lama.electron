# Testing Guide

This document outlines the testing strategy and practices for the LAMA Electron UI application.

## Test Structure

```
tests/
├── setup/                     # Test configuration and utilities
│   ├── jest.setup.ts         # Jest global setup
│   ├── test-utils.tsx        # Custom render functions and utilities
│   └── matchers.ts           # Custom Jest matchers
├── mocks/                    # Mock implementations
│   ├── lama-bridge-mock.ts   # LAMA bridge mocks
│   ├── one-core-mock.ts      # ONE Core mocks
│   └── one-models-mock.ts    # ONE Models mocks
├── unit/                     # Unit tests
│   └── components/           # Component tests
├── integration/              # Integration tests
└── e2e/                      # End-to-end tests (future)
```

## Available Scripts

### Development Testing
```bash
npm test                      # Run tests in watch mode
npm run test:watch           # Explicitly run in watch mode
npm run test:unit            # Run only unit tests
npm run test:integration     # Run only integration tests
```

### CI/CD Testing
```bash
npm run test:ci              # Run tests for CI (coverage, no watch)
npm run test:coverage        # Generate coverage report
npm run ci                   # Full CI pipeline (lint, typecheck, test, build)
```

### Quality Assurance
```bash
npm run lint                 # Run ESLint
npm run lint:fix            # Fix ESLint issues
npm run typecheck           # Run TypeScript compiler checks
npm run precommit           # Run pre-commit checks (lint, typecheck, test)
```

## Testing Approach

### 1. Unit Tests
- **Location**: `tests/unit/`
- **Purpose**: Test individual components and functions in isolation
- **Tools**: Jest, React Testing Library, custom utilities

#### Component Testing Pattern:
```typescript
import { render, screen } from '../../setup/test-utils'
import { MyComponent } from '@/components/MyComponent'

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent prop="value" />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })
})
```

### 2. Integration Tests
- **Location**: `tests/integration/`
- **Purpose**: Test component interactions and data flow
- **Focus**: User workflows, API interactions, state management

### 3. Mocking Strategy
- **LAMA Bridge**: Mocked to simulate backend communication
- **ONE Platform**: Mocked core and models modules
- **Electron APIs**: Mocked for renderer process testing

### 4. Coverage Requirements
- **Branches**: 70%
- **Functions**: 70% 
- **Lines**: 70%
- **Statements**: 70%

Coverage reports are generated in the `coverage/` directory:
- `coverage/lcov-report/index.html` - HTML report
- `coverage/lcov.info` - LCOV format for CI tools

## Pre-commit Hooks

The project uses Husky and lint-staged to enforce quality:

1. **ESLint**: Automatically fixes code style issues
2. **Jest**: Runs tests for changed files only
3. **Prettier**: Formats JSON, Markdown, and YAML files

## Continuous Integration

GitHub Actions workflow (`.github/workflows/ci.yml`) runs:

1. **Multi-platform testing**: Ubuntu, macOS, Windows
2. **Node.js versions**: 18.x, 20.x
3. **Full pipeline**: lint → typecheck → test → build
4. **Coverage upload**: Codecov integration
5. **Electron packaging**: Cross-platform builds

## Testing Best Practices

### 1. Test Organization
- Group related tests with `describe()` blocks
- Use descriptive test names that explain expected behavior
- Follow AAA pattern: Arrange, Act, Assert

### 2. Component Testing
- Test user interactions, not implementation details
- Use `screen.getByRole()` and semantic queries
- Mock external dependencies appropriately

### 3. Async Testing
- Use `waitFor()` for async state changes
- Prefer `findBy*` queries for elements that appear asynchronously
- Wrap state updates in `act()` when needed

### 4. Mock Management
- Keep mocks focused and minimal
- Reset mocks between tests with `beforeEach()`
- Use factory functions for creating test data

## Troubleshooting

### Common Issues

1. **React act() Warnings**
   - Usually from third-party components (RadixUI)
   - Non-critical but can be suppressed in test setup

2. **ES Module Errors**
   - Jest configured for ES modules with `jest.config.cjs`
   - Transform patterns handle TypeScript and JSX

3. **Path Resolution**
   - `@/` alias configured in Jest `moduleNameMapper`
   - Matches Vite's path resolution

### Performance
- Tests run with `maxWorkers=2` in CI to prevent resource exhaustion
- Use `--bail` flag in pre-commit hooks for fast feedback

## Future Enhancements

1. **E2E Testing**: Playwright or Cypress integration
2. **Visual Regression**: Screenshot testing
3. **Performance Testing**: Lighthouse CI
4. **Accessibility Testing**: axe-core integration