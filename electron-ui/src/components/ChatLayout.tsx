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

  // Load conversations from Node.js
  useEffect(() => {
    const loadConversations = async () => {
      try {
        if (!window.electronAPI) {
          throw new Error('Electron API not available')
        }
        
        const result = await window.electronAPI.invoke('chat:getConversations')
        if (!result.success) {
          throw new Error(result.error || 'Failed to get conversations')
        }
        
        const conversations = result.data || []
        
        // Convert to UI format
        const uiConversations: Conversation[] = conversations.map((conv: any) => ({
          id: conv.id,
          name: conv.name || 'Unnamed Chat',
          lastMessage: conv.lastMessage?.text || '',
          lastMessageTime: new Date(conv.lastMessageTime || conv.createdAt || Date.now()),
          modelName: conv.modelName || 'GPT-OSS'
        }))
        
        setConversations(uiConversations)
        
        if (selectedConversationId) {
          setSelectedConversation(selectedConversationId)
        } else if (uiConversations.length > 0 && !selectedConversation) {
          setSelectedConversation(uiConversations[0].id)
        }
      } catch (error) {
        console.error('Failed to load conversations:', error)
        setConversations([])
      }
    }
    
    loadConversations()
  }, [])

  // Reload conversations from Node.js
  const reloadConversations = async () => {
    try {
      if (!window.electronAPI) return
      
      const result = await window.electronAPI.invoke('chat:getConversations')
      if (!result.success) return
      
      const conversations = result.data || []
      const uiConversations: Conversation[] = conversations.map((conv: any) => ({
        id: conv.id,
        name: conv.name || 'Unnamed Chat',
        lastMessage: conv.lastMessage?.text || '',
        lastMessageTime: new Date(conv.lastMessageTime || conv.createdAt || Date.now()),
        modelName: conv.modelName || 'GPT-OSS'
      }))
      
      setConversations(uiConversations)
    } catch (error) {
      console.error('Failed to reload conversations:', error)
    }
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
      
      // Reload conversations from Node.js to get fresh data
      await reloadConversations()
      setSelectedConversation(result.data.id)
      
      // Mark as processing since welcome message will be generated
      setProcessingConversations(prev => {
        const next = new Set(prev)
        next.add(result.data.id)
        return next
      })
    } catch (error: any) {
      console.error('[ChatLayout] Error creating conversation:', error)
      const errorMessage = error?.message || 'Failed to create conversation'
      alert(`Error: ${errorMessage}`)
    }
  }

  // Delete conversation
  const deleteConversation = async (id: string) => {
    try {
      // For now, just remove from UI - add IPC handler later if needed
      const updated = conversations.filter(c => c.id !== id)
      setConversations(updated)
      if (selectedConversation === id) {
        setSelectedConversation(updated.length > 0 ? updated[0].id : null)
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  // Handle rename conversation
  const handleRenameConversation = (newName: string) => {
    if (!conversationToRename) return
    
    // Update locally for now - add IPC handler later if needed
    const updated = conversations.map(c => 
      c.id === conversationToRename ? { ...c, name: newName } : c
    )
    setConversations(updated)
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
            isInitiallyProcessing={processingConversations.has(selectedConversation)}
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
            onMessageUpdate={(lastMessage: string) => {
              // Update the conversation's last message for preview
              setConversations(prev => prev.map(conv => 
                conv.id === selectedConversation 
                  ? { ...conv, lastMessage, lastMessageTime: new Date() }
                  : conv
              ))
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