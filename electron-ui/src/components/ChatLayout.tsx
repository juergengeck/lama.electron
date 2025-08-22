import { useState, useEffect } from 'react'
import { MessageSquare, Plus, Trash2, Bot, Loader2, MoreVertical, Edit, Check, CheckCheck } from 'lucide-react'
import { ChatView } from './ChatView'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { InputDialog } from './InputDialog'

interface Conversation {
  id: string
  name: string
  lastMessage?: string
  lastMessageTime?: Date | string
  modelName?: string
}

interface ChatLayoutProps {
  selectedConversationId?: string
}

export function ChatLayout({ selectedConversationId }: ChatLayoutProps = {}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(selectedConversationId || null)
  const [searchQuery, setSearchQuery] = useState('')
  const [processingConversations, setProcessingConversations] = useState<Set<string>>(new Set())
  const [showNewChatDialog, setShowNewChatDialog] = useState(false)
  const [showRenameDialog, setShowRenameDialog] = useState(false)
  const [conversationToRename, setConversationToRename] = useState<string | null>(null)

  // Update selected conversation when prop changes
  useEffect(() => {
    if (selectedConversationId) {
      setSelectedConversation(selectedConversationId)
    }
  }, [selectedConversationId])

  // Load conversations from localStorage on startup
  useEffect(() => {
    const saved = localStorage.getItem('lama-conversations')
    if (saved) {
      try {
        let parsed = JSON.parse(saved)
        
        // Migrate old conversation IDs and ensure all have names
        parsed = parsed.map((conv: Conversation, index: number) => {
          // Ensure every conversation has a name
          if (!conv.name) {
            conv.name = conv.id === 'default' ? 'Chat with GPT-OSS' : `Chat ${index + 1}`
          }
          // Migrate old ID
          if (conv.id === 'default-ai-chat') {
            return { ...conv, id: 'default', name: conv.name || 'Chat with GPT-OSS' }
          }
          return conv
        })
        
        setConversations(parsed)
        if (selectedConversationId) {
          setSelectedConversation(selectedConversationId)
        } else if (parsed.length > 0 && !selectedConversation) {
          setSelectedConversation(parsed[0].id)
        }
        
        // Save migrated data back
        localStorage.setItem('lama-conversations', JSON.stringify(parsed))
      } catch (error) {
        console.error('Failed to load conversations:', error)
      }
    } else {
      // First time user - create a default AI chat
      const defaultConv: Conversation = {
        id: 'default',
        name: 'Chat with GPT-OSS',
        lastMessage: 'Hello! I\'m your local AI assistant powered by Ollama. How can I help you today?',
        lastMessageTime: new Date(),
        modelName: 'GPT-OSS'
      }
      setConversations([defaultConv])
      setSelectedConversation(defaultConv.id)
      localStorage.setItem('lama-conversations', JSON.stringify([defaultConv]))
    }
  }, [])

  // Save conversations to localStorage
  const saveConversations = (convs: Conversation[]) => {
    localStorage.setItem('lama-conversations', JSON.stringify(convs))
    setConversations(convs)
  }

  // Create new conversation with the provided name
  const handleCreateConversation = async (chatName: string) => {
    try {
      if (!window.electronAPI) {
        throw new Error('Electron API not available')
      }
      
      // Create conversation through IPC handler
      const result = await window.electronAPI.invoke('chat:createConversation', {
        type: 'direct',
        participants: [],
        name: chatName
      })
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to create conversation')
      }
      
      const newConv: Conversation = {
        id: result.data.id,
        name: result.data.name || chatName,
        lastMessage: result.data.lastMessage?.text,
        lastMessageTime: result.data.lastMessageAt || new Date(),
        modelName: 'GPT-OSS'
      }
      const updated = [newConv, ...conversations]
      saveConversations(updated)
      setSelectedConversation(newConv.id)
    } catch (error: any) {
      console.error('[ChatLayout] Error creating conversation:', error)
      const errorMessage = error?.message || 'Failed to create conversation'
      alert(`Error: ${errorMessage}`)
    }
  }

  // Delete conversation
  const deleteConversation = (id: string) => {
    const updated = conversations.filter(c => c.id !== id)
    saveConversations(updated)
    if (selectedConversation === id) {
      setSelectedConversation(updated.length > 0 ? updated[0].id : null)
    }
  }

  // Handle rename conversation
  const handleRenameConversation = (newName: string) => {
    if (!conversationToRename) return
    
    const updated = conversations.map(c => 
      c.id === conversationToRename ? { ...c, name: newName } : c
    )
    saveConversations(updated)
    setConversationToRename(null)
  }
  
  // Open rename dialog
  const openRenameDialog = (id: string) => {
    setConversationToRename(id)
    setShowRenameDialog(true)
  }

  // Filter conversations by search
  const filteredConversations = conversations.filter(conv =>
    conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Format time for display
  const formatTime = (time?: Date | string): string => {
    if (!time) return ''
    const date = typeof time === 'string' ? new Date(time) : time
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    
    if (hours < 1) return 'now'
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return time.toLocaleDateString()
  }

  return (
    <>
    <div className="flex h-full">
      {/* Sidebar with conversation list */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Conversations</h2>
            <Button
              onClick={() => setShowNewChatDialog(true)}
              size="icon"
              variant="ghost"
              className="h-8 w-8"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Search */}
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8"
          />
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No matches found</p>
                <p className="text-xs">Try a different search</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv.id)}
                  className={`group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedConversation === conv.id
                      ? 'bg-primary/10 border-2 border-primary/20'
                      : 'hover:bg-muted border-2 border-transparent'
                  }`}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {processingConversations.has(conv.id) ? (
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    ) : (
                      <Bot className="w-5 h-5 text-primary" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-medium text-sm truncate">{conv.name}</h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            onClick={(e) => e.stopPropagation()}
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              openRenameDialog(conv.id)
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteConversation(conv.id)
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {conv.lastMessage && (
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                        {conv.lastMessage.length > 50 
                          ? conv.lastMessage.substring(0, 50) + '...'
                          : conv.lastMessage
                        }
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatTime(conv.lastMessageTime)}</span>
                      <div className="flex items-center gap-1">
                        {conv.lastMessage && (
                          <CheckCheck className="h-3 w-3 text-primary/70" />
                        )}
                        <span className="text-primary">{conv.modelName}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main chat area */}
      <div className="flex-1">
        {selectedConversation ? (
          <ChatView 
            key={selectedConversation} 
            conversationId={selectedConversation}
            onProcessingChange={(isProcessing) => {
              setProcessingConversations(prev => {
                const next = new Set(prev)
                if (isProcessing) {
                  next.add(selectedConversation)
                } else {
                  next.delete(selectedConversation)
                }
                return next
              })
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg mb-2">Welcome to LAMA</p>
              <p className="text-sm">Select a conversation or create a new one to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* New Chat Dialog */}
    <InputDialog
      open={showNewChatDialog}
      onOpenChange={setShowNewChatDialog}
      title="New Chat"
      description="Enter a name for your new chat conversation"
      label="Chat Name"
      placeholder="e.g., Project Discussion"
      defaultValue={`Chat ${conversations.length + 1}`}
      onSubmit={handleCreateConversation}
    />

    {/* Rename Chat Dialog */}
    <InputDialog
      open={showRenameDialog}
      onOpenChange={setShowRenameDialog}
      title="Rename Chat"
      description="Enter a new name for this chat"
      label="Chat Name"
      defaultValue={conversations.find(c => c.id === conversationToRename)?.name || ''}
      onSubmit={handleRenameConversation}
    />
  </>
  )
}