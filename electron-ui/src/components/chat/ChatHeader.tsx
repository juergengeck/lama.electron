import React, { useState, useRef, useEffect } from 'react'
import { MessageSquare, ChevronLeft, ChevronRight, MoreHorizontal, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ChatHeaderProps {
  conversationName: string
  keywords: string[]
  messageCount: number
  onKeywordClick?: (keyword: string) => void
  hasAI?: boolean
  onToggleSummary?: () => void
  showSummary?: boolean
  className?: string
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversationName,
  keywords,
  messageCount,
  onKeywordClick,
  hasAI = false,
  onToggleSummary,
  showSummary = false,
  className = ''
}) => {
  console.log('[ChatHeader] Rendering with:', { conversationName, keywords: keywords.length, hasAI, messageCount })

  const [showLeftChevron, setShowLeftChevron] = useState(false)
  const [showRightChevron, setShowRightChevron] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Check if scrolling is needed and update chevron visibility
  const checkScrollPosition = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current

      // Show left chevron if scrolled right
      setShowLeftChevron(scrollLeft > 0)

      // Show right chevron if there's more content to scroll
      setShowRightChevron(scrollLeft + clientWidth < scrollWidth - 1)
    }
  }

  // Check scroll on mount and when keywords change
  useEffect(() => {
    checkScrollPosition()

    // Add resize observer to handle window resizing
    const resizeObserver = new ResizeObserver(() => {
      checkScrollPosition()
    })

    if (scrollContainerRef.current) {
      resizeObserver.observe(scrollContainerRef.current)
    }

    return () => {
      resizeObserver.disconnect()
    }
  }, [keywords])

  // Smooth scroll function
  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = scrollContainerRef.current.clientWidth * 0.75
      const currentScroll = scrollContainerRef.current.scrollLeft
      const targetScroll = direction === 'left'
        ? currentScroll - scrollAmount
        : currentScroll + scrollAmount

      scrollContainerRef.current.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className={`border-b bg-background ${className}`}>
      {/* Title Bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 flex-1">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">{conversationName}</h2>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Message & Keyword count - show next to brain icon */}
          {keywords.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mr-2">
              <span>{messageCount} messages</span>
              <span>•</span>
              <span>{keywords.length} keywords</span>
            </div>
          )}

          {/* AI Summary Button - only show for AI conversations */}
          {hasAI && (
            <Button
              variant={showSummary ? "default" : "ghost"}
              size="icon"
              className="h-8 w-8"
              onClick={onToggleSummary}
              title="AI Summary"
            >
              <Brain className="h-4 w-4" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={async () => {
                try {
                  console.log('[ChatHeader] Export Chat clicked for conversation:', conversationName);

                  // The conversation ID might be different from display name
                  // Common IDs are 'default' for the main chat
                  const conversationId = conversationName === 'Chat' || conversationName === 'General Chat' ? 'default' : conversationName;
                  console.log('[ChatHeader] Using conversation ID:', conversationId);

                  // Get all messages for this conversation
                  const messages = await window.electronAPI.invoke('chat:getMessages', {
                    conversationId: conversationId,
                    limit: 1000
                  });

                  console.log('[ChatHeader] Messages retrieved:', messages);

                  // Check both possible response formats
                  const messageList = messages.data || messages.messages || [];

                  if (messages.success && messageList && messageList.length > 0) {
                    console.log('[ChatHeader] Processing', messageList.length, 'messages');

                    // Format messages as markdown
                    const markdown = messageList.map(msg =>
                      `**${msg.senderName || 'Unknown'}** (${new Date(msg.timestamp).toLocaleString()}):\n${msg.content || msg.text || ''}\n`
                    ).join('\n---\n\n');

                    console.log('[ChatHeader] Markdown generated, length:', markdown.length);

                    // Export using IPC
                    const result = await window.electronAPI.invoke('export:file', {
                      content: markdown,
                      filename: `chat-${conversationName}-${Date.now()}.md`,
                      filters: [
                        { name: 'Markdown Files', extensions: ['md'] },
                        { name: 'Text Files', extensions: ['txt'] },
                        { name: 'All Files', extensions: ['*'] }
                      ]
                    });

                    console.log('[ChatHeader] Export result:', result);

                    if (result.success) {
                      console.log('[ChatHeader] Chat exported successfully to:', result.filePath);
                    } else if (result.canceled) {
                      console.log('[ChatHeader] Export canceled by user');
                    } else {
                      console.error('[ChatHeader] Export failed:', result.error);
                    }
                  } else {
                    console.log('[ChatHeader] No messages to export or failed to retrieve');
                  }
                } catch (error) {
                  console.error('[ChatHeader] Export error:', error);
                }
              }}>Export Chat (Markdown)</DropdownMenuItem>
              <DropdownMenuItem onClick={async () => {
                try {
                  console.log('[ChatHeader] Export HTML with Microdata clicked for conversation:', conversationName);

                  const conversationId = conversationName === 'Chat' || conversationName === 'General Chat' ? 'default' : conversationName;
                  console.log('[ChatHeader] Using conversation ID:', conversationId);

                  // Export using the new HTML with microdata handler
                  const result = await window.electronAPI.invoke('export:htmlWithMicrodata', {
                    topicId: conversationId,
                    format: 'html-microdata',
                    options: {
                      includeSignatures: true,
                      includeAttachments: true,
                      styleTheme: 'light'
                    }
                  });

                  console.log('[ChatHeader] HTML export result:', result);

                  if (result.success && result.html) {
                    // Save the HTML using the existing export:file handler
                    const saveResult = await window.electronAPI.invoke('export:file', {
                      content: result.html,
                      filename: `conversation-${conversationName}-${Date.now()}.html`,
                      filters: [
                        { name: 'HTML Files', extensions: ['html', 'htm'] },
                        { name: 'All Files', extensions: ['*'] }
                      ]
                    });

                    if (saveResult.success) {
                      console.log('[ChatHeader] HTML conversation exported successfully to:', saveResult.filePath);
                    } else if (saveResult.canceled) {
                      console.log('[ChatHeader] HTML export canceled by user');
                    } else {
                      console.error('[ChatHeader] HTML export save failed:', saveResult.error);
                    }
                  } else {
                    console.error('[ChatHeader] HTML export failed:', result.error);
                  }
                } catch (error) {
                  console.error('[ChatHeader] HTML export error:', error);
                }
              }}>Export HTML with Microdata</DropdownMenuItem>
              <DropdownMenuItem>Search Messages</DropdownMenuItem>
              <DropdownMenuItem>Clear Conversation</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Keywords Cloud with Horizontal Scroll */}
      {keywords.length > 0 && (
        <div className="px-4 pb-3 relative">
          <div className="flex items-center gap-2 relative">
            {/* Left Chevron */}
            {showLeftChevron && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 flex-shrink-0 z-10"
                onClick={() => scroll('left')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}

            {/* Keywords Container with Gradient Overlay */}
            <div className="relative flex-1 overflow-hidden">
              {/* Left Gradient Fade */}
              {showLeftChevron && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none"
                />
              )}

              {/* Scrollable Keywords Container */}
              <div
                ref={scrollContainerRef}
                className="flex gap-2 overflow-x-auto scrollbar-none scroll-smooth"
                onScroll={checkScrollPosition}
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitScrollbar: { display: 'none' }
                }}
              >
                {keywords.map((keyword, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="cursor-pointer hover:bg-secondary/80 transition-colors text-xs whitespace-nowrap flex-shrink-0"
                    onClick={() => onKeywordClick?.(keyword)}
                  >
                    #{keyword}
                  </Badge>
                ))}
              </div>

              {/* Right Gradient Fade */}
              {showRightChevron && (
                <div
                  className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none"
                />
              )}
            </div>

            {/* Right Chevron */}
            {showRightChevron && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-0 flex-shrink-0 z-10"
                onClick={() => scroll('right')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}