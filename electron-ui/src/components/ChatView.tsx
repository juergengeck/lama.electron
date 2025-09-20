import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageView } from './MessageView'
import { useLamaMessages } from '@/hooks/useLamaMessages'
import { useLamaAuth, useLamaPeers } from '@/hooks/useLama'
import { MessageSquare } from 'lucide-react'
import { lamaBridge } from '@/bridge/lama-bridge'

export function ChatView({
  conversationId = 'default',
  onProcessingChange,
  onMessageUpdate,
  isInitiallyProcessing = false
}: {
  conversationId?: string
  onProcessingChange?: (isProcessing: boolean) => void
  onMessageUpdate?: (lastMessage: string) => void
  isInitiallyProcessing?: boolean
}) {
  const { messages, loading, sendMessage } = useLamaMessages(conversationId)
  const { user } = useLamaAuth()

  // Debug: log messages received from hook
  console.log('[ChatView] Received from hook - messages:', messages?.length || 0, 'loading:', loading)
  if (messages && messages.length > 0) {
    console.log('[ChatView] First message in ChatView:', messages[0])
  }

  // Separate effect for updating parent
  useEffect(() => {
    if (messages.length > 0 && onMessageUpdate) {
      const lastMessage = messages[messages.length - 1]
      if (lastMessage && lastMessage.content) {
        onMessageUpdate(lastMessage.content)
      }
    }
  }, [messages, onMessageUpdate]) // Proper dependencies

  const { peers } = useLamaPeers()
  const [conversationName, setConversationName] = useState<string>('Messages')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAIProcessing, setIsAIProcessing] = useState(isInitiallyProcessing)
  const [aiStreamingContent, setAiStreamingContent] = useState('')

  // Check if welcome message is still being generated on mount
  useEffect(() => {
    // If there are no messages and this is a new AI conversation, show spinner
    if (messages.length === 0 && isInitiallyProcessing) {
      setIsAIProcessing(true)
      console.log('[ChatView] Setting AI processing on mount for new conversation')
    }
  }, []) // Only on mount

  // Listen for AI streaming events
  useEffect(() => {
    if (!window.electronAPI) return
    
    // Handle thinking indicator (used for all AI messages including welcome)
    const handleThinking = (data: any) => {
      console.log('[ChatView] AI thinking for:', data.conversationId)
      if (data.conversationId === conversationId) {
        setIsAIProcessing(true)
        setAiStreamingContent('')
        onProcessingChange?.(true) // Update parent state
      }
    }
    
    // Handle streaming chunks
    const handleStream = (data: any) => {
      if (data.conversationId === conversationId) {
        setIsAIProcessing(false)
        setAiStreamingContent(data.partial || '')
      }
    }
    
    // Handle message complete
    const handleComplete = (data: any) => {
      if (data.conversationId === conversationId) {
        setIsAIProcessing(false)
        setAiStreamingContent('')
        onProcessingChange?.(false) // Update parent state
      }
    }
    
    // Subscribe to streaming events via electronAPI
    const unsubThinking = window.electronAPI.on('message:thinking', handleThinking)
    const unsubStream = window.electronAPI.on('message:stream', handleStream)
    const unsubComplete = window.electronAPI.on('message:updated', handleComplete)
    
    return () => {
      if (unsubThinking) unsubThinking()
      if (unsubStream) unsubStream()
      if (unsubComplete) unsubComplete()
    }
  }, [conversationId])
  
  useEffect(() => {
    // Get the conversation/contact name
    const loadConversationDetails = async () => {
      try {
        // Check if this is an AI conversation
        if (conversationId === 'default' || conversationId === 'ai-chat') {
          // For the default conversation, check if it's with the AI
          // based on message content
          if (messages.length > 0) {
            const aiMessage = messages.find(m => 
              m.sender?.toLowerCase().includes('ai') || 
              m.sender?.toLowerCase().includes('local') ||
              m.sender?.toLowerCase().includes('ollama') ||
              m.content?.includes('Ollama') ||
              m.content?.includes('AI assistant')
            )
            if (aiMessage) {
              // It's an AI conversation - try to get the model name
              // Try to get AI model name from IPC (future enhancement)
              // For now, use fallback logic
              
              // Fallback based on message content
              if (messages[0]?.content?.toLowerCase().includes('ollama')) {
                setConversationName('Ollama')
              } else {
                setConversationName('AI Assistant')
              }
              return
            }
          }
          
          // No messages yet, but it's the default conversation
          setConversationName('Chat')
          return
        }
        
        // Try to find the peer/contact for this conversation
        const peer = peers.find(p => p.id === conversationId)
        if (peer) {
          setConversationName(peer.name)
          return
        }
        
        // Try to get contact info via IPC (future enhancement)
        // For now, use peer name or fallback
        
        // Default fallback
        setConversationName('Messages')
      } catch (error) {
        console.error('[ChatView] Failed to load conversation details:', error)
        setConversationName('Messages')
      }
    }

    loadConversationDetails()
  }, [conversationId, messages, peers])

  const handleSendMessage = async (content: string, attachments?: any[]) => {
    setIsProcessing(true)
    onProcessingChange?.(true)

    // Check if this is an AI conversation to show processing indicator
    const isAIConversation = conversationId === 'default' ||
                             conversationId === 'ai-chat' ||
                             messages.some(m => m.isAI)

    if (isAIConversation) {
      setIsAIProcessing(true)
      setAiStreamingContent('')
    }

    try {
      await sendMessage(conversationId, content, attachments)

      // Update last message preview with the sent message
      if (onMessageUpdate) {
        onMessageUpdate(content)
      }
    } finally {
      setIsProcessing(false)
      onProcessingChange?.(false)
      // AI processing indicator will be cleared by streaming events
    }
  }

  // Test function to trigger message update
  const testMessageUpdate = useCallback(async () => {
    console.log('[ChatView] TEST: Triggering message update for:', conversationId)
    if (window.electronAPI) {
      try {
        const result = await window.electronAPI.invoke('test:triggerMessageUpdate', { conversationId })
        console.log('[ChatView] TEST: Trigger result:', result)
      } catch (error) {
        console.error('[ChatView] TEST: Failed to trigger:', error)
      }
    } else {
      console.error('[ChatView] TEST: No electronAPI available')
    }
  }, [conversationId])

  // Add test function to window for debugging
  useEffect(() => {
    (window as any).testMessageUpdate = testMessageUpdate
    console.log('[ChatView] Test function available: window.testMessageUpdate()')
    return () => {
      delete (window as any).testMessageUpdate
    }
  }, [testMessageUpdate])
  
  const handleClearConversation = async () => {
    if (confirm('Clear all messages in this conversation? This cannot be undone.')) {
      await lamaBridge.clearConversation(conversationId)
      // Reload the page to reset everything
      window.location.reload()
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle>{conversationName}</CardTitle>
          </div>
          {/* Removed trash button - deletion should be in conversation list context menu */}
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 min-h-0">
        <MessageView
          messages={messages}
          currentUserId={user?.id}
          onSendMessage={handleSendMessage}
          placeholder="Type a message..."
          showSender={true}
          loading={loading}
          isAIProcessing={isAIProcessing}
          aiStreamingContent={aiStreamingContent}
        />
      </CardContent>
    </Card>
  )
}