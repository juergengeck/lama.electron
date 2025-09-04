import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2, Copy, Edit, Trash2, MoreVertical, CheckCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import './MessageView.css';
// Import enhanced components
import { EnhancedMessageInput } from './chat/EnhancedMessageInput';
import { EnhancedMessageBubble } from './chat/EnhancedMessageBubble';
// Import attachment system
import { attachmentService } from '@/services/attachments/AttachmentService';
import { createAttachmentView } from '@/components/attachments/AttachmentViewFactory';
export function MessageView({ messages, currentUserId = 'user-1', onSendMessage, placeholder = 'Type a message...', showSender = true, loading = false, participants = [], useEnhancedUI = true, // Enable enhanced UI for attachments
isAIProcessing = false, aiStreamingContent = '' }) {
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [contactNames, setContactNames] = useState({});
    const messagesEndRef = useRef(null);
    const scrollAreaRef = useRef(null);
    // Store attachment descriptors for display
    const [attachmentDescriptors, setAttachmentDescriptors] = useState(new Map());
    // Load contact names
    useEffect(() => {
        const loadContactNames = async () => {
            try {
                const contacts = await lamaBridge.getContacts();
                const names = {};
                // Map contact IDs to names
                for (const contact of contacts) {
                    if (contact.id) {
                        names[contact.id] = contact.displayName || contact.name || 'Unknown';
                    }
                }
                // Don't add "You" label - users aren't idiots
                setContactNames(names);
            }
            catch (error) {
                console.error('Failed to load contact names:', error);
            }
        };
        loadContactNames();
    }, [currentUserId]);
    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
            if (scrollAreaRef.current) {
                scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
            }
        }, 0);
    }, [messages]);
    const handleSend = async () => {
        if (!input.trim() || sending)
            return;
        try {
            setSending(true);
            console.log('[MessageView] 🎯 Starting message send with:', input);
            const startTime = performance.now();
            await onSendMessage(input);
            const elapsed = performance.now() - startTime;
            console.log(`[MessageView] ✅ Message sent in ${elapsed.toFixed(2)}ms`);
            setInput('');
        }
        catch (error) {
            console.error('Failed to send message:', error);
        }
        finally {
            setSending(false);
        }
    };
    // Enhanced send handler with proper attachment storage
    const handleEnhancedSend = async (text, attachments) => {
        try {
            setSending(true);
            console.log('[MessageView] 🎯 Enhanced send with:', text, attachments?.length, 'attachments');
            // Extract hashtags from text
            const hashtagRegex = /#[\w-]+/g;
            const hashtags = text.match(hashtagRegex) || [];
            console.log('[MessageView] Extracted hashtags:', hashtags);
            let messageContent = text;
            const messageAttachments = [];
            // Process and store attachments using AttachmentService
            if (attachments && attachments.length > 0) {
                console.log('[MessageView] Processing attachments with AttachmentService');
                for (const attachment of attachments) {
                    try {
                        // Store attachment in ONE platform
                        const hash = await attachmentService.storeAttachment(attachment.file, {
                            generateThumbnail: attachment.type === 'image' || attachment.type === 'video',
                            extractSubjects: true,
                            trustLevel: attachment.trustLevel,
                            onProgress: (progress) => {
                                console.log(`[MessageView] Upload progress for ${attachment.file.name}: ${progress}%`);
                            }
                        });
                        // Create message attachment reference
                        const messageAttachment = {
                            hash,
                            type: 'blob',
                            mimeType: attachment.file.type,
                            name: attachment.file.name,
                            size: attachment.file.size
                        };
                        messageAttachments.push(messageAttachment);
                        // Cache the descriptor for immediate display
                        const descriptor = {
                            data: await attachment.file.arrayBuffer(),
                            type: attachment.file.type,
                            name: attachment.file.name,
                            size: attachment.file.size,
                            lastModified: attachment.file.lastModified
                        };
                        setAttachmentDescriptors(prev => {
                            const newMap = new Map(prev);
                            newMap.set(hash, descriptor);
                            return newMap;
                        });
                        console.log(`[MessageView] Stored attachment ${attachment.file.name} with hash: ${hash}`);
                    }
                    catch (error) {
                        console.error(`[MessageView] Failed to store attachment ${attachment.file.name}:`, error);
                    }
                }
            }
            // Send the message with attachments
            // Pass attachments directly to onSendMessage
            await onSendMessage(messageContent, messageAttachments.length > 0 ? messageAttachments : undefined);
        }
        catch (error) {
            console.error('Failed to send enhanced message:', error);
        }
        finally {
            setSending(false);
        }
    };
    // Handle hashtag clicks
    const handleHashtagClick = (hashtag) => {
        console.log('[MessageView] Hashtag clicked:', hashtag);
        // TODO: Implement hashtag search/filtering
        alert(`Search for #${hashtag} - Feature coming soon!`);
    };
    // Handle attachment clicks
    const handleAttachmentClick = (attachmentId) => {
        console.log('[MessageView] Attachment clicked:', attachmentId);
        // TODO: Implement attachment viewer
    };
    // Handle attachment downloads
    const handleDownloadAttachment = (attachmentId) => {
        console.log('[MessageView] Download attachment:', attachmentId);
        // TODO: Implement attachment download
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    if (loading) {
        return (_jsx("div", { className: "flex items-center justify-center h-full", children: _jsx(Loader2, { className: "h-8 w-8 animate-spin text-primary", "data-testid": "loading-spinner" }) }));
    }
    // Determine if we should show sender labels (only when multiple other participants)
    const otherParticipants = participants.filter(p => p !== currentUserId);
    const shouldShowSenderLabels = otherParticipants.length > 1;
    return (_jsxs("div", { className: "flex flex-col h-full overflow-hidden", children: [_jsx("div", { className: "flex-1 p-4 overflow-y-auto", ref: scrollAreaRef, children: _jsxs("div", { className: "space-y-4", children: [messages.map((message) => {
                            // Check if this is the current user's message
                            const isCurrentUser = message.senderId === 'user' || message.senderId === currentUserId;
                            // Use the isAI flag from the message
                            const isAIMessage = message.isAI === true;
                            console.log(`[MessageView] Rendering message - senderId: "${message.senderId}", currentUserId: "${currentUserId}", isCurrentUser: ${isCurrentUser}, isAI: ${isAIMessage}, content: "${message.content.substring(0, 50)}..."`);
                            // Convert to enhanced message format for enhanced UI
                            if (useEnhancedUI) {
                                // Extract hashtags from message content
                                const hashtagRegex = /#[\w-]+/g;
                                const hashtags = message.content.match(hashtagRegex) || [];
                                const subjects = hashtags.map(tag => tag.slice(1)); // Remove # prefix
                                // Parse attachment references from message content
                                let messageAttachmentsList = [];
                                let cleanedText = message.content;
                                // Check for attachment references in the format [Attachments: hash1, hash2]
                                const attachmentRegex = /\[Attachments: ([^\]]+)\]/;
                                const attachmentMatch = message.content.match(attachmentRegex);
                                if (attachmentMatch) {
                                    const attachmentHashes = attachmentMatch[1].split(', ');
                                    console.log('[MessageView] Found attachment hashes in message:', attachmentHashes);
                                    // Clean the text by removing the attachment reference
                                    cleanedText = message.content.replace(attachmentRegex, '').trim();
                                    // Look up stored attachment descriptors
                                    for (const hash of attachmentHashes) {
                                        const descriptor = attachmentDescriptors.get(hash);
                                        if (descriptor) {
                                            messageAttachmentsList.push({
                                                id: hash,
                                                name: descriptor.name,
                                                type: descriptor.type.startsWith('image/') ? 'image' :
                                                    descriptor.type.startsWith('video/') ? 'video' :
                                                        descriptor.type.startsWith('audio/') ? 'audio' : 'document',
                                                url: hash, // Use hash as URL identifier
                                                thumbnail: descriptor.type.startsWith('image/') ? hash : undefined,
                                                size: descriptor.size,
                                                subjects: [],
                                                trustLevel: 3
                                            });
                                            console.log('[MessageView] Added attachment to message:', descriptor.name);
                                        }
                                    }
                                }
                                const enhancedMessage = {
                                    id: message.id,
                                    text: cleanedText, // Use cleaned text without attachment references
                                    senderId: message.senderId,
                                    senderName: isAIMessage ? 'AI' : (contactNames[message.senderId] || 'Unknown'),
                                    timestamp: message.timestamp,
                                    isOwn: isCurrentUser,
                                    subjects: subjects,
                                    trustLevel: 3, // Default colleague level
                                    attachments: messageAttachmentsList
                                };
                                return (_jsx(EnhancedMessageBubble, { message: enhancedMessage, onHashtagClick: handleHashtagClick, onAttachmentClick: handleAttachmentClick, onDownloadAttachment: handleDownloadAttachment, theme: "dark", attachmentDescriptors: attachmentDescriptors }, message.id));
                            }
                            return (_jsxs("div", { className: `flex gap-2 mb-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`, children: [!isCurrentUser && (shouldShowSenderLabels || isAIMessage) && (_jsx(Avatar, { className: "h-8 w-8 shrink-0", children: _jsx(AvatarFallback, { className: "text-xs", children: isAIMessage ? 'AI' : (contactNames[message.senderId] || 'Unknown').substring(0, 2).toUpperCase() }) })), _jsx("div", { className: "flex flex-col max-w-[70%]", children: _jsxs("div", { className: `message-bubble relative group ${isCurrentUser
                                                ? 'message-bubble-user'
                                                : isAIMessage
                                                    ? 'message-bubble-ai'
                                                    : 'message-bubble-other'}`, children: [_jsxs("div", { className: "flex items-end gap-2", children: [_jsx("div", { className: "flex-1 pr-1", children: _jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], components: {
                                                                    // Style tables to inherit from bubble
                                                                    table: ({ children }) => (_jsx("div", { className: "overflow-x-auto my-2", children: _jsx("table", { className: "border-collapse w-full", children: children }) })),
                                                                    th: ({ children }) => (_jsx("th", { className: "border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold", children: children })),
                                                                    td: ({ children }) => (_jsx("td", { className: "border border-gray-300 dark:border-gray-600 px-3 py-2", children: children })),
                                                                    // Code blocks - use subtle overlay based on message type
                                                                    code: ({ inline, children }) => {
                                                                        const bgClass = isCurrentUser
                                                                            ? 'bg-white/20'
                                                                            : 'bg-black/5 dark:bg-white/5';
                                                                        const borderClass = isCurrentUser
                                                                            ? 'border-white/20'
                                                                            : 'border-black/10 dark:border-white/10';
                                                                        return inline ? (_jsx("code", { className: `${bgClass} px-1 rounded`, children: children })) : (_jsx("code", { className: `block ${bgClass} p-2 rounded my-2 overflow-x-auto border ${borderClass}`, children: children }));
                                                                    },
                                                                    // Style links
                                                                    a: ({ children, href }) => (_jsx("a", { href: href, className: "underline hover:opacity-80", target: "_blank", rel: "noopener noreferrer", children: children })),
                                                                    // Style paragraphs - inherit color from bubble
                                                                    p: ({ children }) => (_jsx("p", { className: "mb-2", children: children })),
                                                                    // Style lists
                                                                    ul: ({ children }) => (_jsx("ul", { className: "list-disc list-inside mb-2", children: children })),
                                                                    ol: ({ children }) => (_jsx("ol", { className: "list-decimal list-inside mb-2", children: children }))
                                                                }, children: message.content }) }), isCurrentUser && (_jsxs("div", { className: "flex items-end gap-1 text-xs text-white/60 pb-0.5 shrink-0", children: [_jsx("span", { className: "text-[10px]", children: message.timestamp.toLocaleTimeString('en-US', {
                                                                        hour: 'numeric',
                                                                        minute: '2-digit',
                                                                        hour12: true
                                                                    }).toLowerCase() }), _jsx(CheckCheck, { className: "h-3 w-3" }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { variant: "ghost", size: "icon", className: "h-4 w-4 p-0 hover:bg-transparent opacity-0 group-hover:opacity-100 transition-opacity ml-0.5", children: _jsx(MoreVertical, { className: "h-3 w-3" }) }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsxs(DropdownMenuItem, { onClick: () => navigator.clipboard.writeText(message.content), children: [_jsx(Copy, { className: "mr-2 h-4 w-4" }), "Copy"] }), _jsxs(DropdownMenuItem, { disabled: true, children: [_jsx(Edit, { className: "mr-2 h-4 w-4" }), "Edit"] }), _jsxs(DropdownMenuItem, { disabled: true, children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), "Delete"] })] })] })] }))] }), message.attachments && message.attachments.length > 0 && (_jsx("div", { className: "mt-2 space-y-2", children: message.attachments.map((attachment, index) => {
                                                        const descriptor = attachmentDescriptors.get(attachment.hash);
                                                        return createAttachmentView(attachment, descriptor, {
                                                            key: `${message.id}-attachment-${index}`,
                                                            mode: 'inline',
                                                            onClick: handleAttachmentClick,
                                                            onDownload: handleDownloadAttachment,
                                                            className: 'mt-2'
                                                        });
                                                    }) }))] }) })] }, message.id));
                        }), (isAIProcessing || aiStreamingContent) && (_jsxs("div", { className: "flex gap-2 mb-2 justify-start", children: [_jsx(Avatar, { className: "h-8 w-8 shrink-0", children: _jsx(AvatarFallback, { className: "text-xs", children: "AI" }) }), _jsx("div", { className: "flex flex-col max-w-[70%]", children: _jsx("div", { className: "message-bubble message-bubble-ai", children: aiStreamingContent ? (
                                        // Show streaming content if available
                                        _jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], children: aiStreamingContent })) : (
                                        // Show typing indicator
                                        _jsxs("div", { className: "typing-indicator", children: [_jsx("span", {}), _jsx("span", {}), _jsx("span", {})] })) }) })] })), _jsx("div", { ref: messagesEndRef })] }) }), useEnhancedUI ? (_jsx(EnhancedMessageInput, { onSendMessage: handleEnhancedSend, onHashtagClick: handleHashtagClick, placeholder: placeholder, disabled: sending, theme: "dark" })) : (_jsx("div", { className: "p-4 border-t", children: _jsxs("div", { className: "flex space-x-2", children: [_jsx(Input, { value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, placeholder: placeholder, disabled: sending, className: "flex-1" }), _jsx(Button, { onClick: handleSend, disabled: !input.trim() || sending, size: "icon", children: sending ? (_jsx(Loader2, { className: "h-4 w-4 animate-spin" })) : (_jsx(Send, { className: "h-4 w-4" })) })] }) }))] }));
}
