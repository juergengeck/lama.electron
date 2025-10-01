import { render, screen, waitFor } from '../../setup/test-utils.js'
import { MessageView } from '@/components/MessageView'
import { createMockMessage } from '../../setup/test-utils.js'

describe('MessageView', () => {
  const mockOnSendMessage = jest.fn()
  const defaultProps = {
    messages: [],
    currentUserId: 'user-1',
    onSendMessage: mockOnSendMessage,
    placeholder: 'Type a message...',
    showSender: true,
    loading: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render empty message list', () => {
      render(<MessageView {...defaultProps} />)
      
      expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument()
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should render loading state', () => {
      render(<MessageView {...defaultProps} loading={true} />)
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('should render messages', () => {
      const messages = [
        createMockMessage({ id: '1', content: 'Hello', senderId: 'user-1' }),
        createMockMessage({ id: '2', content: 'Hi there', senderId: 'user-2' })
      ]
      
      render(<MessageView {...defaultProps} messages={messages} />)
      
      expect(screen.getByText('Hello')).toBeInTheDocument()
      expect(screen.getByText('Hi there')).toBeInTheDocument()
    })

    it('should show encryption indicator', () => {
      const messages = [
        createMockMessage({ encrypted: true })
      ]
      
      render(<MessageView {...defaultProps} messages={messages} />)
      
      expect(screen.getByText(/🔒/)).toBeInTheDocument()
    })

    it('should hide sender when showSender is false', () => {
      const messages = [
        createMockMessage({ senderId: 'user-2' })
      ]
      
      render(<MessageView {...defaultProps} messages={messages} showSender={false} />)
      
      expect(screen.queryByText('user-2')).not.toBeInTheDocument()
    })

    it('should apply different styles for current user messages', () => {
      const messages = [
        createMockMessage({ id: '1', senderId: 'user-1', content: 'My message' }),
        createMockMessage({ id: '2', senderId: 'user-2', content: 'Other message' })
      ]
      
      render(<MessageView {...defaultProps} messages={messages} />)
      
      const myMessage = screen.getByText('My message').closest('div')
      const otherMessage = screen.getByText('Other message').closest('div')
      
      expect(myMessage).toHaveClass('bg-primary/20')
      expect(otherMessage).toHaveClass('bg-secondary/20')
    })
  })

  describe('User Interactions', () => {
    it('should handle message sending on button click', async () => {
      mockOnSendMessage.mockResolvedValue(undefined)
      const { user } = render(<MessageView {...defaultProps} />)
      
      const input = screen.getByPlaceholderText('Type a message...')
      const sendButton = screen.getByRole('button')
      
      await user.type(input, 'Test message')
      await user.click(sendButton)
      
      await waitFor(() => {
        expect(mockOnSendMessage).toHaveBeenCalledWith('Test message')
        expect(input).toHaveValue('')
      })
    })

    it('should handle message sending on Enter key', async () => {
      mockOnSendMessage.mockResolvedValue(undefined)
      const { user } = render(<MessageView {...defaultProps} />)
      
      const input = screen.getByPlaceholderText('Type a message...')
      
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(mockOnSendMessage).toHaveBeenCalledWith('Test message')
        expect(input).toHaveValue('')
      })
    })

    it('should not send empty messages', async () => {
      const { user } = render(<MessageView {...defaultProps} />)
      
      const sendButton = screen.getByRole('button')
      await user.click(sendButton)
      
      expect(mockOnSendMessage).not.toHaveBeenCalled()
    })

    it('should not send message on Shift+Enter', async () => {
      const { user } = render(<MessageView {...defaultProps} />)
      
      const input = screen.getByPlaceholderText('Type a message...')
      
      await user.type(input, 'Test message')
      await user.keyboard('{Shift>}{Enter}{/Shift}')
      
      expect(mockOnSendMessage).not.toHaveBeenCalled()
    })

    it('should disable input while sending', async () => {
      mockOnSendMessage.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )
      
      const { user } = render(<MessageView {...defaultProps} />)
      
      const input = screen.getByPlaceholderText('Type a message...')
      const sendButton = screen.getByRole('button')
      
      await user.type(input, 'Test message')
      await user.click(sendButton)
      
      expect(input).toBeDisabled()
      expect(sendButton).toBeDisabled()
      
      await waitFor(() => {
        expect(input).toBeEnabled()
      })
    })

    it('should handle send error gracefully', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation()
      mockOnSendMessage.mockRejectedValue(new Error('Send failed'))
      
      const { user } = render(<MessageView {...defaultProps} />)
      
      const input = screen.getByPlaceholderText('Type a message...')
      await user.type(input, 'Test message')
      await user.keyboard('{Enter}')
      
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Failed to send message:',
          expect.any(Error)
        )
      })
      
      consoleError.mockRestore()
    })
  })

  describe('Message Formatting', () => {
    it('should format timestamps correctly', () => {
      const testDate = new Date('2024-01-01T12:30:00')
      const messages = [
        createMockMessage({ timestamp: testDate })
      ]
      
      render(<MessageView {...defaultProps} messages={messages} />)
      
      expect(screen.getByText(/12:30/)).toBeInTheDocument()
    })

    it('should show AI assistant label for AI messages', () => {
      const messages = [
        createMockMessage({ senderId: 'ai-assistant' })
      ]
      
      render(<MessageView {...defaultProps} messages={messages} />)
      
      // Look for the specific element with text content "Local AI · HH:MM:SS 🔒"
      const messageInfo = screen.getByText((content, element) => {
        const textContent = element?.textContent || ''
        return element?.tagName === 'P' && textContent.startsWith('Local AI')
      })
      expect(messageInfo).toBeInTheDocument()
      expect(messageInfo.textContent).toContain('Local AI')
    })

    it('should show "You" for current user messages', () => {
      const messages = [
        createMockMessage({ senderId: 'user-1' })
      ]
      
      render(<MessageView {...defaultProps} messages={messages} currentUserId="user-1" />)
      
      const youText = screen.getByText((content, element) => {
        return element?.textContent?.includes('You') ?? false
      })
      expect(youText).toBeInTheDocument()
    })

    it('should display avatar initials', () => {
      const messages = [
        createMockMessage({ senderId: 'alice' })
      ]
      
      render(<MessageView {...defaultProps} messages={messages} />)
      
      expect(screen.getByText('AL')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have accessible input field', () => {
      render(<MessageView {...defaultProps} />)
      
      const input = screen.getByPlaceholderText('Type a message...')
      expect(input).toBeInTheDocument()
    })

    it('should have accessible send button', () => {
      render(<MessageView {...defaultProps} />)
      
      const button = screen.getByRole('button')
      expect(button).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const { user } = render(<MessageView {...defaultProps} />)
      
      const input = screen.getByPlaceholderText('Type a message...')
      
      // Type something to enable button first
      await user.type(input, 'test')
      
      // Focus input
      input.focus()
      expect(input).toHaveFocus()
      
      // Tab to button
      await user.tab()
      
      // Button should have focus
      const button = screen.getByRole('button')
      expect(button).toHaveFocus()
    })
  })
})