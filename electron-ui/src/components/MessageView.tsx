import { useState, useEffect, useRef } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Loader2, Copy, Edit, Trash2, MoreVertical, Check, CheckCheck } from 'lucide-react'
import { type Message } from '@/bridge/lama-bridge'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
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
  onSendMessage: (content: string) => Promise<void>
  placeholder?: string
  showSender?: boolean
  loading?: boolean
  participants?: string[] // List of participant IDs to determine if multiple people
  useEnhancedUI?: boolean // Toggle for enhanced UI components
}

export function MessageView({ 
  messages, 
  currentUserId = 'user-1',
  onSendMessage,
  placeholder = 'Type a message...',
  showSender = true,
  loading = false,
  participants = [],
  useEnhancedUI = true // Enable enhanced UI for attachments
}: MessageViewProps) {
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
    // Use setTimeout to ensure DOM has updated
    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
      }
    }, 0)
  }, [messages])



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
            // Store attachment in ONE platform
            const hash = await attachmentService.storeAttachment(attachment.file, {
              generateThumbnail: attachment.type === 'image' || attachment.type === 'video',
              extractSubjects: true,
              trustLevel: attachment.trustLevel,
              onProgress: (progress) => {
                console.log(`[MessageView] Upload progress for ${attachment.file.name}: ${progress}%`)
              }
            })
            
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
      
      // Send the message with attachment references
      // In a real implementation, we'd modify onSendMessage to accept attachments
      // For now, we'll append attachment info to the message
      if (messageAttachments.length > 0) {
        // This is temporary - ideally the bridge would handle attachments properly
        messageContent += `\n\n[Attachments: ${messageAttachments.map(a => a.hash).join(', ')}]`
      }
      
      await onSendMessage(messageContent)
      
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
      <div className="flex-1 p-4 overflow-y-auto" ref={scrollAreaRef}>
        <div className="space-y-4">
          {messages.map((message) => {
            // Check if this is the current user's message
            const isCurrentUser = message.senderId === 'user' || message.senderId === currentUserId
            // Use the isAI flag from the message
            const isAIMessage = message.isAI === true
            console.log(`[MessageView] Rendering message - senderId: "${message.senderId}", currentUserId: "${currentUserId}", isCurrentUser: ${isCurrentUser}, isAI: ${isAIMessage}, content: "${message.content.substring(0, 50)}..."`)
            
            // Convert to enhanced message format for enhanced UI
            if (useEnhancedUI) {
              // Extract hashtags from message content
              const hashtagRegex = /#[\w-]+/g
              const hashtags = message.content.match(hashtagRegex) || []
              const subjects = hashtags.map(tag => tag.slice(1)) // Remove # prefix
              
              // Check if message contains attachment indicator
              let messageAttachmentsList: any[] = []
              if (message.content.includes('📎 Attachments:')) {
                // Try to find attachments for recent messages
                // Look through stored attachments for a match
                for (const [key, atts] of messageAttachments.entries()) {
                  // Simple heuristic: if this message was sent recently and mentions attachments
                  if (isCurrentUser && message.content.includes(atts[0]?.name)) {
                    messageAttachmentsList = atts
                    console.log('[MessageView] Found attachments for message:', atts)
                    break
                  }
                }
              }
              
              const enhancedMessage: EnhancedMessageData = {
                id: message.id,
                text: message.content,
                senderId: message.senderId,
                senderName: isAIMessage ? 'AI' : (contactNames[message.senderId] || 'Unknown'),
                timestamp: message.timestamp,
                isOwn: isCurrentUser,
                subjects: subjects,
                trustLevel: 3, // Default colleague level
                attachments: messageAttachmentsList
              }
              
              return (
                <EnhancedMessageBubble
                  key={message.id}
                  message={enhancedMessage}
                  onHashtagClick={handleHashtagClick}
                  onAttachmentClick={handleAttachmentClick}
                  onDownloadAttachment={handleDownloadAttachment}
                  theme="dark"
                />
              )
            }
            
            return (
              <div
                key={message.id}
                className={`flex gap-2 mb-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isCurrentUser && (shouldShowSenderLabels || isAIMessage) && (
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {isAIMessage ? 'AI' : (contactNames[message.senderId] || 'Unknown').substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="flex flex-col max-w-[70%]">
                  <div
                    className={`message-bubble relative group ${
                      isCurrentUser
                        ? 'message-bubble-user'
                        : isAIMessage 
                          ? 'message-bubble-ai'
                          : 'message-bubble-other'
                    }`}
                  >
                    <div className="flex items-end gap-2">
                      <div className="flex-1 pr-1">
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Style tables to inherit from bubble
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-2">
                              <table className="border-collapse w-full">{children}</table>
                            </div>
                          ),
                          th: ({ children }) => (
                            <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold">{children}</th>
                          ),
                          td: ({ children }) => (
                            <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{children}</td>
                          ),
                          // Code blocks - use subtle overlay based on message type
                          code: ({ inline, children }) => {
                            const bgClass = isCurrentUser 
                              ? 'bg-white/20' 
                              : 'bg-black/5 dark:bg-white/5'
                            const borderClass = isCurrentUser
                              ? 'border-white/20'
                              : 'border-black/10 dark:border-white/10'
                            
                            return inline ? (
                              <code className={`${bgClass} px-1 rounded`}>{children}</code>
                            ) : (
                              <code className={`block ${bgClass} p-2 rounded my-2 overflow-x-auto border ${borderClass}`}>{children}</code>
                            )
                          },
                          // Style links
                          a: ({ children, href }) => (
                            <a href={href} className="underline hover:opacity-80" target="_blank" rel="noopener noreferrer">{children}</a>
                          ),
                          // Style paragraphs - inherit color from bubble
                          p: ({ children }) => (
                            <p className="mb-2">{children}</p>
                          ),
                          // Style lists
                          ul: ({ children }) => (
                            <ul className="list-disc list-inside mb-2">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal list-inside mb-2">{children}</ol>
                          )
                        }}
                      >
                        {message.content}
                      </ReactMarkdown>
                      </div>
                      {/* Status indicators and menu for user messages */}
                      {isCurrentUser && (
                        <div className="flex items-end gap-1 text-xs text-white/60 pb-0.5 shrink-0">
                          {/* Send time */}
                          <span className="text-[10px]">
                            {message.timestamp.toLocaleTimeString('en-US', { 
                              hour: 'numeric', 
                              minute: '2-digit',
                              hour12: true 
                            }).toLowerCase()}
                          </span>
                          {/* Message status checkmarks */}
                          <CheckCheck className="h-3 w-3" />
                          {/* Three dots menu on hover */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-transparent opacity-0 group-hover:opacity-100 transition-opacity ml-0.5">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigator.clipboard.writeText(message.content)}>
                                  <Copy className="mr-2 h-4 w-4" />
                                  Copy
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                    
                    {/* Render attachments if present */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {message.attachments.map((attachment, index) => {
                          const descriptor = attachmentDescriptors.get(attachment.hash)
                          return createAttachmentView(
                            attachment,
                            descriptor,
                            {
                              key: `${message.id}-attachment-${index}`,
                              mode: 'inline',
                              onClick: handleAttachmentClick,
                              onDownload: handleDownloadAttachment,
                              className: 'mt-2'
                            }
                          )
                        })}
                      </div>
                    )}
                    
                  </div>
                </div>
              </div>
            )
          })}
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