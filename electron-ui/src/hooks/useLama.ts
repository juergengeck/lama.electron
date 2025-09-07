import { useState, useEffect, useCallback } from 'react'
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

    // Listen for topic updates - only for this specific conversation
    const handleTopicUpdate = (data: { conversationId?: string } | undefined) => {
      // Only reload if this conversation was updated
      if (data?.conversationId === conversationId) {
        console.log('[useLamaMessages] Topic updated for conversation:', conversationId)
        
        // Debounce multiple rapid updates
        if (debounceTimer) {
          clearTimeout(debounceTimer)
        }
        
        debounceTimer = setTimeout(() => {
          if (mounted) {
            loadMessages()
          }
        }, 100)
      }
    }

    console.log('[useLamaMessages] Setting up listeners for conversationId:', conversationId)
    lamaBridge.on('message:updated', handleTopicUpdate)
    
    return () => {
      mounted = false
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
      lamaBridge.off('message:updated', handleTopicUpdate)
    }
  }, [conversationId])

  const sendMessage = useCallback(async (topicId: string, content: string, attachments?: any[]) => {
    try {
      console.log('[useLama] 🚀 Starting sendMessage with:', { topicId, content, attachments: attachments?.length || 0 })
      const messageId = await lamaBridge.sendMessage(topicId, content, attachments)
      console.log('[useLama] ✅ sendMessage completed, messageId:', messageId, 'for topic:', topicId)
      return messageId
    } catch (err) {
      console.error('[useLama] sendMessage error:', err)
      setError(err instanceof Error ? err.message : 'Failed to send message')
      throw err
    }
  }, [])

  return { messages, loading, error, sendMessage }
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