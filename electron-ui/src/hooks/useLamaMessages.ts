import { useState, useEffect, useCallback, useMemo } from 'react'
import { lamaBridge, type Message } from '@/bridge/lama-bridge'

export function useLamaMessages(conversationId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(Date.now()) // Track updates

  // Debug: log when messages state changes
  useEffect(() => {
    console.log('[useLamaMessages] 📊 Messages state updated:', messages.length, 'messages')
    if (messages.length > 0) {
      console.log('[useLamaMessages] 📊 First message:', messages[0])
    }
  }, [messages])

  // Load messages - useCallback to ensure stable reference
  const loadMessages = useCallback(async () => {
    console.log('[useLamaMessages] Loading messages for:', conversationId)
    try {
      setLoading(true)
      const msgs = await lamaBridge.getMessages(conversationId)
      console.log('[useLamaMessages] Loaded', msgs.length, 'messages')
      console.log('[useLamaMessages] Setting messages state with:', msgs)
      setMessages(msgs)
      setLastUpdate(Date.now()) // Force update
    } catch (err) {
      console.error('[useLamaMessages] Failed to load messages:', err)
    } finally {
      setLoading(false)
    }
  }, [conversationId])

  // Load on mount and conversation change
  useEffect(() => {
    // Clear messages before loading to prevent stale data flash
    console.log('[useLamaMessages] 🧹 Clearing messages before load for:', conversationId)
    setMessages([])
    loadMessages()
    // Note: loadMessages in deps is redundant with conversationId but required for lint
  }, [conversationId, loadMessages])

  // Listen for new messages - this is THE key part
  useEffect(() => {
    // Define handler inside effect to capture current conversationId
    const handleNewMessages = (data: { conversationId: string }) => {
      console.log('[useLamaMessages] 🔵🔵🔵 EVENT RECEIVED! conversationId in event:', data.conversationId)
      console.log('[useLamaMessages] 🔵🔵🔵 Current conversationId in hook:', conversationId)

      // Normalize IDs for P2P comparison
      const normalize = (id: string) =>
        id?.includes('<->') ? id.split('<->').sort().join('<->') : id

      const normalizedEvent = normalize(data.conversationId)
      const normalizedCurrent = normalize(conversationId)

      console.log('[useLamaMessages] 🔵 Comparing normalized:', normalizedEvent, '===', normalizedCurrent)

      if (normalizedEvent === normalizedCurrent) {
        console.log('[useLamaMessages] ✅✅✅ MATCH! Loading fresh messages...')
        // Call loadMessages to fetch fresh data
        loadMessages()
      } else {
        console.log('[useLamaMessages] ❌ No match, ignoring event')
      }
    }

    console.log('[useLamaMessages] 📡 Registering listener for conversationId:', conversationId)
    lamaBridge.on('chat:newMessages', handleNewMessages)

    // Cleanup
    return () => {
      console.log('[useLamaMessages] 🧹 Cleaning up listener for:', conversationId)
      lamaBridge.off('chat:newMessages', handleNewMessages)
    }
  }, [conversationId, loadMessages]) // Include loadMessages in dependencies

  // Send message
  const sendMessage = async (topicId: string, content: string, attachments?: any[]) => {
    // Get current user for optimistic update
    const currentUser = await lamaBridge.getCurrentUser()

    // Optimistically add message to UI immediately
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      senderId: currentUser?.id || 'me',
      senderName: currentUser?.name || 'You',
      content,
      timestamp: new Date(),
      encrypted: false,
      isAI: false,
      topicId,
      attachments
    }

    setMessages(prev => [...prev, optimisticMessage])

    // Send message to backend
    const messageId = await lamaBridge.sendMessage(topicId, content, attachments)

    // Replace optimistic message with real one from backend
    await loadMessages()

    return messageId
  }

  return { messages, loading, sendMessage }
}