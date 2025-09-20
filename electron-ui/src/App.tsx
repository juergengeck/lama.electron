import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
// import { ScrollArea } from '@/components/ui/scroll-area'
import { ChatLayout } from '@/components/ChatLayout'
import { JournalView } from '@/components/JournalView'
import { ContactsView } from '@/components/ContactsView'
import { SettingsView } from '@/components/SettingsView'
import { DataDashboard } from '@/components/DataDashboard'
import { DevicesView } from '@/components/DevicesView'
import { LoginDeploy } from '@/components/LoginDeploy'
import { ModelOnboarding } from '@/components/ModelOnboarding'
import { MessageSquare, BookOpen, Users, Settings, Loader2, Smartphone, BarChart3 } from 'lucide-react'
import { useLamaInit } from '@/hooks/useLamaInit'
import { lamaBridge } from '@/bridge/lama-bridge'
import { ipcStorage } from '@/services/ipc-storage'

function App() {
  const [activeTab, setActiveTab] = useState('chats')
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>(undefined)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false)
  const { isInitialized, isAuthenticated, isLoading, login, logout, error } = useLamaInit()
  // NO AppModel in browser - use IPC for everything
  
  // Load onboarding status
  useEffect(() => {
    // Try IPC storage first, fallback to localStorage
    ipcStorage.getItem('lama-onboarding-completed')
      .then(value => {
        if (value) {
          setHasCompletedOnboarding(value === 'true')
        } else {
          // Check localStorage as fallback
          const localValue = localStorage.getItem('lama-onboarding-completed')
          setHasCompletedOnboarding(localValue === 'true')
        }
      })
      .catch(() => {
        // If IPC fails, check localStorage
        const localValue = localStorage.getItem('lama-onboarding-completed')
        setHasCompletedOnboarding(localValue === 'true')
      })
  }, [])

  // Signal UI is ready when authenticated
  useEffect(() => {
    if (isAuthenticated && window.electronAPI) {
      console.log('[App] Signaling UI ready for IPC messages')
      window.electronAPI.invoke('chat:uiReady').catch(err =>
        console.error('[App] Failed to signal UI ready:', err)
      )
    }
  }, [isAuthenticated])

  // Global listener for new messages - keeps conversation list updated app-wide
  useEffect(() => {
    if (!isAuthenticated) return

    const handleNewMessages = (data: { conversationId: string; messages: any[] }) => {
      console.log('[App] 📬 Global: New messages received for conversation:', data.conversationId)
      // This ensures the lamaBridge event system knows there's at least one listener
      // The actual UI updates happen in ChatLayout or other components
    }

    // Register as a global listener so messages are always acknowledged
    lamaBridge.on('chat:newMessages', handleNewMessages)

    return () => {
      lamaBridge.off('chat:newMessages', handleNewMessages)
    }
  }, [isAuthenticated])
  
  // Listen for navigation from Electron menu
  useEffect(() => {
    const handleNavigate = (_event: any, tab: string) => {
      setActiveTab(tab)
    }
    
    // Check if we're in Electron environment
    if (window.electronAPI && 'on' in window.electronAPI) {
      (window.electronAPI as any).on('navigate', handleNavigate)
      return () => {
        // Only call off if it exists
        if ('off' in window.electronAPI!) {
          (window.electronAPI as any).off('navigate', handleNavigate)
        }
      }
    }
  }, [])
  
  // Show loading screen while initializing
  if (isLoading && !isInitialized) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Initializing LAMA Desktop</h2>
          <p className="text-muted-foreground">Setting up encryption and local storage...</p>
          {error && (
            <div className="mt-4 text-red-500">
              Error: {error.message}
            </div>
          )}
        </div>
      </div>
    )
  }
  
  // Show login/deploy screen if not authenticated
  // Security through obscurity - credentials deploy or access instances
  if (!isAuthenticated) {
    return <LoginDeploy onLogin={login} />
  }

  // Check if we need to show model onboarding
  // Only show onboarding if user has never completed it before
  // We can't check for models from browser - that's in Node.js
  const shouldShowOnboarding = !hasCompletedOnboarding
  
  if (shouldShowOnboarding) {
    return <ModelOnboarding onComplete={async () => {
      try {
        await ipcStorage.setItem('lama-onboarding-completed', 'true')
      } catch (error) {
        console.log('[App] Could not save onboarding status, saving to localStorage instead')
        localStorage.setItem('lama-onboarding-completed', 'true')
      }
      setHasCompletedOnboarding(true)
    }} />
  }

  const tabs = [
    { id: 'chats', label: 'Chats', icon: MessageSquare },
    { id: 'journal', label: 'Journal', icon: BookOpen },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'devices', label: 'Devices', icon: Smartphone },
    { id: 'settings', label: null, icon: Settings },  // No label for settings, just icon
  ]

  const handleNavigate = (tab: string, conversationId?: string, section?: string) => {
    setActiveTab(tab)
    if (conversationId) {
      setSelectedConversationId(conversationId)
    }
    
    // Store navigation context for settings
    if (tab === 'settings' && section) {
      // We'll pass this to SettingsView
      sessionStorage.setItem('settings-scroll-to', section)
    }
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'chats':
        return <ChatLayout selectedConversationId={selectedConversationId} />
      case 'journal':
        return <JournalView />
      case 'contacts':
        return <ContactsView onNavigateToChat={async (topicId, contactName) => {
          // Add or update the conversation in localStorage
          const savedConversations = await ipcStorage.getItem('lama-conversations')
          let conversations = []

          try {
            if (savedConversations) {
              conversations = JSON.parse(savedConversations)
            }
          } catch (e) {
            console.error('Failed to parse saved conversations:', e)
          }

          // Check if conversation already exists
          const existingConv = conversations.find((c: any) => c.id === topicId)

          if (!existingConv) {
            // Create new conversation entry
            const newConversation = {
              id: topicId,
              name: `Chat with ${contactName}`,
              type: 'direct',
              lastMessage: null,
              lastMessageTime: new Date().toISOString(),
              modelName: null // No AI model for person-to-person chat
            }

            // Add to beginning of list
            conversations.unshift(newConversation)
            await ipcStorage.setItem('lama-conversations', JSON.stringify(conversations))
            console.log('[App] Created new conversation for contact:', contactName)
          }

          // Navigate to chat
          setSelectedConversationId(topicId)
          setActiveTab('chats')
        }} />
      case 'devices':
        return <DevicesView />
      case 'settings':
        return <SettingsView onLogout={logout} onNavigate={handleNavigate} />
      default:
        return <ChatLayout />
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Top Navigation Bar */}
      <div className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Logo and App Name */}
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              LAMA
            </h1>
            <div className="h-6 w-px bg-border" />
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center justify-between flex-1">
            {/* Left side - main navigation */}
            <div className="flex items-center space-x-2">
              {tabs.filter(tab => tab.id !== 'settings').map((tab) => {
                const Icon = tab.icon
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab(tab.id)}
                    className="flex items-center space-x-2"
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label && <span>{tab.label}</span>}
                  </Button>
                )
              })}
            </div>
            
            {/* Right side - settings */}
            <div className="flex items-center space-x-2">
              {tabs.filter(tab => tab.id === 'settings').map((tab) => {
                const Icon = tab.icon
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab(tab.id)}
                    className="flex items-center space-x-2"
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label && <span>{tab.label}</span>}
                  </Button>
                )
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden p-6">
        {renderContent()}
      </div>

      {/* Status Bar */}
      <div className="border-t bg-card px-6 py-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <span>LAMA Desktop v1.0.0</span>
            <span>·</span>
            <span>Browser: Sparse Storage</span>
            <span>·</span>
            <span>Node: Archive Storage</span>
            <span>·</span>
            <span>CHUM: Connected</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Identity: {isAuthenticated ? 'Active' : 'None'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App