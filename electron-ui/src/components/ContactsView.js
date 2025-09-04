import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, UserPlus, Search, Circle, Bot, MessageSquare } from 'lucide-react';
import { useLama } from '@/hooks/useLama';
export function ContactsView({ onNavigateToChat }) {
    const { bridge } = useLama();
    const [contacts, setContacts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [creatingTopic, setCreatingTopic] = useState(null);
    useEffect(() => {
        loadContacts();
        // Listen for contact updates
        const handleContactsUpdated = () => {
            console.log('[ContactsView] Contacts updated event received');
            loadContacts();
        };
        // Listen for IPC contact added events from Node.js
        const handleContactAdded = () => {
            console.log('[ContactsView] Contact added via IPC');
            loadContacts();
        };
        window.addEventListener('contacts:updated', handleContactsUpdated);
        // Listen for IPC events if in Electron
        if (window.electronAPI?.on) {
            window.electronAPI.on('contact:added', handleContactAdded);
        }
        // Also refresh contacts periodically
        const interval = setInterval(loadContacts, 5000);
        return () => {
            window.removeEventListener('contacts:updated', handleContactsUpdated);
            clearInterval(interval);
        };
    }, [bridge]);
    const loadContacts = async () => {
        if (!bridge)
            return;
        setLoading(true);
        try {
            // Get real contacts from AppModel
            const allContacts = await bridge.getContacts();
            setContacts(allContacts || []);
        }
        finally {
            setLoading(false);
        }
    };
    const filteredContacts = contacts.filter(contact => contact.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const getStatusColor = (status) => {
        switch (status) {
            case 'connected': return 'text-green-500';
            case 'connecting': return 'text-yellow-500';
            case 'disconnected': return 'text-gray-500';
            default: return 'text-gray-500';
        }
    };
    const getStatusLabel = (status) => {
        switch (status) {
            case 'connected': return 'Online';
            case 'connecting': return 'Connecting...';
            case 'disconnected': return 'Offline';
            default: return 'Unknown';
        }
    };
    const handleMessageClick = async (contact) => {
        console.log('[ContactsView] Message clicked for contact:', contact);
        if (!bridge) {
            console.error('[ContactsView] Bridge not available');
            return;
        }
        // Set loading state for this contact
        setCreatingTopic(contact.id);
        try {
            // Get or create topic for this contact
            const topicId = await bridge.getOrCreateTopicForContact(contact.id);
            if (topicId) {
                console.log('[ContactsView] Navigating to chat with topic:', topicId);
                // Call the navigation callback if provided, including contact name
                if (onNavigateToChat) {
                    const contactName = contact.displayName || contact.name || 'Unknown';
                    onNavigateToChat(topicId, contactName);
                }
                else {
                    console.warn('[ContactsView] No navigation handler provided');
                }
            }
            else {
                console.error('[ContactsView] Failed to create topic for contact');
            }
        }
        catch (error) {
            console.error('[ContactsView] Error creating topic:', error);
        }
        finally {
            setCreatingTopic(null);
        }
    };
    return (_jsxs("div", { className: "h-full flex flex-col space-y-4", children: [_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Users, { className: "h-5 w-5 text-primary" }), _jsx(CardTitle, { children: "Contacts" })] }), _jsxs(Button, { size: "sm", children: [_jsx(UserPlus, { className: "h-4 w-4 mr-2" }), "Add Contact"] })] }) }), _jsx(CardContent, { children: _jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" }), _jsx(Input, { placeholder: "Search contacts...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "pl-10" })] }) })] }), _jsx(Card, { className: "flex-1 flex flex-col overflow-hidden", children: _jsx(CardContent, { className: "flex-1 p-0 overflow-hidden", children: _jsx(ScrollArea, { className: "h-full w-full", children: _jsx("div", { className: "p-4 space-y-2 max-h-[calc(100vh-300px)]", children: filteredContacts.length === 0 ? (_jsxs("div", { className: "text-center py-8 text-muted-foreground", children: [_jsx(Users, { className: "h-12 w-12 mx-auto mb-4 opacity-50" }), _jsx("p", { children: "No contacts found" }), _jsx("p", { className: "text-sm mt-2", children: "Add contacts to start messaging" })] })) : (filteredContacts.map((contact) => (_jsx(Card, { className: "hover:bg-accent transition-colors cursor-pointer", children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-3", children: [_jsx(Avatar, { children: _jsx(AvatarFallback, { className: contact.isAI ? 'bg-purple-100 dark:bg-purple-900' : '', children: contact.isAI ? (_jsx(Bot, { className: "h-5 w-5 text-purple-600 dark:text-purple-400" })) : ((contact.displayName || contact.name || 'UN').substring(0, 2).toUpperCase()) }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "font-medium truncate", children: contact.displayName || contact.name || 'Unknown' }), _jsx(Badge, { variant: contact.isAI ? "secondary" : "outline", className: "text-xs flex-shrink-0", children: contact.isAI ? 'AI' : 'P2P' })] }), _jsxs("div", { className: "flex items-center space-x-2 mt-1", children: [_jsx(Circle, { className: `h-2 w-2 fill-current ${getStatusColor(contact.status)}` }), _jsx("span", { className: "text-xs text-muted-foreground truncate", children: contact.isAI ? 'Ready' : getStatusLabel(contact.status) }), contact.lastSeen && (_jsxs("span", { className: "text-xs text-muted-foreground", children: ["\u00B7 Last seen ", new Date(contact.lastSeen).toLocaleTimeString()] }))] })] })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleMessageClick(contact), disabled: creatingTopic === contact.id, children: creatingTopic === contact.id ? (_jsx(_Fragment, { children: "Creating chat..." })) : (_jsxs(_Fragment, { children: [_jsx(MessageSquare, { className: "h-4 w-4 mr-1" }), "Message"] })) })] }) }) }, contact.id)))) }) }) }) })] }));
}
