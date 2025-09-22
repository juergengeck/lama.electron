import React, { useState } from 'react'
import { MessageSquare, Sparkles, ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react'
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
  className?: string
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversationName,
  keywords,
  messageCount,
  onKeywordClick,
  className = ''
}) => {
  const [expanded, setExpanded] = useState(false)

  // Show limited keywords when collapsed, all when expanded
  const visibleKeywords = expanded ? keywords : keywords.slice(0, 5)
  const hasMoreKeywords = keywords.length > 5

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Export Chat</DropdownMenuItem>
              <DropdownMenuItem>Search Messages</DropdownMenuItem>
              <DropdownMenuItem>Clear Conversation</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Keywords Cloud */}
      {keywords.length > 0 && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            {visibleKeywords.map((keyword, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="cursor-pointer hover:bg-secondary/80 transition-colors text-xs"
                onClick={() => onKeywordClick?.(keyword)}
              >
                #{keyword}
              </Badge>
            ))}

            {/* Show more/less button */}
            {hasMoreKeywords && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    +{keywords.length - 5} more
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Quick stats when expanded */}
          {expanded && (
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{messageCount} messages</span>
              <span>•</span>
              <span>{keywords.length} keywords</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}