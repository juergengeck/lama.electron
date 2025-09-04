import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * SubjectChatView - Chat interface with Subject awareness and identity emergence
 *
 * This component enables LLM contacts to develop identity through Subject-mediated
 * conversations, with media integration and memory pattern visualization.
 */
import { useState, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Hash, Brain, Image, TrendingUp, Users, Sparkles } from 'lucide-react';
import { useSubjectChat } from '@/hooks/useSubjectChat';
import { MediaViewer } from './media/MediaViewer';
import { subjectService } from '@/services/subjects/SubjectService';
import { attachmentService } from '@/services/attachments/AttachmentService';
import { EnhancedMessageInput } from './chat/EnhancedMessageInput';
import { lamaBridge } from '@/bridge/lama-bridge';
export const SubjectChatView = ({ conversationId, currentUserId, llmContactId, participantName = 'Chat' }) => {
    const { messages, mediaItems, llmIdentity, contextSubjects, suggestedSubjects, sendMessage, processLLMResponse, addMessageSubject, buildLLMContext, extractMessageSubjects } = useSubjectChat(conversationId, currentUserId, llmContactId);
    const [activeTab, setActiveTab] = useState('chat');
    const [showIdentity, setShowIdentity] = useState(false);
    const [sending, setSending] = useState(false);
    /**
     * Handle sending message with Subject extraction
     */
    const handleSendMessage = useCallback(async (text, attachments) => {
        setSending(true);
        try {
            // Process attachments if present
            let messageAttachments = [];
            if (attachments && attachments.length > 0) {
                for (const att of attachments) {
                    const hash = await attachmentService.storeAttachment(att.file, {
                        generateThumbnail: true,
                        extractSubjects: true,
                        trustLevel: att.trustLevel || 3
                    });
                    messageAttachments.push({
                        hash,
                        type: 'blob',
                        mimeType: att.file.type,
                        name: att.file.name,
                        size: att.file.size
                    });
                }
            }
            // Send with Subject processing
            const subjectMessage = await sendMessage(text, messageAttachments);
            // If LLM contact, get response with Subject context
            if (llmContactId) {
                const context = await buildLLMContext(messages.slice(-10), llmContactId);
                // Add Subject context to prompt
                const enhancedPrompt = `${context}\n\nUser: ${text}`;
                // Get LLM response
                const response = await lamaBridge.queryLocalAI(enhancedPrompt);
                // Process response with Subject extraction
                await processLLMResponse(response, llmContactId);
            }
            console.log(`[SubjectChatView] Message sent with ${subjectMessage.subjects.length} Subjects`);
        }
        catch (error) {
            console.error('[SubjectChatView] Failed to send message:', error);
        }
        finally {
            setSending(false);
        }
    }, [sendMessage, processLLMResponse, buildLLMContext, messages, llmContactId]);
    /**
     * Handle Subject click - filter or explore
     */
    const handleSubjectClick = useCallback((subject) => {
        console.log(`[SubjectChatView] Subject clicked: ${subject}`);
        // Could filter messages, show related media, or explore Subject network
        setActiveTab('media');
    }, []);
    /**
     * Handle media item Subject management
     */
    const handleAddMediaSubject = useCallback(async (itemHash, subject) => {
        await subjectService.attachSubject(subject, itemHash, currentUserId, 1.0, // Manual tagging = high confidence
        conversationId);
        console.log(`[SubjectChatView] Added Subject '${subject}' to media`);
    }, [currentUserId, conversationId]);
    /**
     * Render message with Subjects
     */
    const renderMessage = useCallback((message) => {
        const isCurrentUser = message.senderId === currentUserId;
        const isAI = message.isAI;
        return (_jsx("div", { className: `mb-4 ${isCurrentUser ? 'text-right' : 'text-left'}`, children: _jsxs("div", { className: `inline-block max-w-[70%] p-3 rounded-lg ${isCurrentUser
                    ? 'bg-primary text-primary-foreground'
                    : isAI
                        ? 'bg-purple-100 dark:bg-purple-900/20'
                        : 'bg-muted'}`, children: [!isCurrentUser && (_jsx("div", { className: "text-xs opacity-70 mb-1", children: isAI ? '🤖 ' + (llmIdentity?.name || llmContactId) : participantName })), _jsx("div", { className: "whitespace-pre-wrap", children: message.content }), message.subjects && message.subjects.length > 0 && (_jsx("div", { className: "mt-2 flex flex-wrap gap-1", children: message.subjects.map((subject) => {
                            const resonance = subjectService.calculateResonance(subject);
                            return (_jsxs(Badge, { variant: "secondary", className: `text-xs cursor-pointer ${resonance.momentum === 'rising' ? 'border-green-500' :
                                    resonance.momentum === 'falling' ? 'border-red-500' :
                                        ''}`, onClick: () => handleSubjectClick(subject), children: ["#", subject, resonance.momentum === 'rising' && ' ↑', resonance.momentum === 'falling' && ' ↓'] }, subject));
                        }) })), message.attachments && message.attachments.length > 0 && (_jsxs("div", { className: "mt-2 text-xs opacity-70", children: ["\uD83D\uDCCE ", message.attachments.length, " attachment(s)"] })), _jsx("div", { className: "text-xs opacity-50 mt-1", children: new Date(message.timestamp).toLocaleTimeString() })] }) }, message.id));
    }, [currentUserId, llmContactId, llmIdentity, participantName, handleSubjectClick]);
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "p-4 border-b", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("h2", { className: "text-lg font-semibold", children: participantName }), llmIdentity && (_jsxs(Button, { variant: "ghost", size: "sm", onClick: () => setShowIdentity(!showIdentity), children: [_jsx(Brain, { className: "h-4 w-4 mr-1" }), "Identity"] }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: "Context:" }), contextSubjects.slice(0, 3).map(subject => (_jsxs(Badge, { variant: "outline", children: ["#", subject.name] }, subject.name)))] })] }), showIdentity && llmIdentity && (_jsxs("div", { className: "mt-4 p-3 bg-muted rounded-lg", children: [_jsx("div", { className: "text-sm font-medium mb-2", children: "AI Identity Signature" }), _jsxs("div", { className: "grid grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Top Interests:" }), _jsx("div", { className: "flex flex-wrap gap-1 mt-1", children: llmIdentity.topSubjects.slice(0, 5).map(s => (_jsxs(Badge, { variant: "secondary", className: "text-xs", children: ["#", s.name, " (", Math.round(s.affinity * 100), "%)"] }, s.name))) })] }), _jsxs("div", { children: [_jsx("div", { className: "text-muted-foreground", children: "Unique Perspectives:" }), _jsx("div", { className: "flex flex-wrap gap-1 mt-1", children: llmIdentity.uniqueSubjects.slice(0, 3).map(s => (_jsxs(Badge, { variant: "outline", className: "text-xs", children: ["#", s] }, s))) })] })] }), _jsxs("div", { className: "text-xs text-muted-foreground mt-2", children: ["Messages: ", llmIdentity.messageCount, " \u2022 Signature: ", llmIdentity.signatureHash.substring(0, 8), "..."] })] }))] }), _jsxs(Tabs, { value: activeTab, onValueChange: setActiveTab, className: "flex-1 flex flex-col", children: [_jsxs(TabsList, { className: "mx-4", children: [_jsxs(TabsTrigger, { value: "chat", className: "flex items-center gap-1", children: [_jsx(Hash, { className: "h-4 w-4" }), "Chat"] }), _jsxs(TabsTrigger, { value: "media", className: "flex items-center gap-1", children: [_jsx(Image, { className: "h-4 w-4" }), "Media (", mediaItems.length, ")"] }), _jsxs(TabsTrigger, { value: "subjects", className: "flex items-center gap-1", children: [_jsx(TrendingUp, { className: "h-4 w-4" }), "Subjects"] })] }), _jsxs(TabsContent, { value: "chat", className: "flex-1 flex flex-col", children: [_jsx("div", { className: "flex-1 overflow-auto p-4", children: messages.map(renderMessage) }), suggestedSubjects.length > 0 && (_jsx("div", { className: "px-4 py-2 border-t", children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Sparkles, { className: "h-4 w-4 text-muted-foreground" }), _jsx("span", { className: "text-xs text-muted-foreground", children: "Suggested:" }), suggestedSubjects.slice(0, 5).map(s => (_jsxs(Badge, { variant: "outline", className: "text-xs cursor-pointer", onClick: () => {
                                                // Add to input
                                                const input = document.querySelector('input');
                                                if (input) {
                                                    input.value += ` #${s.name}`;
                                                    input.focus();
                                                }
                                            }, children: ["#", s.name, _jsxs("span", { className: "ml-1 opacity-60", children: [Math.round(s.confidence * 100), "%"] })] }, s.name)))] }) })), _jsx("div", { className: "p-4 border-t", children: _jsx(EnhancedMessageInput, { onSendMessage: handleSendMessage, placeholder: "Type a message... (use #hashtags for Subjects)", disabled: sending, theme: "dark" }) })] }), _jsx(TabsContent, { value: "media", className: "flex-1", children: _jsx(MediaViewer, { items: mediaItems, onSubjectClick: handleSubjectClick, onAddSubject: handleAddMediaSubject, llmContactId: llmContactId }) }), _jsx(TabsContent, { value: "subjects", className: "flex-1 p-4", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-medium mb-2", children: "Subject Resonance" }), _jsx("div", { className: "space-y-2", children: contextSubjects
                                                .map(s => ({
                                                subject: s,
                                                resonance: subjectService.calculateResonance(s.name)
                                            }))
                                                .sort((a, b) => b.resonance.resonance - a.resonance.resonance)
                                                .slice(0, 10)
                                                .map(({ subject, resonance }) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs(Badge, { variant: resonance.momentum === 'rising' ? 'default' :
                                                            resonance.momentum === 'falling' ? 'secondary' :
                                                                'outline', children: ["#", subject.name] }), _jsx("div", { className: "flex-1 h-2 bg-muted rounded", children: _jsx("div", { className: `h-full rounded ${resonance.momentum === 'rising' ? 'bg-green-500' :
                                                                resonance.momentum === 'falling' ? 'bg-red-500' :
                                                                    'bg-blue-500'}`, style: { width: `${resonance.resonance * 100}%` } }) }), _jsxs("span", { className: "text-xs text-muted-foreground", children: [Math.round(resonance.resonance * 100), "%"] })] }, subject.name))) })] }), llmIdentity && llmIdentity.similarContacts.length > 0 && (_jsxs("div", { children: [_jsx("h3", { className: "font-medium mb-2", children: "Similar Identities" }), _jsx("div", { className: "flex flex-wrap gap-2", children: llmIdentity.similarContacts.map(contactId => (_jsxs(Badge, { variant: "outline", children: [_jsx(Users, { className: "h-3 w-3 mr-1" }), contactId] }, contactId))) })] }))] }) })] })] }));
};
