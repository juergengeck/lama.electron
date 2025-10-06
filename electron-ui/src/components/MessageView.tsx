import { useState, useEffect, useRef } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Loader2 } from 'lucide-react'
import { type Message, lamaBridge } from '@/bridge/lama-bridge'
import './MessageView.css'

// Import enhanced components
import { EnhancedMessageInput, type EnhancedAttachment } from './chat/EnhancedMessageInput'
import { EnhancedMessageBubble, type EnhancedMessageData } from './chat/EnhancedMessageBubble'

// Import attachment system
import { attachmentService } from '@/services/attachments/AttachmentService'
import { createAttachmentView } from '@/components/attachments/AttachmentViewFactory'
import type { MessageAttachment, BlobDescriptor } from '@/types/attachments'

// Import keyword detail panel
import { KeywordDetailPanel } from './KeywordDetail/KeywordDetailPanel'
import { Dialog, DialogContent } from '@/components/ui/dialog'

interface MessageViewProps {
  messages: Message[]
  currentUserId?: string
  onSendMessage: (content: string, attachments?: MessageAttachment[]) => Promise<void>
  placeholder?: string
  showSender?: boolean
  loading?: boolean
  participants?: string[] // List of participant IDs to determine if multiple people
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
  isAIProcessing = false,
  aiStreamingContent = '',
  topicId
}: MessageViewProps) {
  console.log('[MessageView] 🎨 Rendering with', messages.length, 'messages')
  if (messages.length > 0) {
    console.log('[MessageView] First message:', messages[0])
    console.log('[MessageView] Last message:', messages[messages.length - 1])
  }
  const [contactNames, setContactNames] = useState<Record<string, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)

  // Store attachment descriptors for display
  const [attachmentDescriptors, setAttachmentDescriptors] = useState<Map<string, BlobDescriptor>>(new Map())

  // Keyword detail dialog state
  const [showKeywordDetail, setShowKeywordDetail] = useState(false)
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null)
  
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
  
  // Track user scroll position
  const handleScroll = () => {
    if (!scrollAreaRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    // Consider user at bottom if within 50px
    setIsUserScrolledUp(distanceFromBottom > 50)
  }

  // Auto-scroll to bottom when new messages arrive (only if user hasn't scrolled up)
  useEffect(() => {
    if (isUserScrolledUp) return

    if (messagesEndRef.current) {
      // Use instant scroll during streaming for better UX, smooth scroll otherwise
      const behavior = aiStreamingContent ? 'instant' : 'smooth'
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' })
    }
  }, [messages, aiStreamingContent, isUserScrolledUp])



  // Enhanced send handler with proper attachment storage
  const handleEnhancedSend = async (text: string, attachments?: EnhancedAttachment[]) => {
    if (!text.trim() && (!attachments || attachments.length === 0)) {
      console.log('[MessageView] Empty message, not sending')
      return
    }

    try {
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
      await onSendMessage(messageContent, messageAttachments.length > 0 ? messageAttachments : undefined)

    } catch (error) {
      console.error('Failed to send enhanced message:', error)
    }
  }

  // Handle hashtag clicks - open keyword detail dialog
  const handleHashtagClick = (hashtag: string) => {
    console.log('[MessageView] Hashtag/keyword clicked:', hashtag, '| topicId:', topicId)

    if (topicId) {
      // Open keyword detail dialog
      setSelectedKeyword(hashtag)
      setShowKeywordDetail(true)
    } else {
      // No topicId available - can't show context-specific details
      console.warn('[MessageView] Cannot show keyword detail - no topicId available')
      alert(`Search for #${hashtag} - Feature coming soon!`)
    }
  }

  const handleCloseKeywordDetail = () => {
    setShowKeywordDetail(false)
    setSelectedKeyword(null)
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
      <div className="flex-1 px-4 py-2 overflow-y-auto" ref={scrollAreaRef} onScroll={handleScroll} style={{ minHeight: 0 }}>
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


      {/* Message input */}
      <EnhancedMessageInput
        onSendMessage={handleEnhancedSend}
        onHashtagClick={handleHashtagClick}
        placeholder={placeholder}
        theme="dark"
      />

      {/* Keyword Detail Dialog */}
      {showKeywordDetail && selectedKeyword && topicId && (
        <Dialog open={showKeywordDetail} onOpenChange={handleCloseKeywordDetail}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <KeywordDetailPanel
              keyword={selectedKeyword}
              topicId={topicId}
              onClose={handleCloseKeywordDetail}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}