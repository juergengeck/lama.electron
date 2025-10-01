import { render, screen, waitFor } from '../setup/test-utils.js'
import App from '@/App'

// Mock the initialization hook
jest.mock('@/hooks/useLamaInit', () => ({
  useLamaInit: jest.fn()
}))

// Mock components to avoid deep dependencies
jest.mock('@/components/ChatView', () => ({
  ChatView: () => <div>Chat View</div>
}))

jest.mock('@/components/JournalView', () => ({
  JournalView: () => <div>Journal View</div>
}))

jest.mock('@/components/ContactsView', () => ({
  ContactsView: () => <div>Contacts View</div>
}))

jest.mock('@/components/SettingsView', () => ({
  SettingsView: () => <div>Settings View</div>
}))

import { useLamaInit } from '@/hooks/useLamaInit'

describe('Login Flow Integration', () => {
  const mockLogin = jest.fn()
  const mockRegister = jest.fn()
  const mockLogout = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Initial Loading', () => {
    it('should show loading screen while initializing', () => {
      (useLamaInit as jest.Mock).mockReturnValue({
        isInitialized: false,
        isAuthenticated: false,
        isLoading: true,
        login: mockLogin,
        register: mockRegister,
        logout: mockLogout,
        error: null
      })

      render(<App />)
      
      expect(screen.getByText('Initializing LAMA Desktop')).toBeInTheDocument()
      expect(screen.getByText('Setting up encryption and local storage...')).toBeInTheDocument()
    })

    it('should show error during initialization', () => {
      const error = new Error('Initialization failed')
      
      (useLamaInit as jest.Mock).mockReturnValue({
        isInitialized: false,
        isAuthenticated: false,
        isLoading: true,
        login: mockLogin,
        register: mockRegister,
        logout: mockLogout,
        error
      })

      render(<App />)
      
      expect(screen.getByText('Error: Initialization failed')).toBeInTheDocument()
    })
  })

  describe('Authentication Flow', () => {
    it('should show login screen when not authenticated', () => {
      (useLamaInit as jest.Mock).mockReturnValue({
        isInitialized: true,
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        register: mockRegister,
        logout: mockLogout,
        error: null
      })

      render(<App />)
      
      expect(screen.getByText('LAMA Desktop')).toBeInTheDocument()
      expect(screen.getByLabelText('Identity')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('should handle login process', async () => {
      (useLamaInit as jest.Mock).mockReturnValue({
        isInitialized: true,
        isAuthenticated: false,
        isLoading: false,
        login: mockLogin,
        register: mockRegister,
        logout: mockLogout,
        error: null
      })

      const { user } = render(<App />)
      
      const loginButton = screen.getByRole('button', { name: /login/i })
      await user.click(loginButton)
      
      expect(mockLogin).toHaveBeenCalledWith('test', 'test')
    })

    it('should transition to authenticated state', () => {
      (useLamaInit as jest.Mock).mockReturnValue({
        isInitialized: true,
        isAuthenticated: true,
        isLoading: false,
        login: mockLogin,
        register: mockRegister,
        logout: mockLogout,
        error: null
      })

      render(<App />)
      
      // Should show main app interface
      expect(screen.getByText('LAMA')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /chats/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /journal/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /contacts/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
    })
  })

  describe('Main App Navigation', () => {
    beforeEach(() => {
      (useLamaInit as jest.Mock).mockReturnValue({
        isInitialized: true,
        isAuthenticated: true,
        isLoading: false,
        login: mockLogin,
        register: mockRegister,
        logout: mockLogout,
        error: null
      })
    })

    it('should show chats by default', () => {
      render(<App />)
      
      expect(screen.getByText('Chat View')).toBeInTheDocument()
    })

    it('should navigate between tabs', async () => {
      const { user } = render(<App />)
      
      // Navigate to Journal
      await user.click(screen.getByRole('button', { name: /journal/i }))
      expect(screen.getByText('Journal View')).toBeInTheDocument()
      
      // Navigate to Contacts
      await user.click(screen.getByRole('button', { name: /contacts/i }))
      expect(screen.getByText('Contacts View')).toBeInTheDocument()
      
      // Navigate to Settings
      await user.click(screen.getByRole('button', { name: /settings/i }))
      expect(screen.getByText('Settings View')).toBeInTheDocument()
      
      // Back to Chats
      await user.click(screen.getByRole('button', { name: /chats/i }))
      expect(screen.getByText('Chat View')).toBeInTheDocument()
    })

    it('should show connection status', () => {
      render(<App />)
      
      expect(screen.getByText('Encrypted')).toBeInTheDocument()
      expect(screen.getByText('Connected')).toBeInTheDocument()
    })

    it('should handle logout', async () => {
      const { user } = render(<App />)
      
      const logoutButton = screen.getByRole('button', { name: /logout/i })
      await user.click(logoutButton)
      
      expect(mockLogout).toHaveBeenCalled()
    })
  })

  describe('Electron Menu Integration', () => {
    beforeEach(() => {
      (useLamaInit as jest.Mock).mockReturnValue({
        isInitialized: true,
        isAuthenticated: true,
        isLoading: false,
        login: mockLogin,
        register: mockRegister,
        logout: mockLogout,
        error: null
      })
    })

    it('should listen for navigation events from Electron menu', () => {
      const mockOn = jest.fn()
      const mockOff = jest.fn()
      
      window.electronAPI = {
        ...window.electronAPI,
        on: mockOn,
        off: mockOff
      }

      const { unmount } = render(<App />)
      
      expect(mockOn).toHaveBeenCalledWith('navigate', expect.any(Function))
      
      unmount()
      
      expect(mockOff).toHaveBeenCalledWith('navigate', expect.any(Function))
    })

    it('should handle navigation from menu', async () => {
      let navigateCallback: ((event: any, tab: string) => void) | null = null
      
      window.electronAPI = {
        ...window.electronAPI,
        on: jest.fn((event, callback) => {
          if (event === 'navigate') {
            navigateCallback = callback
          }
        }),
        off: jest.fn()
      }

      render(<App />)
      
      // Simulate menu navigation to settings
      if (navigateCallback) {
        navigateCallback(null, 'settings')
      }
      
      await waitFor(() => {
        expect(screen.getByText('Settings View')).toBeInTheDocument()
      })
    })
  })

  describe('Status Bar', () => {
    beforeEach(() => {
      (useLamaInit as jest.Mock).mockReturnValue({
        isInitialized: true,
        isAuthenticated: true,
        isLoading: false,
        login: mockLogin,
        register: mockRegister,
        logout: mockLogout,
        error: null
      })
    })

    it('should display version and status information', () => {
      render(<App />)
      
      expect(screen.getByText('LAMA Desktop v1.0.0')).toBeInTheDocument()
      expect(screen.getByText('P2P: Initializing')).toBeInTheDocument()
      expect(screen.getByText('Local AI: Ready')).toBeInTheDocument()
    })

    it('should display statistics', () => {
      render(<App />)
      
      expect(screen.getByText('Messages: 0')).toBeInTheDocument()
      expect(screen.getByText('Contacts: 0')).toBeInTheDocument()
    })
  })
})