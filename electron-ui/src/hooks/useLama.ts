import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { lamaBridge, type Message, type Peer } from '@/bridge/lama-bridge'

// Main hook to access the bridge
export function useLama() {
  return {
    bridge: lamaBridge
  }
}

export function useLamaMessages(conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([])
  const [updateCounter, setUpdateCounter] = useState(0) // Force re-render counter

  useEffect(() => {
    // Reset initial load flag when conversation changes
    setIsInitialLoad(true)
    
    let debounceTimer: NodeJS.Timeout | null = null
    let mounted = true
    
    const loadMessages = async () => {
      if (!mounted) return
      
      try {
        // Only show loading spinner on initial load, not on updates
        if (isInitialLoad && mounted) {
          setLoading(true)
        }
        const msgs = await lamaBridge.getMessages(conversationId)
        console.log('🔵🔵🔵 MESSAGES LOADED from lamaBridge.getMessages:', msgs.length, 'messages')
        msgs.forEach((msg, idx) => {
          console.log(`  Message ${idx + 1}:`, {
            content: msg.content.substring(0, 30),
            senderId: msg.senderId?.substring(0, 8),
            timestamp: msg.timestamp
          })
        })
        
        if (mounted) {
          setMessages(msgs)
          setIsInitialLoad(false)
          setUpdateCounter(prev => prev + 1) // Force re-render
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load messages')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    loadMessages()

    // Listen for topic updates - reload for ANY update or matching conversation
    const handleTopicUpdate = (data: { conversationId?: string; source?: string } | undefined) => {
      console.log('[useLamaMessages] 📨 Received update event, data:', data, 'for conversation:', conversationId)
      
      // Reload if no data (generic update) OR if this conversation was updated
      const shouldReload = !data || data?.conversationId === conversationId
      
      if (shouldReload) {
        console.log('[useLamaMessages] ✅ Will reload messages for conversation:', conversationId)
        
        // Clear optimistic messages since we're getting real data
        setOptimisticMessages([])
        
        // Debounce multiple rapid updates
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        
        // Use shorter debounce for CHUM updates to ensure quick refresh
        const debounceDelay = data?.source === 'node-chum-listener' ? 50 : 100
        
        debounceTimer = setTimeout(() => {
          if (mounted) {
            console.log('[useLamaMessages] 🔄 Executing loadMessages after debounce')
            loadMessages()
          }
        }, debounceDelay)
      } else {
        console.log('[useLamaMessages] ⏭️ Skipping reload - different conversation')
      }
    }

    // Listen for new peer messages pushed from the backend
    const handleNewMessages = (data: { conversationId: string; messages: Message[] }) => {
      console.log('[useLamaMessages] 📬 New peer messages received:', data.messages.length, 'for:', data.conversationId)
      
      if (data.conversationId === conversationId && mounted) {
        console.log('[useLamaMessages] 🔄 Refreshing messages due to new peer messages')
        // Force reload to get all messages including the new ones
        loadMessages()
      }
    }
    
    console.log('[useLamaMessages] Setting up listeners for conversationId:', conversationId)
    lamaBridge.on('message:updated', handleTopicUpdate)
    lamaBridge.on('chat:newMessages', handleNewMessages)
    
    return () => {
      mounted = false
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      lamaBridge.off('message:updated', handleTopicUpdate)
      lamaBridge.off('chat:newMessages', handleNewMessages)
    }
  }, [conversationId])

  const sendMessage = useCallback(async (topicId: string, content: string, attachments?: any[]) => {
    try {
      console.log('[useLama] 🚀 Starting sendMessage with:', { topicId, content, attachments: attachments?.length || 0 })
      
      // Add optimistic message immediately
      const optimisticMessage: Message = {
        id: `optimistic-${Date.now()}`,
        senderId: 'user',
        content,
        timestamp: new Date(),
        encrypted: false,
        isAI: false,
        attachments,
        topicId
      }
      
      // Add to optimistic messages immediately for instant display
      setOptimisticMessages(prev => [...prev, optimisticMessage])
      setUpdateCounter(prev => prev + 1) // Force re-render
      
      const messageId = await lamaBridge.sendMessage(topicId, content, attachments)
      console.log('[useLama] ✅ sendMessage completed, messageId:', messageId, 'for topic:', topicId)
      
      // Force a refresh after a short delay to ensure we get the message
      setTimeout(async () => {
        console.log('[useLama] 🔄 Force refreshing messages after send')
        try {
          const msgs = await lamaBridge.getMessages(topicId)
          console.log('[useLama] 📥 Got', msgs.length, 'messages after force refresh')
          setMessages(msgs)
          setOptimisticMessages([]) // Clear all optimistic messages
          setUpdateCounter(prev => prev + 1) // Force re-render
        } catch (err) {
          console.error('[useLama] Force refresh failed:', err)
        }
      }, 500)
      
      return messageId
    } catch (err) {
      console.error('[useLama] sendMessage error:', err)
      // Remove optimistic message on error
      setOptimisticMessages([])
      setError(err instanceof Error ? err.message : 'Failed to send message')
      throw err
    }
  }, [])

  // Combine real messages with optimistic ones for display
  // Use useMemo to ensure React sees this as a new array reference
  const allMessages = useMemo(() => {
    const combined = [...messages, ...optimisticMessages]
    console.log('[useLama] 📦 Combined messages:', combined.length, '(', messages.length, 'real +', optimisticMessages.length, 'optimistic)', 'update:', updateCounter)
    return combined
  }, [messages, optimisticMessages, updateCounter])
  
  return { messages: allMessages, loading, error, sendMessage }
}

export function useLamaPeers() {
  const [peers, setPeers] = useState<Peer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadPeers = async () => {
      try {
        setLoading(true)
        const peerList = await lamaBridge.getPeerList()
        setPeers(peerList)
      } catch (err) {
        console.error('Failed to load peers:', err)
      } finally {
        setLoading(false)
      }
    }

    loadPeers()

    // Listen for peer updates
    const handlePeerUpdate = () => {
      loadPeers()
    }

    lamaBridge.on('peer:connected', handlePeerUpdate)
    lamaBridge.on('peer:disconnected', handlePeerUpdate)

    return () => {
      lamaBridge.off('peer:connected', handlePeerUpdate)
      lamaBridge.off('peer:disconnected', handlePeerUpdate)
    }
  }, [])

  const connectToPeer = useCallback(async (peerId: string) => {
    return await lamaBridge.connectToPeer(peerId)
  }, [])

  return { peers, loading, connectToPeer }
}

export function useLamaAI() {
  const [processing, setProcessing] = useState(false)
  const [response, setResponse] = useState<string | null>(null)

  useEffect(() => {
    const handleProcessing = () => setProcessing(true)
    const handleComplete = () => setProcessing(false)

    lamaBridge.on('ai:processing', handleProcessing)
    lamaBridge.on('ai:complete', handleComplete)

    return () => {
      lamaBridge.off('ai:processing', handleProcessing)
      lamaBridge.off('ai:complete', handleComplete)
    }
  }, [])

  const query = useCallback(async (prompt: string) => {
    try {
      setProcessing(true)
      const result = await lamaBridge.queryLocalAI(prompt)
      setResponse(result)
      return result
    } finally {
      setProcessing(false)
    }
  }, [])

  return { query, processing, response }
}

export function useLamaAuth() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = await lamaBridge.getCurrentUser()
        setUser(currentUser)
      } catch (err) {
        console.error('Failed to get current user:', err)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = useCallback(async (id: string, password: string) => {
    const success = await lamaBridge.login(id, password)
    if (success) {
      const currentUser = await lamaBridge.getCurrentUser()
      setUser(currentUser)
    }
    return success
  }, [])

  const logout = useCallback(async () => {
    await lamaBridge.logout()
    setUser(null)
  }, [])

  const createIdentity = useCallback(async (name: string, password: string) => {
    return await lamaBridge.createIdentity(name, password)
  }, [])

  return { user, loading, login, logout, createIdentity }
}