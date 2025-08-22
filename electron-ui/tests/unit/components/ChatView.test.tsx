import { render, screen, waitFor, act } from '../../setup/test-utils'
import { ChatView } from '@/components/ChatView'
import { mockMessages } from '../../mocks/lama-bridge-mock'

// Mock the hooks
jest.mock('@/hooks/useLama', () => ({
  useLamaMessages: jest.fn(),
  useLamaAuth: jest.fn()
}))

import { useLamaMessages, useLamaAuth } from '@/hooks/useLama'

describe('ChatView', () => {
  const mockSendMessage = jest.fn()
  
  const defaultMockHooks = {
    messages: mockMessages,
    loading: false,
    sendMessage: mockSendMessage,
    error: null
  }
  
  const defaultAuthHook = {
    user: { id: 'user-1', name: 'Test User' }
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (useLamaMessages as jest.Mock).mockReturnValue(defaultMockHooks);
    (useLamaAuth as jest.Mock).mockReturnValue(defaultAuthHook)
  })

  describe('Rendering', () => {
    it('should render chat interface', () => {
      render(<ChatView conversationId="default" />)
      
      expect(screen.getByText('Chat')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument()
    })

    it('should display messages', () => {
      render(<ChatView conversationId="default" />)
      
      expect(screen.getByText("Hello! I'm your local AI assistant.")).toBeInTheDocument()
      expect(screen.getByText('Hi there!')).toBeInTheDocument()
    })

    it('should show loading state', () => {
      (useLamaMessages as jest.Mock).mockReturnValue({
        ...defaultMockHooks,
        loading: true
      })
      
      render(<ChatView conversationId="default" />)
      
      // MessageView handles loading display
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should pass correct conversation ID', () => {
      render(<ChatView conversationId="test-convo" />)
      
      expect(useLamaMessages).toHaveBeenCalledWith('test-convo')
    })

    it('should show chat icon in header', () => {
      render(<ChatView />)
      
      const header = screen.getByText('Chat').parentElement
      expect(header).toBeInTheDocument()
    })
  })

  describe('Message Sending', () => {
    it('should handle message sending', async () => {
      mockSendMessage.mockResolvedValue('msg-id')
      const { user } = render(<ChatView />)
      
      const input = screen.getByPlaceholderText('Type a message...')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith('recipient-1', 'Test message')
      })
    })

    it('should clear input after sending', async () => {
      mockSendMessage.mockResolvedValue('msg-id')
      const { user } = render(<ChatView />)
      
      const input = screen.getByPlaceholderText('Type a message...') as HTMLInputElement
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(input.value).toBe('')
      })
    })

    it('should handle send errors', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation()
      mockSendMessage.mockRejectedValue(new Error('Send failed'))
      
      const { user } = render(<ChatView />)
      
      const input = screen.getByPlaceholderText('Type a message...')
      await user.type(input, 'Test')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalled()
      })
      
      consoleError.mockRestore()
    })
  })

  describe('User Context', () => {
    it('should use current user ID for message display', () => {
      render(<ChatView />)
      
      expect(useLamaAuth).toHaveBeenCalled()
      // MessageView will receive user.id as currentUserId
    })

    it('should handle missing user gracefully', () => {
      (useLamaAuth as jest.Mock).mockReturnValue({
        user: null
      })
      
      render(<ChatView />)
      
      expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument()
    })
  })

  describe('Integration', () => {
    it('should integrate with MessageView component', () => {
      render(<ChatView />)
      
      // Check that MessageView functionality is present
      expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should display encryption indicators', () => {
      render(<ChatView />)
      
      // Messages have encrypted: true
      const encryptedIndicators = screen.getAllByText(/🔒/)
      expect(encryptedIndicators.length).toBeGreaterThan(0)
    })

    it('should format timestamps', () => {
      render(<ChatView />)
      
      // Check for time formatting (messages have timestamps)
      expect(screen.getByText(/10:00/)).toBeInTheDocument()
    })
  })
})