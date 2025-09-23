import { useState, useEffect, useRef } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Loader2, Copy, Edit, Trash2, MoreVertical, Check, CheckCheck } from 'lucide-react'
import { type Message, lamaBridge } from '@/bridge/lama-bridge'
// ReactMarkdown is now handled by FormattedMessageContent component
import { FormattedMessageContent } from './chat/FormattedMessageContent'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import './MessageView.css'

// Import enhanced components
import { EnhancedMessageInput, type EnhancedAttachment } from './chat/EnhancedMessageInput'
import { EnhancedMessageBubble, type EnhancedMessageData } from './chat/EnhancedMessageBubble'

// Import attachment system
import { attachmentService } from '@/services/attachments/AttachmentService'
import { createAttachmentView } from '@/components/attachments/AttachmentViewFactory'
import type { MessageAttachment, BlobDescriptor } from '@/types/attachments'

interface MessageViewProps {
  messages: Message[]
  currentUserId?: string
  onSendMessage: (content: string, attachments?: MessageAttachment[]) => Promise<void>
  placeholder?: string
  showSender?: boolean
  loading?: boolean
  participants?: string[] // List of participant IDs to determine if multiple people
  useEnhancedUI?: boolean // Toggle for enhanced UI components
  isAIProcessing?: boolean // Show typing indicator when AI is processing
  aiStreamingContent?: string // Show partial AI response while streaming
  topicId?: string // Topic ID for context panel
}

export function MessageView({
  messages,
  currentUserId = 'user-1',
  onSendMessage,
  placeholder = 'Type a message...',
  showSender = true,
  loading = false,
  participants = [],
  useEnhancedUI = true, // Enable enhanced UI for attachments
  isAIProcessing = false,
  aiStreamingContent = '',
  topicId
}: MessageViewProps) {
  console.log('[MessageView] 🎨 Rendering with', messages.length, 'messages')
  if (messages.length > 0) {
    console.log('[MessageView] First message:', messages[0])
    console.log('[MessageView] Last message:', messages[messages.length - 1])
  }
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [contactNames, setContactNames] = useState<Record<string, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  
  // Store attachment descriptors for display
  const [attachmentDescriptors, setAttachmentDescriptors] = useState<Map<string, BlobDescriptor>>(new Map())
  
  // Load contact names
  useEffect(() => {
    const loadContactNames = async () => {
      try {
        const contacts = await lamaBridge.getContacts()
        const names: Record<string, string> = {}
        
        // Map contact IDs to names
        for (const contact of contacts) {
          if (contact.id) {
            names[contact.id] = contact.displayName || contact.name || 'Unknown'
          }
        }
        
        // Don't add "You" label - users aren't idiots
        
        setContactNames(names)
      } catch (error) {
        console.error('Failed to load contact names:', error)
      }
    }
    
    loadContactNames()
  }, [currentUserId])
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    // Use multiple techniques to ensure scrolling works
    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
        // Method 1: Direct scroll
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
        
        // Method 2: Scroll into view for the end marker
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
        }
      }
    }
    
    // Immediate scroll
    scrollToBottom()
    
    // Delayed scroll to catch any layout changes
    const timer1 = setTimeout(scrollToBottom, 50)
    const timer2 = setTimeout(scrollToBottom, 100)
    const timer3 = setTimeout(scrollToBottom, 200)
    
    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
    }
  }, [messages, aiStreamingContent, sending])



  const handleSend = async () => {
    if (!input.trim() || sending) return

    try {
      setSending(true)
      console.log('[MessageView] 🎯 Starting message send with:', input)
      const startTime = performance.now()
      await onSendMessage(input)
      const elapsed = performance.now() - startTime
      console.log(`[MessageView] ✅ Message sent in ${elapsed.toFixed(2)}ms`)
      setInput('')
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }

  // Enhanced send handler with proper attachment storage
  const handleEnhancedSend = async (text: string, attachments?: EnhancedAttachment[]) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) {
      console.log('[MessageView] Empty message, not sending')
      return
    }
    
    try {
      setSending(true)
      console.log('[MessageView] 🎯 Enhanced send with:', text, attachments?.length, 'attachments')
      
      // Extract hashtags from text
      const hashtagRegex = /#[\w-]+/g
      const hashtags = text.match(hashtagRegex) || []
      console.log('[MessageView] Extracted hashtags:', hashtags)
      
      let messageContent = text
      const messageAttachments: MessageAttachment[] = []
      
      // Process and store attachments using AttachmentService
      if (attachments && attachments.length > 0) {
        console.log('[MessageView] Processing attachments with AttachmentService')
        
        for (const attachment of attachments) {
          try {
            // Convert File to ArrayBuffer first
            const arrayBuffer = await attachment.file.arrayBuffer()

            // Store attachment in ONE platform
            const result = await attachmentService.storeAttachment(arrayBuffer, {
              name: attachment.file.name,
              mimeType: attachment.file.type || 'application/octet-stream',
              size: attachment.file.size
            })

            // Extract hash from result
            const hash = result.hash || result.id || result
            
            // Create message attachment reference
            const messageAttachment: MessageAttachment = {
              hash,
              type: 'blob',
              mimeType: attachment.file.type,
              name: attachment.file.name,
              size: attachment.file.size
            }
            messageAttachments.push(messageAttachment)
            
            // Cache the descriptor for immediate display
            const descriptor: BlobDescriptor = {
              data: await attachment.file.arrayBuffer(),
              type: attachment.file.type,
              name: attachment.file.name,
              size: attachment.file.size,
              lastModified: attachment.file.lastModified
            }
            setAttachmentDescriptors(prev => {
              const newMap = new Map(prev)
              newMap.set(hash, descriptor)
              return newMap
            })
            
            console.log(`[MessageView] Stored attachment ${attachment.file.name} with hash: ${hash}`)
          } catch (error) {
            console.error(`[MessageView] Failed to store attachment ${attachment.file.name}:`, error)
          }
        }
      }
      
      // Send the message with attachments
      // Pass attachments directly to onSendMessage
      await onSendMessage(messageContent, messageAttachments.length > 0 ? messageAttachments : undefined)
      
    } catch (error) {
      console.error('Failed to send enhanced message:', error)
    } finally {
      setSending(false)
    }
  }

  // Handle hashtag clicks
  const handleHashtagClick = (hashtag: string) => {
    console.log('[MessageView] Hashtag clicked:', hashtag)
    // TODO: Implement hashtag search/filtering
    alert(`Search for #${hashtag} - Feature coming soon!`)
  }

  // Handle attachment clicks
  const handleAttachmentClick = (attachmentId: string) => {
    console.log('[MessageView] Attachment clicked:', attachmentId)
    // TODO: Implement attachment viewer
  }

  // Handle attachment downloads
  const handleDownloadAttachment = (attachmentId: string) => {
    console.log('[MessageView] Download attachment:', attachmentId)
    // TODO: Implement attachment download
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="loading-spinner" />
      </div>
    )
  }

  // Determine if we should show sender labels (only when multiple other participants)
  const otherParticipants = participants.filter(p => p !== currentUserId)
  const shouldShowSenderLabels = otherParticipants.length > 1

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 px-4 py-2 overflow-y-auto" ref={scrollAreaRef} style={{ minHeight: 0 }}>
        <div className="space-y-4">
          {messages.length === 0 && !loading && !isAIProcessing && !aiStreamingContent && (
            <div className="text-center py-8 text-muted-foreground">
              No messages yet. Start a conversation!
            </div>
          )}
          {messages.map((message) => {
            // Check if this is the current user's message
            const isCurrentUser = message.senderId === 'user' || message.senderId === currentUserId
            // Use the isAI flag from the message
            const isAIMessage = message.isAI === true
            console.log(`[MessageView] Rendering message - senderId: "${message.senderId}", currentUserId: "${currentUserId}", isCurrentUser: ${isCurrentUser}, isAI: ${isAIMessage}, content: "${message.content.substring(0, 50)}..."`)
            
            // Always use EnhancedMessageBubble for consistent rendering and features
            // Extract hashtags from message content
            const hashtagRegex = /#[\w-]+/g
            const hashtags = message.content.match(hashtagRegex) || []
            const subjects = hashtags.map(tag => tag.slice(1)) // Remove # prefix

            

            const enhancedMessage: EnhancedMessageData = {
              id: message.id,
              text: message.content, // Use cleaned text without attachment references
              senderId: message.senderId,
              senderName: message.senderName || contactNames[message.senderId] || 'Unknown',
              timestamp: message.timestamp,
              isOwn: isCurrentUser,
              subjects: subjects,
              trustLevel: 3, // Default colleague level
              attachments: message.attachments,
              topicName: message.topicName, // Pass topic name to enhanced bubble
              format: message.format || 'markdown' // Use message format if available, otherwise markdown
            }

            console.log(`[MessageView] Passing to EnhancedMessageBubble:`, {
              id: enhancedMessage.id,
              hasText: !!enhancedMessage.text,
              textLength: enhancedMessage.text?.length,
              format: enhancedMessage.format
            })

            return (
              <EnhancedMessageBubble
                key={message.id}
                message={enhancedMessage}
                onHashtagClick={handleHashtagClick}
                onAttachmentClick={handleAttachmentClick}
                onDownloadAttachment={handleDownloadAttachment}
                theme="dark"
                attachmentDescriptors={attachmentDescriptors}
              />
            )
          })}
          
          {/* AI Typing Indicator or Streaming Content */}
          {(isAIProcessing || aiStreamingContent) && (
            <>
              {aiStreamingContent ? (
                // Use EnhancedMessageBubble for streaming content to ensure consistent markdown rendering
                <EnhancedMessageBubble
                  message={{
                    id: 'streaming-ai-message',
                    text: aiStreamingContent,
                    senderId: 'ai',
                    senderName: 'AI Assistant',
                    timestamp: new Date(),
                    isOwn: false,
                    subjects: [],
                    trustLevel: 5,
                    format: 'markdown' // Ensure markdown format for proper rendering
                  }}
                  onHashtagClick={handleHashtagClick}
                  onAttachmentClick={handleAttachmentClick}
                  onDownloadAttachment={handleDownloadAttachment}
                  theme="dark"
                  attachmentDescriptors={attachmentDescriptors}
                />
              ) : (
                // Show typing indicator with proper AI message styling
                <div className="flex gap-2 mb-2 justify-start">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs">AI</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <div className="message-bubble message-bubble-ai">
                      <div className="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>


      {/* Message input - Use enhanced or classic based on prop */}
      {useEnhancedUI ? (
        <EnhancedMessageInput
          onSendMessage={handleEnhancedSend}
          onHashtagClick={handleHashtagClick}
          placeholder={placeholder}
          disabled={sending}
          theme="dark"
        />
      ) : (
        <div className="p-4 border-t">
          <div className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={sending}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              size="icon"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}