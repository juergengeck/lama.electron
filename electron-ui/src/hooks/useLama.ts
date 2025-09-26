import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { lamaBridge, type Message, type Peer } from '@/bridge/lama-bridge'

// Main hook to access the bridge
export function useLama() {
  return {
    bridge: lamaBridge
  }
}

export function useLamaMessages(conversationId: string) {
  console.log('[useLamaMessages] 🎯 Hook called with conversationId:', conversationId)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([])

  // Load messages from backend
  const loadMessages = useCallback(async () => {
    console.log('🔄 Loading messages for:', conversationId)
    try {
      setLoading(true)
      const msgs = await lamaBridge.getMessages(conversationId)
      console.log('✅ Loaded', msgs.length, 'messages')
      setMessages(msgs)
      setOptimisticMessages([])
    } catch (err) {
      console.error('❌ Failed to load messages:', err)
      setError(err instanceof Error ? err.message : 'Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  // Initial load
  useEffect(() => {
    loadMessages()
  }, [conversationId]) // Only reload when conversation changes

  // Listen for new messages
  useEffect(() => {
    const handleNewMessages = (data: { conversationId: string; messages: Message[] }) => {
      console.log('[useLamaMessages] 📨 New message event:', data.conversationId, 'current:', conversationId)

      // DEBUG: Show message details
      data.messages?.forEach((msg, i) => {
        console.log(`[useLamaMessages] 🔍 Event message ${i}: "${msg.content?.substring(0, 30)}..." for conversation ${data.conversationId}`)
      })

      // Normalize P2P channel IDs for comparison
      const normalize = (id: string) => {
        if (id?.includes('<->')) {
          return id.split('<->').sort().join('<->')
        }
        return id
      }

      const eventId = normalize(data.conversationId)
      const currentId = normalize(conversationId)

      console.log(`[useLamaMessages] 🔍 Comparing eventId: "${eventId}" vs currentId: "${currentId}"`)

      if (eventId === currentId) {
        console.log('[useLamaMessages] ✅ Match! Refreshing messages...')
        // Directly fetch and update messages - no complex state management
        lamaBridge.getMessages(conversationId).then(msgs => {
          console.log('[useLamaMessages] 🔄 Got', msgs.length, 'messages from refresh')
          msgs.forEach((msg, i) => {
            console.log(`[useLamaMessages] 🔍 Refreshed message ${i}: "${msg.content?.substring(0, 30)}..." for ${conversationId}`)
          })
          setMessages(msgs)
        }).catch(err => {
          console.error('[useLamaMessages] Failed to refresh:', err)
        })
      } else {
        console.log('[useLamaMessages] ❌ No match, ignoring event')
      }
    }

    lamaBridge.on('chat:newMessages', handleNewMessages)
    return () => {
      lamaBridge.off('chat:newMessages', handleNewMessages)
    }
  }, [conversationId]) // Re-subscribe when conversation changes

  const sendMessage = useCallback(async (topicId: string, content: string, attachments?: any[]) => {
    try {
      console.log('[useLama] 📤 Sending message to:', topicId)

      // Add optimistic message for instant UI feedback
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
      setOptimisticMessages([optimisticMessage])

      // Send the actual message
      const messageId = await lamaBridge.sendMessage(topicId, content, attachments)
      console.log('[useLama] ✅ Message sent:', messageId)

      // Refresh messages
      const msgs = await lamaBridge.getMessages(topicId)
      setMessages(msgs)
      setOptimisticMessages([])

      return messageId
    } catch (err) {
      console.error('[useLama] ❌ Send failed:', err)
      setOptimisticMessages([])
      throw err
    }
  }, [])

  // Combine real and optimistic messages
  const allMessages = useMemo(() => {
    return [...messages, ...optimisticMessages]
  }, [messages, optimisticMessages])

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