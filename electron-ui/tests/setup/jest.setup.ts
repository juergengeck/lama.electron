import '@testing-library/jest-dom'

// Mock window.electronAPI
const mockElectronAPI = {
  udpCreate: jest.fn(),
  udpBind: jest.fn(),
  udpSend: jest.fn(),
  udpClose: jest.fn(),
  onUDPMessage: jest.fn(),
  minimizeWindow: jest.fn(),
  maximizeWindow: jest.fn(),
  closeWindow: jest.fn(),
  getPlatform: jest.fn().mockResolvedValue('darwin'),
  getVersion: jest.fn().mockResolvedValue('1.0.0'),
  selectDirectory: jest.fn(),
  selectFile: jest.fn(),
  copyToClipboard: jest.fn(),
  readFromClipboard: jest.fn(),
  on: jest.fn(),
  off: jest.fn()
}

// Add to window object
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: mockElectronAPI
})

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
  takeRecords() {
    return []
  }
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Suppress console errors in tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks()
})