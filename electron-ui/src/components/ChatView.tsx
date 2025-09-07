import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MessageView } from './MessageView'
import { useLamaMessages, useLamaAuth, useLamaPeers } from '@/hooks/useLama'
import { MessageSquare } from 'lucide-react'
import { lamaBridge } from '@/bridge/lama-bridge'

export function ChatView({ 
  conversationId = 'default',
  onProcessingChange
}: { 
  conversationId?: string
  onProcessingChange?: (isProcessing: boolean) => void
}) {
  const { messages, loading, sendMessage } = useLamaMessages(conversationId)
  const { user } = useLamaAuth()
  const { peers } = useLamaPeers()
  const [conversationName, setConversationName] = useState<string>('Messages')
  const [isProcessing, setIsProcessing] = useState(false)
  const [isAIProcessing, setIsAIProcessing] = useState(false)
  const [aiStreamingContent, setAiStreamingContent] = useState('')

  // Listen for AI streaming events
  useEffect(() => {
    const handleStreamEvent = (event: any) => {
      if (event.conversationId === conversationId) {
        if (event.isThinking) {
          setIsAIProcessing(true)
          setAiStreamingContent('')
        } else if (event.partial) {
          setIsAIProcessing(false)
          setAiStreamingContent(event.partial)
        } else if (event.chunk === null || event.chunk === undefined) {
          // Stream ended
          setIsAIProcessing(false)
          setAiStreamingContent('')
        }
      }
    }
    
    // Subscribe to streaming events
    const unsubscribe = lamaBridge.on('message:stream', handleStreamEvent)
    
    return () => {
      if (unsubscribe) unsubscribe()
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
              try {
                const appModel = lamaBridge.getAppModel()
                if (appModel?.llmManager) {
                  // Get loaded models
                  const loadedModels = appModel.llmManager.getLoadedModels?.()
                  
                  if (loadedModels && loadedModels.length > 0) {
                    // Use the first loaded model (usually the active one)
                    const activeModel = loadedModels[0]
                    
                    if (activeModel && activeModel.name) {
                      // Format the model name properly
                      let modelName = activeModel.name
                      
                      // Special formatting for known model patterns
                      if (modelName.toLowerCase().includes('gpt') && modelName.toLowerCase().includes('oss')) {
                        modelName = 'GPT-OSS'
                      } else if (modelName.toLowerCase() === 'llama') {
                        modelName = 'Llama'
                      } else if (modelName.toLowerCase().includes('ollama')) {
                        modelName = 'Ollama'
                      } else {
                        // General formatting for other models
                        modelName = modelName
                          .replace(/[-_]/g, ' ')
                          .split(' ')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                          .join(' ')
                      }
                      
                      console.log(`[ChatView] Using AI model name: ${modelName}`)
                      setConversationName(modelName)
                      return
                    }
                  }
                  
                  // Try to get from available models if no loaded models
                  const availableModels = appModel.llmManager.getAvailableModels?.()
                  if (availableModels && availableModels.length > 0) {
                    const firstModel = availableModels[0]
                    if (firstModel && firstModel.name) {
                      let modelName = firstModel.name
                      
                      // Format the name
                      if (modelName.toLowerCase().includes('gpt') && modelName.toLowerCase().includes('oss')) {
                        modelName = 'GPT-OSS'
                      } else {
                        modelName = modelName
                          .replace(/[-_]/g, ' ')
                          .split(' ')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                          .join(' ')
                      }
                      
                      setConversationName(modelName)
                      return
                    }
                  }
                }
              } catch (error) {
                console.warn('[ChatView] Could not get AI model info:', error)
              }
              
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
        
        // Try to get contact info from app model
        const appModel = lamaBridge.getAppModel()
        if (appModel) {
          const contacts = await appModel.getContacts?.()
          if (contacts) {
            const contact = contacts.find((c: any) => c.id === conversationId)
            if (contact) {
              setConversationName(contact.name || contact.displayName || 'Contact')
              return
            }
          }
        }
        
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
    console.log('\n🔴🔴🔴 CRITICAL TRACE: handleSendMessage CALLED 🔴🔴🔴')
    console.log('[ChatView] handleSendMessage called with:', content, 'attachments:', attachments?.length || 0, 'for conversation:', conversationId)
    console.trace('Call stack for message send')
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
      console.log('[ChatView] sendMessage completed for conversation:', conversationId)
    } finally {
      setIsProcessing(false)
      onProcessingChange?.(false)
      // AI processing indicator will be cleared by streaming events
    }
  }
  
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