import { render, RenderOptions } from '@testing-library/react'
import { ReactElement, ReactNode } from 'react'
import userEvent from '@testing-library/user-event'

// Custom render function with providers
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  function Wrapper({ children }: { children: ReactNode }) {
    // Add any providers here (Theme, Router, etc.)
    return <>{children}</>
  }

  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...options })
  }
}

// Re-export everything from testing library
export * from '@testing-library/react'
export { renderWithProviders as render }
export { userEvent }

// Test data factories
export const createMockMessage = (overrides = {}) => ({
  id: `msg-${Date.now()}`,
  senderId: 'user-1',
  content: 'Test message',
  timestamp: new Date(),
  encrypted: true,
  ...overrides
})

export const createMockPeer = (overrides = {}) => ({
  id: `peer-${Date.now()}`,
  name: 'Test Peer',
  address: '192.168.1.100:8080',
  status: 'connected' as const,
  lastSeen: new Date(),
  ...overrides
})

export const createMockUser = (overrides = {}) => ({
  id: 'test-user',
  name: 'Test User',
  email: 'test@test.com',
  ...overrides
})

// Mock timers utilities
export const waitForAsync = () => new Promise(resolve => setTimeout(resolve, 0))

// Mock localStorage
export const mockLocalStorage = () => {
  const store: Record<string, string> = {}
  
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString()
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key]
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach(key => delete store[key])
    })
  }
}