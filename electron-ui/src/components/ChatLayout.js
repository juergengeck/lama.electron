import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { MessageSquare, Plus, Trash2, Bot, Loader2, MoreVertical, Edit, CheckCheck } from 'lucide-react';
import { ChatView } from './ChatView';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { InputDialog } from './InputDialog';
export function ChatLayout({ selectedConversationId } = {}) {
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(selectedConversationId || null);
    const [searchQuery, setSearchQuery] = useState('');
    const [processingConversations, setProcessingConversations] = useState(new Set());
    const [showNewChatDialog, setShowNewChatDialog] = useState(false);
    const [showRenameDialog, setShowRenameDialog] = useState(false);
    const [conversationToRename, setConversationToRename] = useState(null);
    // Update selected conversation when prop changes
    useEffect(() => {
        if (selectedConversationId) {
            setSelectedConversation(selectedConversationId);
        }
    }, [selectedConversationId]);
    // Load conversations from localStorage on startup
    useEffect(() => {
        const saved = localStorage.getItem('lama-conversations');
        if (saved) {
            try {
                let parsed = JSON.parse(saved);
                // Migrate old conversation IDs and ensure all have names
                parsed = parsed.map((conv, index) => {
                    // Ensure every conversation has a name
                    if (!conv.name) {
                        conv.name = conv.id === 'default' ? 'Chat with GPT-OSS' : `Chat ${index + 1}`;
                    }
                    // Migrate old ID
                    if (conv.id === 'default-ai-chat') {
                        return { ...conv, id: 'default', name: conv.name || 'Chat with GPT-OSS' };
                    }
                    return conv;
                });
                setConversations(parsed);
                if (selectedConversationId) {
                    setSelectedConversation(selectedConversationId);
                }
                else if (parsed.length > 0 && !selectedConversation) {
                    setSelectedConversation(parsed[0].id);
                }
                // Save migrated data back
                localStorage.setItem('lama-conversations', JSON.stringify(parsed));
            }
            catch (error) {
                console.error('Failed to load conversations:', error);
            }
        }
        else {
            // First time user - create a default AI chat
            const defaultConv = {
                id: 'default',
                name: 'Chat with GPT-OSS',
                lastMessage: 'Hello! I\'m your local AI assistant powered by Ollama. How can I help you today?',
                lastMessageTime: new Date(),
                modelName: 'GPT-OSS'
            };
            setConversations([defaultConv]);
            setSelectedConversation(defaultConv.id);
            localStorage.setItem('lama-conversations', JSON.stringify([defaultConv]));
        }
    }, []);
    // Save conversations to localStorage
    const saveConversations = (convs) => {
        localStorage.setItem('lama-conversations', JSON.stringify(convs));
        setConversations(convs);
    };
    // Create new conversation with the provided name
    const handleCreateConversation = async (chatName) => {
        try {
            if (!window.electronAPI) {
                throw new Error('Electron API not available');
            }
            // Create conversation through IPC handler
            const result = await window.electronAPI.invoke('chat:createConversation', {
                type: 'direct',
                participants: [],
                name: chatName
            });
            if (!result.success || !result.data) {
                throw new Error(result.error || 'Failed to create conversation');
            }
            const newConv = {
                id: result.data.id,
                name: result.data.name || chatName,
                lastMessage: result.data.lastMessage?.text,
                lastMessageTime: result.data.lastMessageAt || new Date(),
                modelName: 'GPT-OSS'
            };
            const updated = [newConv, ...conversations];
            saveConversations(updated);
            setSelectedConversation(newConv.id);
        }
        catch (error) {
            console.error('[ChatLayout] Error creating conversation:', error);
            const errorMessage = error?.message || 'Failed to create conversation';
            alert(`Error: ${errorMessage}`);
        }
    };
    // Delete conversation
    const deleteConversation = (id) => {
        const updated = conversations.filter(c => c.id !== id);
        saveConversations(updated);
        if (selectedConversation === id) {
            setSelectedConversation(updated.length > 0 ? updated[0].id : null);
        }
    };
    // Handle rename conversation
    const handleRenameConversation = (newName) => {
        if (!conversationToRename)
            return;
        const updated = conversations.map(c => c.id === conversationToRename ? { ...c, name: newName } : c);
        saveConversations(updated);
        setConversationToRename(null);
    };
    // Open rename dialog
    const openRenameDialog = (id) => {
        setConversationToRename(id);
        setShowRenameDialog(true);
    };
    // Filter conversations by search
    const filteredConversations = conversations.filter(conv => conv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase()));
    // Format time for display
    const formatTime = (time) => {
        if (!time)
            return '';
        const date = typeof time === 'string' ? new Date(time) : time;
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        if (hours < 1)
            return 'now';
        if (hours < 24)
            return `${hours}h ago`;
        if (days < 7)
            return `${days}d ago`;
        return time.toLocaleDateString();
    };
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-80 border-r border-border bg-card flex flex-col", children: [_jsxs("div", { className: "p-4 border-b border-border", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Conversations" }), _jsx(Button, { onClick: () => setShowNewChatDialog(true), size: "icon", variant: "ghost", className: "h-8 w-8", children: _jsx(Plus, { className: "h-4 w-4" }) })] }), _jsx(Input, { placeholder: "Search conversations...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "h-8" })] }), _jsx(ScrollArea, { className: "flex-1", children: _jsx("div", { className: "p-2 space-y-1", children: filteredConversations.length === 0 ? (_jsxs("div", { className: "text-center py-8 text-muted-foreground", children: [_jsx(Bot, { className: "h-12 w-12 mx-auto mb-3 opacity-50" }), _jsx("p", { className: "text-sm", children: "No matches found" }), _jsx("p", { className: "text-xs", children: "Try a different search" })] })) : (filteredConversations.map((conv) => (_jsxs("div", { onClick: () => setSelectedConversation(conv.id), className: `group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedConversation === conv.id
                                            ? 'bg-primary/10 border-2 border-primary/20'
                                            : 'hover:bg-muted border-2 border-transparent'}`, children: [_jsx("div", { className: "flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center", children: processingConversations.has(conv.id) ? (_jsx(Loader2, { className: "w-5 h-5 text-primary animate-spin" })) : (_jsx(Bot, { className: "w-5 h-5 text-primary" })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("h3", { className: "font-medium text-sm truncate", children: conv.name }), _jsxs(DropdownMenu, { children: [_jsx(DropdownMenuTrigger, { asChild: true, children: _jsx(Button, { onClick: (e) => e.stopPropagation(), size: "icon", variant: "ghost", className: "h-6 w-6 opacity-0 group-hover:opacity-100", children: _jsx(MoreVertical, { className: "h-3 w-3" }) }) }), _jsxs(DropdownMenuContent, { align: "end", children: [_jsxs(DropdownMenuItem, { onClick: (e) => {
                                                                                    e.stopPropagation();
                                                                                    openRenameDialog(conv.id);
                                                                                }, children: [_jsx(Edit, { className: "mr-2 h-4 w-4" }), "Rename"] }), _jsxs(DropdownMenuItem, { onClick: (e) => {
                                                                                    e.stopPropagation();
                                                                                    deleteConversation(conv.id);
                                                                                }, className: "text-destructive", children: [_jsx(Trash2, { className: "mr-2 h-4 w-4" }), "Delete"] })] })] })] }), conv.lastMessage && (_jsx("p", { className: "text-xs text-muted-foreground mb-1 line-clamp-2", children: conv.lastMessage.length > 50
                                                            ? conv.lastMessage.substring(0, 50) + '...'
                                                            : conv.lastMessage })), _jsxs("div", { className: "flex items-center justify-between text-xs text-muted-foreground", children: [_jsx("span", { children: formatTime(conv.lastMessageTime) }), _jsxs("div", { className: "flex items-center gap-1", children: [conv.lastMessage && (_jsx(CheckCheck, { className: "h-3 w-3 text-primary/70" })), _jsx("span", { className: "text-primary", children: conv.modelName })] })] })] })] }, conv.id)))) }) })] }), _jsx("div", { className: "flex-1", children: selectedConversation ? (_jsx(ChatView, { conversationId: selectedConversation, onProcessingChange: (isProcessing) => {
                                setProcessingConversations(prev => {
                                    const next = new Set(prev);
                                    if (isProcessing) {
                                        next.add(selectedConversation);
                                    }
                                    else {
                                        next.delete(selectedConversation);
                                    }
                                    return next;
                                });
                            } }, selectedConversation)) : (_jsx("div", { className: "flex items-center justify-center h-full text-muted-foreground", children: _jsxs("div", { className: "text-center", children: [_jsx(MessageSquare, { className: "h-16 w-16 mx-auto mb-4 opacity-50" }), _jsx("p", { className: "text-lg mb-2", children: "Welcome to LAMA" }), _jsx("p", { className: "text-sm", children: "Select a conversation or create a new one to get started" })] }) })) })] }), _jsx(InputDialog, { open: showNewChatDialog, onOpenChange: setShowNewChatDialog, title: "New Chat", description: "Enter a name for your new chat conversation", label: "Chat Name", placeholder: "e.g., Project Discussion", defaultValue: `Chat ${conversations.length + 1}`, onSubmit: handleCreateConversation }), _jsx(InputDialog, { open: showRenameDialog, onOpenChange: setShowRenameDialog, title: "Rename Chat", description: "Enter a new name for this chat", label: "Chat Name", defaultValue: conversations.find(c => c.id === conversationToRename)?.name || '', onSubmit: handleRenameConversation })] }));
}
