# LAMA Electron Test Strategy

## Overview
Comprehensive testing strategy for the LAMA Electron desktop application using Jest as the primary testing framework.

## Test Architecture

### Testing Layers
1. **Unit Tests** - Individual component and function testing
2. **Integration Tests** - Component interaction and IPC communication
3. **End-to-End Tests** - Complete user workflows
4. **Electron-specific Tests** - Main process and native API testing

### Testing Tools
- **Jest** - Primary test runner and assertion library
- **React Testing Library** - React component testing
- **Electron Testing Library** - Electron-specific testing utilities
- **Mock Service Worker (MSW)** - API mocking for network requests
- **jest-electron** - Electron environment for Jest

## Test Coverage Goals
- **Unit Tests**: 80% coverage minimum
- **Integration Tests**: Critical paths covered
- **E2E Tests**: Main user journeys
- **Performance Tests**: Memory leaks, render performance

## Test Structure

```
tests/
├── unit/
│   ├── components/      # React component tests
│   │   ├── ChatView.test.tsx
│   │   ├── JournalView.test.tsx
│   │   ├── ContactsView.test.tsx
│   │   ├── SettingsView.test.tsx
│   │   ├── MessageView.test.tsx
│   │   └── LoginScreen.test.tsx
│   ├── hooks/           # Custom hook tests
│   │   ├── useLama.test.ts
│   │   └── useLamaInit.test.ts
│   ├── bridge/          # Bridge module tests
│   │   └── lama-bridge.test.ts
│   └── utils/           # Utility function tests
├── integration/
│   ├── ipc/            # IPC communication tests
│   │   ├── udp-ipc.test.ts
│   │   └── navigation.test.ts
│   ├── workflows/      # User workflow tests
│   │   ├── login-flow.test.ts
│   │   ├── messaging-flow.test.ts
│   │   └── settings-flow.test.ts
│   └── menu/           # Menu interaction tests
│       └── menu-navigation.test.ts
├── e2e/
│   ├── app-launch.test.ts
│   ├── full-workflow.test.ts
│   └── cross-platform.test.ts
├── electron/
│   ├── main-process.test.js
│   ├── window-management.test.js
│   └── native-menu.test.js
├── fixtures/           # Test data and mocks
├── mocks/             # Mock implementations
└── setup/             # Test configuration
    ├── jest.setup.ts
    └── test-utils.tsx
```

## Unit Test Strategy

### Component Testing Principles
1. **Isolation** - Test components in isolation with mocked dependencies
2. **User-centric** - Test from user's perspective (what they see/interact with)
3. **State Management** - Test component state changes and effects
4. **Edge Cases** - Test error states, loading states, empty states

### Example Test Structure
```typescript
describe('ChatView', () => {
  describe('Rendering', () => {
    it('should render message list')
    it('should render input field')
    it('should show loading state')
    it('should show error state')
  })
  
  describe('User Interactions', () => {
    it('should send message on Enter key')
    it('should send message on button click')
    it('should clear input after sending')
    it('should disable input while sending')
  })
  
  describe('Message Display', () => {
    it('should display sent messages')
    it('should display received messages')
    it('should show encryption indicator')
    it('should format timestamps correctly')
  })
})
```

## Integration Test Strategy

### IPC Communication Tests
- Test bidirectional communication between renderer and main process
- Mock Electron IPC APIs
- Verify message passing and response handling

### Workflow Tests
- Test complete user journeys
- Mock external dependencies
- Verify state persistence

### Example Integration Test
```typescript
describe('Login Workflow', () => {
  it('should complete login and initialize app', async () => {
    // 1. Render login screen
    // 2. Fill credentials
    // 3. Submit form
    // 4. Verify authentication
    // 5. Verify navigation to main app
    // 6. Verify model initialization
  })
})
```

## End-to-End Test Strategy

### Electron Application Tests
- Launch actual Electron app
- Simulate real user interactions
- Test cross-platform behavior
- Verify native menu functionality

### Key E2E Scenarios
1. **App Launch**
   - Window creation
   - Menu initialization
   - Dev tools availability

2. **Authentication Flow**
   - Login with valid credentials
   - Handle invalid credentials
   - Logout and cleanup

3. **Messaging Flow**
   - Send and receive messages
   - Journal entry creation
   - Message persistence

4. **Settings Management**
   - Update settings
   - Persist settings
   - Apply settings changes

## Mock Strategy

### What to Mock
1. **External Services**
   - WebSocket connections
   - UDP sockets
   - File system operations

2. **Electron APIs**
   - IPC renderer/main
   - Dialog APIs
   - Clipboard APIs
   - Menu APIs

3. **ONE Platform Models**
   - Authentication
   - Storage
   - Encryption

### Mock Implementation Examples
```typescript
// Mock IPC
const mockIPC = {
  invoke: jest.fn(),
  send: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
}

// Mock UDP Socket
class MockUDPSocket {
  bind = jest.fn()
  send = jest.fn()
  close = jest.fn()
  on = jest.fn()
}

// Mock LAMA Bridge
const mockLamaBridge = {
  login: jest.fn().mockResolvedValue(true),
  sendMessage: jest.fn().mockResolvedValue('msg-id'),
  getMessages: jest.fn().mockResolvedValue([])
}
```

## Test Data Management

### Fixtures
```typescript
// User fixtures
export const testUser = {
  id: 'test-user-1',
  name: 'Test User',
  publicKey: '0x1234...'
}

// Message fixtures
export const testMessages = [
  {
    id: 'msg-1',
    senderId: 'user-1',
    content: 'Test message',
    timestamp: new Date('2024-01-01'),
    encrypted: true
  }
]

// Contact fixtures
export const testContacts = [
  {
    id: 'peer-1',
    name: 'Alice',
    status: 'connected',
    lastSeen: new Date()
  }
]
```

## Performance Testing

### Metrics to Track
1. **Render Performance**
   - Component render times
   - Re-render frequency
   - Virtual DOM updates

2. **Memory Usage**
   - Memory leaks detection
   - Component cleanup verification
   - Event listener cleanup

3. **IPC Performance**
   - Message round-trip time
   - Large payload handling
   - Concurrent request handling

## CI/CD Integration

### Test Execution Pipeline
```yaml
test:
  - npm run test:unit        # Fast, run on every commit
  - npm run test:integration # Medium speed, run on PR
  - npm run test:e2e        # Slow, run on merge to main
  - npm run test:coverage   # Generate coverage reports
```

### Coverage Requirements
- Unit tests: 80% minimum
- Integration tests: Critical paths
- E2E tests: Happy paths
- Overall: 70% minimum

## Test Commands

```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e --runInBand",
    "test:electron": "jest tests/electron --testEnvironment=@jest-runner/electron",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:debug": "node --inspect-brk ./node_modules/.bin/jest --runInBand"
  }
}
```

## Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/main.tsx'
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  projects: [
    {
      displayName: 'renderer',
      testMatch: ['<rootDir>/tests/(unit|integration)/**/*.test.{ts,tsx}']
    },
    {
      displayName: 'main',
      runner: '@jest-runner/electron/main',
      testMatch: ['<rootDir>/tests/electron/**/*.test.js']
    }
  ]
}
```

## Test Utilities

```typescript
// tests/setup/test-utils.tsx
import { render, RenderOptions } from '@testing-library/react'
import { ReactElement } from 'react'

// Custom render with providers
export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions
) {
  return render(ui, { ...options })
}

// Mock Electron API
export const mockElectronAPI = {
  udpCreate: jest.fn(),
  udpBind: jest.fn(),
  udpSend: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
}

// Setup window.electronAPI
global.window.electronAPI = mockElectronAPI
```

## Implementation Priority

### Phase 1: Foundation (Week 1)
1. Set up Jest configuration
2. Create test utilities and helpers
3. Implement basic component unit tests
4. Set up mock infrastructure

### Phase 2: Core Tests (Week 2)
1. Complete component unit tests
2. Implement hook tests
3. Add integration tests for IPC
4. Test critical workflows

### Phase 3: Advanced Tests (Week 3)
1. Implement E2E tests
2. Add Electron main process tests
3. Performance testing
4. Cross-platform testing

### Phase 4: Optimization (Week 4)
1. Improve test coverage
2. Optimize test execution time
3. Add visual regression tests
4. Documentation and maintenance

## Best Practices

### Do's
- Write tests before or alongside code (TDD/BDD)
- Keep tests simple and focused
- Use descriptive test names
- Mock external dependencies
- Test user behavior, not implementation
- Clean up after tests (unmount, clear mocks)
- Use data-testid for reliable element selection

### Don'ts
- Don't test implementation details
- Don't test third-party libraries
- Don't write brittle tests dependent on timing
- Don't ignore test failures
- Don't skip error cases
- Don't duplicate tests across layers

## Maintenance

### Regular Tasks
- Review and update tests with code changes
- Monitor test execution time
- Update mocks when APIs change
- Refactor tests to reduce duplication
- Review coverage reports
- Update test documentation

### Test Health Metrics
- Test execution time < 5 minutes for unit tests
- Test flakiness < 1%
- Coverage trend increasing or stable
- Test-to-code ratio ~1:1 for critical paths

## Conclusion

This comprehensive test strategy ensures the LAMA Electron app is robust, maintainable, and reliable. The multi-layered approach catches bugs at different levels while maintaining fast feedback loops for developers.