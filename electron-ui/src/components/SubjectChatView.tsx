/**
 * SubjectChatView - Chat interface with Subject awareness and identity emergence
 * 
 * This component enables LLM contacts to develop identity through Subject-mediated
 * conversations, with media integration and memory pattern visualization.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Hash, Brain, Image, TrendingUp, Users, Sparkles } from 'lucide-react'
import { useSubjectChat } from '@/hooks/useSubjectChat'
import { MediaViewer, type MediaItem } from './media/MediaViewer'
import { subjectService } from '@/services/subjects/SubjectService'
import { attachmentService } from '@/services/attachments/AttachmentService'
import type { MessageAttachment } from '@/types/attachments'
import { EnhancedMessageInput } from './chat/EnhancedMessageInput'
import { lamaBridge } from '@/bridge/lama-bridge'

interface SubjectChatViewProps {
  conversationId: string
  currentUserId: string
  llmContactId?: string
  participantName?: string
}

export const SubjectChatView: React.FC<SubjectChatViewProps> = ({
  conversationId,
  currentUserId,
  llmContactId,
  participantName = 'Chat'
}) => {
  const {
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
  } = useSubjectChat(conversationId, currentUserId, llmContactId)
  
  const [activeTab, setActiveTab] = useState('chat')
  const [showIdentity, setShowIdentity] = useState(false)
  const [sending, setSending] = useState(false)
  
  /**
   * Handle sending message with Subject extraction
   */
  const handleSendMessage = useCallback(async (text: string, attachments?: any[]) => {
    setSending(true)
    
    try {
      // Process attachments if present
      let messageAttachments: MessageAttachment[] = []
      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          const hash = await attachmentService.storeAttachment(att.file, {
            generateThumbnail: true,
            extractSubjects: true,
            trustLevel: att.trustLevel || 3
          })
          
          messageAttachments.push({
            hash,
            type: 'blob',
            mimeType: att.file.type,
            name: att.file.name,
            size: att.file.size
          })
        }
      }
      
      // Send with Subject processing
      const subjectMessage = await sendMessage(text, messageAttachments)
      
      // If LLM contact, get response with Subject context
      if (llmContactId) {
        const context = await buildLLMContext(messages.slice(-10), llmContactId)
        
        // Add Subject context to prompt
        const enhancedPrompt = `${context}\n\nUser: ${text}`
        
        // Get LLM response
        const response = await lamaBridge.queryLocalAI(enhancedPrompt)
        
        // Process response with Subject extraction
        await processLLMResponse(response, llmContactId)
      }
      
      console.log(`[SubjectChatView] Message sent with ${subjectMessage.subjects.length} Subjects`)
    } catch (error) {
      console.error('[SubjectChatView] Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }, [sendMessage, processLLMResponse, buildLLMContext, messages, llmContactId])
  
  /**
   * Handle Subject click - filter or explore
   */
  const handleSubjectClick = useCallback((subject: string) => {
    console.log(`[SubjectChatView] Subject clicked: ${subject}`)
    // Could filter messages, show related media, or explore Subject network
    setActiveTab('media')
  }, [])
  
  /**
   * Handle media item Subject management
   */
  const handleAddMediaSubject = useCallback(async (itemHash: string, subject: string) => {
    await subjectService.attachSubject(
      subject,
      itemHash,
      currentUserId,
      1.0, // Manual tagging = high confidence
      conversationId
    )
    console.log(`[SubjectChatView] Added Subject '${subject}' to media`)
  }, [currentUserId, conversationId])
  
  /**
   * Render message with Subjects
   */
  const renderMessage = useCallback((message: any) => {
    const isCurrentUser = message.senderId === currentUserId
    const isAI = message.isAI
    
    return (
      <div
        key={message.id}
        className={`mb-4 ${isCurrentUser ? 'text-right' : 'text-left'}`}
      >
        <div
          className={`inline-block max-w-[70%] p-3 rounded-lg ${
            isCurrentUser
              ? 'bg-primary text-primary-foreground'
              : isAI
              ? 'bg-purple-100 dark:bg-purple-900/20'
              : 'bg-muted'
          }`}
        >
          {/* Sender label */}
          {!isCurrentUser && (
            <div className="text-xs opacity-70 mb-1">
              {isAI ? '🤖 ' + (llmIdentity?.name || llmContactId) : participantName}
            </div>
          )}
          
          {/* Message content */}
          <div className="whitespace-pre-wrap">{message.content}</div>
          
          {/* Subjects */}
          {message.subjects && message.subjects.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {message.subjects.map((subject: string) => {
                const resonance = subjectService.calculateResonance(subject)
                return (
                  <Badge
                    key={subject}
                    variant="secondary"
                    className={`text-xs cursor-pointer ${
                      resonance.momentum === 'rising' ? 'border-green-500' :
                      resonance.momentum === 'falling' ? 'border-red-500' :
                      ''
                    }`}
                    onClick={() => handleSubjectClick(subject)}
                  >
                    #{subject}
                    {resonance.momentum === 'rising' && ' ↑'}
                    {resonance.momentum === 'falling' && ' ↓'}
                  </Badge>
                )
              })}
            </div>
          )}
          
          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 text-xs opacity-70">
              📎 {message.attachments.length} attachment(s)
            </div>
          )}
          
          {/* Timestamp */}
          <div className="text-xs opacity-50 mt-1">
            {new Date(message.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>
    )
  }, [currentUserId, llmContactId, llmIdentity, participantName, handleSubjectClick])
  
  return (
    <div className="flex flex-col h-full">
      {/* Header with identity indicator */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{participantName}</h2>
            {llmIdentity && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowIdentity(!showIdentity)}
              >
                <Brain className="h-4 w-4 mr-1" />
                Identity
              </Button>
            )}
          </div>
          
          {/* Context Subjects */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Context:</span>
            {contextSubjects.slice(0, 3).map(subject => (
              <Badge key={subject.name} variant="outline">
                #{subject.name}
              </Badge>
            ))}
          </div>
        </div>
        
        {/* LLM Identity panel */}
        {showIdentity && llmIdentity && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium mb-2">AI Identity Signature</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Top Interests:</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {llmIdentity.topSubjects.slice(0, 5).map(s => (
                    <Badge key={s.name} variant="secondary" className="text-xs">
                      #{s.name} ({Math.round(s.affinity * 100)}%)
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Unique Perspectives:</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {llmIdentity.uniqueSubjects.slice(0, 3).map(s => (
                    <Badge key={s} variant="outline" className="text-xs">
                      #{s}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Messages: {llmIdentity.messageCount} • 
              Signature: {llmIdentity.signatureHash.substring(0, 8)}...
            </div>
          </div>
        )}
      </div>
      
      {/* Tabs for chat and media */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="mx-4">
          <TabsTrigger value="chat" className="flex items-center gap-1">
            <Hash className="h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="media" className="flex items-center gap-1">
            <Image className="h-4 w-4" />
            Media ({mediaItems.length})
          </TabsTrigger>
          <TabsTrigger value="subjects" className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            Subjects
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="chat" className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-auto p-4">
            {messages.map(renderMessage)}
          </div>
          
          {/* Suggested Subjects */}
          {suggestedSubjects.length > 0 && (
            <div className="px-4 py-2 border-t">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Suggested:</span>
                {suggestedSubjects.slice(0, 5).map(s => (
                  <Badge
                    key={s.name}
                    variant="outline"
                    className="text-xs cursor-pointer"
                    onClick={() => {
                      // Add to input
                      const input = document.querySelector('input') as HTMLInputElement
                      if (input) {
                        input.value += ` #${s.name}`
                        input.focus()
                      }
                    }}
                  >
                    #{s.name}
                    <span className="ml-1 opacity-60">
                      {Math.round(s.confidence * 100)}%
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {/* Input */}
          <div className="p-4 border-t">
            <EnhancedMessageInput
              onSendMessage={handleSendMessage}
              placeholder="Type a message... (use #hashtags for Subjects)"
              disabled={sending}
              theme="dark"
              conversationId={conversationId}
            />
          </div>
        </TabsContent>
        
        <TabsContent value="media" className="flex-1">
          <MediaViewer
            items={mediaItems}
            onSubjectClick={handleSubjectClick}
            onAddSubject={handleAddMediaSubject}
            llmContactId={llmContactId}
          />
        </TabsContent>
        
        <TabsContent value="subjects" className="flex-1 p-4">
          <div className="space-y-4">
            {/* Subject resonance chart */}
            <div>
              <h3 className="font-medium mb-2">Subject Resonance</h3>
              <div className="space-y-2">
                {contextSubjects
                  .map(s => ({
                    subject: s,
                    resonance: subjectService.calculateResonance(s.name)
                  }))
                  .sort((a, b) => b.resonance.resonance - a.resonance.resonance)
                  .slice(0, 10)
                  .map(({ subject, resonance }) => (
                    <div key={subject.name} className="flex items-center gap-2">
                      <Badge
                        variant={
                          resonance.momentum === 'rising' ? 'default' :
                          resonance.momentum === 'falling' ? 'secondary' :
                          'outline'
                        }
                      >
                        #{subject.name}
                      </Badge>
                      <div className="flex-1 h-2 bg-muted rounded">
                        <div
                          className={`h-full rounded ${
                            resonance.momentum === 'rising' ? 'bg-green-500' :
                            resonance.momentum === 'falling' ? 'bg-red-500' :
                            'bg-blue-500'
                          }`}
                          style={{ width: `${resonance.resonance * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(resonance.resonance * 100)}%
                      </span>
                    </div>
                  ))}
              </div>
            </div>
            
            {/* Similar contacts */}
            {llmIdentity && llmIdentity.similarContacts.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Similar Identities</h3>
                <div className="flex flex-wrap gap-2">
                  {llmIdentity.similarContacts.map(contactId => (
                    <Badge key={contactId} variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {contactId}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}