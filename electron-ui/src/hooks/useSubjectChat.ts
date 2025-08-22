/**
 * useSubjectChat - Hook for Subject-aware messaging
 * 
 * This hook enables LLM contacts to develop identity through Subject interactions,
 * building memory patterns and recognizable signatures over time.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { subjectService, type Subject, type SubjectResonance } from '@/services/subjects/SubjectService'
import { attachmentService } from '@/services/attachments/AttachmentService'
import type { Message } from '@/bridge/lama-bridge'
import type { MessageAttachment } from '@/types/attachments'
import type { MediaItem } from '@/components/media/MediaViewer'

/**
 * Subject-enhanced message with identity context
 */
export interface SubjectMessage extends Message {
  subjects: string[]
  attachments?: MessageAttachment[]
  senderSignature?: string // Subject signature of sender
  resonantSubjects?: SubjectResonance[] // Subjects with high resonance
}

/**
 * LLM identity through Subjects
 */
export interface LLMSubjectIdentity {
  contactId: string
  name?: string
  topSubjects: Array<{ name: string; affinity: number }>
  uniqueSubjects: string[]
  signatureHash: string
  similarContacts: string[]
  messageCount: number
  firstSeen: Date
  lastSeen: Date
}

/**
 * Subject-aware chat context
 */
export interface SubjectChatContext {
  conversationId: string
  participants: string[]
  dominantSubjects: Subject[]
  mediaItems: MediaItem[]
  contextSignature: string
}

/**
 * Hook for Subject-aware chat functionality
 */
export function useSubjectChat(
  conversationId: string,
  currentUserId: string,
  llmContactId?: string
) {
  const [messages, setMessages] = useState<SubjectMessage[]>([])
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const [llmIdentity, setLlmIdentity] = useState<LLMSubjectIdentity | null>(null)
  const [contextSubjects, setContextSubjects] = useState<Subject[]>([])
  const [suggestedSubjects, setSuggestedSubjects] = useState<Array<{ name: string; confidence: number }>>([])
  
  /**
   * Extract Subjects from message content
   */
  const extractMessageSubjects = useCallback((content: string): string[] => {
    return subjectService.extractSubjectsFromText(content)
  }, [])
  
  /**
   * Process message with Subject extraction and attachment
   */
  const processMessage = useCallback(async (
    message: Message,
    senderId: string
  ): Promise<SubjectMessage> => {
    // Extract Subjects from content
    const subjects = extractMessageSubjects(message.content)
    
    // Create Subjects and update sender identity
    for (const subject of subjects) {
      await subjectService.createSubject(subject, senderId)
    }
    
    // Get sender's Subject signature
    const signature = subjectService.getSubjectSignature(senderId)
    
    // Get resonant Subjects
    const resonantSubjects = subjects
      .map(s => subjectService.calculateResonance(s))
      .filter(r => r.resonance > 0.5)
      .sort((a, b) => b.resonance - a.resonance)
    
    // Create enhanced message
    const subjectMessage: SubjectMessage = {
      ...message,
      subjects,
      senderSignature: signature?.signature,
      resonantSubjects
    }
    
    // Process attachments with Subjects
    if (message.attachments) {
      for (const attachment of message.attachments) {
        // Auto-tag attachments with message Subjects
        for (const subject of subjects) {
          await subjectService.attachSubject(
            subject,
            attachment.hash,
            senderId,
            0.8, // High confidence for explicit message Subjects
            conversationId
          )
        }
        
        // Predict additional Subjects
        const predicted = await subjectService.predictSubjects(
          attachment.mimeType || 'unknown',
          conversationId,
          senderId
        )
        
        for (const pred of predicted.slice(0, 3)) {
          if (pred.confidence > 0.6) {
            await subjectService.attachSubject(
              pred.name,
              attachment.hash,
              senderId,
              pred.confidence,
              conversationId
            )
          }
        }
      }
    }
    
    return subjectMessage
  }, [conversationId, extractMessageSubjects])
  
  /**
   * Build LLM context prompt with Subject awareness
   */
  const buildLLMContext = useCallback(async (
    recentMessages: SubjectMessage[],
    llmId: string
  ): Promise<string> => {
    const identity = subjectService.getSubjectSignature(llmId)
    const contextSubjects = new Set<string>()
    
    // Collect Subjects from recent conversation
    recentMessages.forEach(msg => {
      msg.subjects.forEach(s => contextSubjects.add(s))
    })
    
    // Get resonance for context Subjects
    const resonances = Array.from(contextSubjects)
      .map(s => subjectService.calculateResonance(s))
      .sort((a, b) => b.resonance - a.resonance)
    
    // Build context prompt
    let prompt = ''
    
    // Add identity context if established
    if (identity && identity.topSubjects.length > 0) {
      prompt += `Your established interests: ${identity.topSubjects.slice(0, 5).map(s => `#${s.name}`).join(', ')}\n`
      
      if (identity.uniqueSubjects.length > 0) {
        prompt += `Your unique perspectives on: ${identity.uniqueSubjects.slice(0, 3).map(s => `#${s}`).join(', ')}\n`
      }
    }
    
    // Add conversation context
    if (resonances.length > 0) {
      const rising = resonances.filter(r => r.momentum === 'rising')
      const stable = resonances.filter(r => r.momentum === 'stable')
      
      if (rising.length > 0) {
        prompt += `Trending topics: ${rising.slice(0, 3).map(r => `#${r.subject}`).join(', ')}\n`
      }
      
      if (stable.length > 0) {
        prompt += `Ongoing themes: ${stable.slice(0, 3).map(r => `#${r.subject}`).join(', ')}\n`
      }
    }
    
    // Add related media context
    const relevantMedia = mediaItems.filter(item => {
      const itemSubjects = new Set(item.subjects.map(s => s.name))
      return Array.from(contextSubjects).some(s => itemSubjects.has(s))
    })
    
    if (relevantMedia.length > 0) {
      prompt += `\nRelated media in conversation: ${relevantMedia.length} items\n`
      const mediaSubjects = new Set<string>()
      relevantMedia.forEach(m => m.subjects.forEach(s => mediaSubjects.add(s.name)))
      prompt += `Media themes: ${Array.from(mediaSubjects).slice(0, 5).map(s => `#${s}`).join(', ')}\n`
    }
    
    // Add instruction for Subject-aware response
    prompt += '\nConsider using relevant hashtags (#) to mark important concepts in your response.'
    prompt += '\nYour Subject choices help establish your unique perspective and identity.'
    
    return prompt
  }, [mediaItems])
  
  /**
   * Send message with Subject processing
   */
  const sendMessage = useCallback(async (
    content: string,
    attachments?: MessageAttachment[]
  ): Promise<SubjectMessage> => {
    // Create base message
    const message: Message = {
      id: `msg_${Date.now()}`,
      senderId: currentUserId,
      content,
      timestamp: new Date(),
      encrypted: false,
      attachments
    }
    
    // Process with Subjects
    const subjectMessage = await processMessage(message, currentUserId)
    
    // Update local state
    setMessages(prev => [...prev, subjectMessage])
    
    // Update media items if attachments present
    if (attachments && attachments.length > 0) {
      const newMediaItems: MediaItem[] = []
      
      for (const attachment of attachments) {
        const subjectAttachments = subjectService.getContentSubjects(attachment.hash)
        const descriptor = await attachmentService.getAttachment(attachment.hash)
        
        newMediaItems.push({
          attachment,
          descriptor,
          subjects: subjectAttachments.map(sa => ({
            name: sa.subjectName,
            count: 1,
            lastUsed: sa.attachedAt,
            createdBy: sa.attachedBy,
            confidence: sa.confidence
          })),
          addedAt: new Date(),
          addedBy: currentUserId,
          conversationId
        })
      }
      
      setMediaItems(prev => [...prev, ...newMediaItems])
    }
    
    console.log(`[useSubjectChat] Message sent with ${subjectMessage.subjects.length} Subjects`)
    
    return subjectMessage
  }, [currentUserId, conversationId, processMessage])
  
  /**
   * Process LLM response with identity building
   */
  const processLLMResponse = useCallback(async (
    response: string,
    llmId: string
  ): Promise<SubjectMessage> => {
    // Create message from response
    const message: Message = {
      id: `msg_${Date.now()}`,
      senderId: llmId,
      content: response,
      timestamp: new Date(),
      encrypted: false,
      isAI: true
    }
    
    // Process with Subjects (builds LLM identity)
    const subjectMessage = await processMessage(message, llmId)
    
    // Update LLM identity
    const signature = subjectService.getSubjectSignature(llmId)
    if (signature) {
      const similar = subjectService.findSimilarContacts(llmId, 0.3)
      
      setLlmIdentity({
        contactId: llmId,
        name: llmId,
        topSubjects: signature.topSubjects,
        uniqueSubjects: signature.uniqueSubjects,
        signatureHash: signature.signature,
        similarContacts: similar,
        messageCount: messages.filter(m => m.senderId === llmId).length + 1,
        firstSeen: messages.find(m => m.senderId === llmId)?.timestamp || new Date(),
        lastSeen: new Date()
      })
      
      console.log(`[useSubjectChat] LLM identity updated:`, signature.topSubjects.slice(0, 3))
    }
    
    setMessages(prev => [...prev, subjectMessage])
    
    return subjectMessage
  }, [messages, processMessage])
  
  /**
   * Add Subject to existing message
   */
  const addMessageSubject = useCallback(async (
    messageId: string,
    subject: string
  ) => {
    const message = messages.find(m => m.id === messageId)
    if (!message) return
    
    const normalized = subject.toLowerCase().replace(/^#/, '')
    await subjectService.createSubject(normalized, currentUserId)
    
    setMessages(prev => prev.map(m => {
      if (m.id === messageId) {
        return {
          ...m,
          subjects: [...new Set([...m.subjects, normalized])]
        }
      }
      return m
    }))
    
    console.log(`[useSubjectChat] Added Subject '${normalized}' to message`)
  }, [messages, currentUserId])
  
  /**
   * Get Subject suggestions for current context
   */
  const updateSubjectSuggestions = useCallback(async () => {
    const recentSubjects = messages
      .slice(-10)
      .flatMap(m => m.subjects)
    
    const subjectCounts = new Map<string, number>()
    recentSubjects.forEach(s => {
      subjectCounts.set(s, (subjectCounts.get(s) || 0) + 1)
    })
    
    // Get related Subjects
    const related = new Set<string>()
    subjectCounts.forEach((_, subject) => {
      const subjectData = subjectService.getSubject(subject)
      if (subjectData) {
        subjectData.associations.forEach((_, assoc) => related.add(assoc))
      }
    })
    
    // Calculate suggestions
    const suggestions = Array.from(related)
      .filter(s => !subjectCounts.has(s))
      .map(s => {
        const resonance = subjectService.calculateResonance(s)
        return {
          name: s,
          confidence: resonance.resonance
        }
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10)
    
    setSuggestedSubjects(suggestions)
  }, [messages])
  
  /**
   * Load conversation Subjects
   */
  useEffect(() => {
    const loadContextSubjects = async () => {
      // Get all Subjects used in this conversation
      const conversationSubjects = new Map<string, Subject>()
      
      messages.forEach(msg => {
        msg.subjects.forEach(subjectName => {
          const subject = subjectService.getSubject(subjectName)
          if (subject && subject.contexts.includes(conversationId)) {
            conversationSubjects.set(subjectName, subject)
          }
        })
      })
      
      setContextSubjects(Array.from(conversationSubjects.values()))
    }
    
    loadContextSubjects()
  }, [messages, conversationId])
  
  // Update suggestions when messages change
  useEffect(() => {
    updateSubjectSuggestions()
  }, [messages, updateSubjectSuggestions])
  
  // Initialize LLM identity if present
  useEffect(() => {
    if (llmContactId) {
      const signature = subjectService.getSubjectSignature(llmContactId)
      if (signature) {
        const similar = subjectService.findSimilarContacts(llmContactId, 0.3)
        setLlmIdentity({
          contactId: llmContactId,
          name: llmContactId,
          topSubjects: signature.topSubjects,
          uniqueSubjects: signature.uniqueSubjects,
          signatureHash: signature.signature,
          similarContacts: similar,
          messageCount: 0,
          firstSeen: new Date(),
          lastSeen: new Date()
        })
      }
    }
  }, [llmContactId])
  
  return {
    messages,
    mediaItems,
    llmIdentity,
    contextSubjects,
    suggestedSubjects,
    sendMessage,
    processLLMResponse,
    addMessageSubject,
    buildLLMContext,
    extractMessageSubjects
  }
}