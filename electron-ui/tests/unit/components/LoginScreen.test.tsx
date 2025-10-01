import { render, screen, waitFor, userEvent } from '../../setup/test-utils.js'
import { LoginScreen } from '@/components/LoginScreen'

describe('LoginScreen', () => {
  const mockOnLogin = jest.fn()
  const mockOnRegister = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render login form by default', () => {
      render(<LoginScreen onLogin={mockOnLogin} onRegister={mockOnRegister} />)
      
      expect(screen.getByText('LAMA Desktop')).toBeInTheDocument()
      expect(screen.getByText('Welcome back! Please login to continue.')).toBeInTheDocument()
      expect(screen.getByLabelText('Identity')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument()
    })

    it('should have prefilled credentials', () => {
      render(<LoginScreen onLogin={mockOnLogin} onRegister={mockOnRegister} />)
      
      const identityInput = screen.getByLabelText('Identity') as HTMLInputElement
      const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
      
      expect(identityInput.value).toBe('test')
      expect(passwordInput.value).toBe('test')
    })

    it('should show security features', () => {
      render(<LoginScreen onLogin={mockOnLogin} onRegister={mockOnRegister} />)
      
      expect(screen.getByText('🔒 End-to-end encrypted')).toBeInTheDocument()
      expect(screen.getByText('🌐 P2P messaging')).toBeInTheDocument()
      expect(screen.getByText('🤖 Local AI processing')).toBeInTheDocument()
    })

    it('should switch to register mode', async () => {
      const { user } = render(<LoginScreen onLogin={mockOnLogin} onRegister={mockOnRegister} />)
      
      const switchButton = screen.getByText("Don't have an account? Register")
      await user.click(switchButton)
      
      expect(screen.getByText('Create a new account to get started.')).toBeInTheDocument()
      expect(screen.getByLabelText('Identity Name')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument()
    })
  })

  describe('User Interactions', () => {
    it('should handle login submission', async () => {
      mockOnLogin.mockResolvedValue(undefined)
      const { user } = render(<LoginScreen onLogin={mockOnLogin} onRegister={mockOnRegister} />)
      
      const loginButton = screen.getByRole('button', { name: /login/i })
      await user.click(loginButton)
      
      await waitFor(() => {
        expect(mockOnLogin).toHaveBeenCalledWith('test', 'test')
      })
    })

    it('should handle register submission', async () => {
      mockOnRegister.mockResolvedValue(undefined)
      const { user } = render(<LoginScreen onLogin={mockOnLogin} onRegister={mockOnRegister} />)
      
      // Switch to register mode
      await user.click(screen.getByText("Don't have an account? Register"))
      
      // Fill in form
      const nameInput = screen.getByLabelText('Identity Name')
      const passwordInput = screen.getByLabelText('Password')
      
      await user.clear(nameInput)
      await user.type(nameInput, 'newuser')
      await user.clear(passwordInput)
      await user.type(passwordInput, 'newpass')
      
      // Submit
      const registerButton = screen.getByRole('button', { name: /register/i })
      await user.click(registerButton)
      
      await waitFor(() => {
        expect(mockOnRegister).toHaveBeenCalledWith('newuser', 'newpass')
      })
    })

    it('should show loading state during submission', async () => {
      mockOnLogin.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      const { user } = render(<LoginScreen onLogin={mockOnLogin} onRegister={mockOnRegister} />)
      
      const loginButton = screen.getByRole('button', { name: /login/i })
      await user.click(loginButton)
      
      expect(screen.getByText('Logging in...')).toBeInTheDocument()
      expect(loginButton).toBeDisabled()
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /login/i })).toBeEnabled()
      })
    })

    it('should display error on failed login', async () => {
      const errorMessage = 'Invalid credentials'
      mockOnLogin.mockRejectedValue(new Error(errorMessage))
      
      const { user } = render(<LoginScreen onLogin={mockOnLogin} onRegister={mockOnRegister} />)
      
      const loginButton = screen.getByRole('button', { name: /login/i })
      await user.click(loginButton)
      
      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('should clear error when switching modes', async () => {
      mockOnLogin.mockRejectedValue(new Error('Login failed'))
      const { user } = render(<LoginScreen onLogin={mockOnLogin} onRegister={mockOnRegister} />)
      
      // Trigger error
      await user.click(screen.getByRole('button', { name: /login/i }))
      await waitFor(() => {
        expect(screen.getByText('Login failed')).toBeInTheDocument()
      })
      
      // Switch mode
      await user.click(screen.getByText("Don't have an account? Register"))
      
      expect(screen.queryByText('Login failed')).not.toBeInTheDocument()
    })

    it('should validate required fields', async () => {
      const { user } = render(<LoginScreen onLogin={mockOnLogin} onRegister={mockOnRegister} />)
      
      const identityInput = screen.getByLabelText('Identity')
      const passwordInput = screen.getByLabelText('Password')
      
      // Clear inputs
      await user.clear(identityInput)
      await user.clear(passwordInput)
      
      const loginButton = screen.getByRole('button', { name: /login/i })
      expect(loginButton).toBeDisabled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(<LoginScreen onLogin={mockOnLogin} onRegister={mockOnRegister} />)
      
      expect(screen.getByLabelText('Identity')).toBeInTheDocument()
      expect(screen.getByLabelText('Password')).toBeInTheDocument()
    })

    it('should have proper ARIA attributes', () => {
      render(<LoginScreen onLogin={mockOnLogin} onRegister={mockOnRegister} />)
      
      const form = screen.getByRole('button', { name: /login/i }).closest('form')
      expect(form).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const { user } = render(<LoginScreen onLogin={mockOnLogin} onRegister={mockOnRegister} />)
      
      // Tab through form elements
      await user.tab()
      expect(screen.getByLabelText('Identity')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByLabelText('Password')).toHaveFocus()
      
      await user.tab()
      expect(screen.getByRole('button', { name: /login/i })).toHaveFocus()
    })
  })
})