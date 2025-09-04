import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChevronRight, ChevronDown, FileText, User, MessageSquare, FolderOpen, Database, Hash, Clock, HardDrive, Package, Search, ArrowLeft, RefreshCw, Download } from 'lucide-react';
export function ObjectHierarchyView({ onNavigate, onBack }) {
    const [hierarchy, setHierarchy] = useState([]);
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [totalSize, setTotalSize] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState(null);
    useEffect(() => {
        fetchObjectHierarchy();
    }, []);
    const fetchObjectHierarchy = async () => {
        setLoading(true);
        try {
            const lamaBridge = window.lamaBridge;
            if (!lamaBridge || !lamaBridge.appModel) {
                console.error('[ObjectHierarchy] No lamaBridge available');
                setHierarchy([]);
                return;
            }
            // Get total size first
            const storageEstimate = await navigator.storage?.estimate();
            const totalBytes = storageEstimate?.usage || 0;
            setTotalSize(totalBytes);
            const hierarchyData = [];
            // Messages hierarchy
            const messageData = {
                type: 'Messages',
                count: 0,
                size: 0,
                percentage: 0,
                children: []
            };
            try {
                // Get all conversations
                const conversations = await lamaBridge.getConversations?.() || [];
                const defaultMessages = await lamaBridge.getMessages('default') || [];
                if (defaultMessages.length > 0) {
                    const convSize = estimateObjectSize(defaultMessages);
                    messageData.children?.push({
                        type: 'Default Conversation',
                        count: defaultMessages.length,
                        size: convSize,
                        percentage: totalBytes > 0 ? (convSize / totalBytes) * 100 : 0
                    });
                    messageData.count += defaultMessages.length;
                    messageData.size += convSize;
                }
                for (const conv of conversations) {
                    const messages = await lamaBridge.getMessages(conv.id) || [];
                    if (messages.length > 0) {
                        const convSize = estimateObjectSize(messages);
                        messageData.children?.push({
                            type: conv.name || conv.id,
                            count: messages.length,
                            size: convSize,
                            percentage: totalBytes > 0 ? (convSize / totalBytes) * 100 : 0
                        });
                        messageData.count += messages.length;
                        messageData.size += convSize;
                    }
                }
            }
            catch (e) {
                console.error('[ObjectHierarchy] Error fetching messages:', e);
            }
            messageData.percentage = totalBytes > 0 ? (messageData.size / totalBytes) * 100 : 0;
            if (messageData.count > 0)
                hierarchyData.push(messageData);
            // Contacts hierarchy
            const contactData = {
                type: 'Contacts',
                count: 0,
                size: 0,
                percentage: 0,
                children: []
            };
            try {
                const contacts = await lamaBridge.appModel?.getContacts?.() || [];
                // Separate by type
                const me = contacts.filter((c) => c.isMe);
                const ai = contacts.filter((c) => c.isAI);
                const humans = contacts.filter((c) => !c.isMe && !c.isAI);
                if (me.length > 0) {
                    const meSize = estimateObjectSize(me);
                    contactData.children?.push({
                        type: 'Me (Identity)',
                        count: me.length,
                        size: meSize,
                        percentage: totalBytes > 0 ? (meSize / totalBytes) * 100 : 0
                    });
                    contactData.size += meSize;
                }
                if (ai.length > 0) {
                    const aiSize = estimateObjectSize(ai);
                    contactData.children?.push({
                        type: 'AI Models',
                        count: ai.length,
                        size: aiSize,
                        percentage: totalBytes > 0 ? (aiSize / totalBytes) * 100 : 0
                    });
                    contactData.size += aiSize;
                }
                if (humans.length > 0) {
                    const humanSize = estimateObjectSize(humans);
                    contactData.children?.push({
                        type: 'Human Contacts',
                        count: humans.length,
                        size: humanSize,
                        percentage: totalBytes > 0 ? (humanSize / totalBytes) * 100 : 0
                    });
                    contactData.size += humanSize;
                }
                contactData.count = contacts.length;
            }
            catch (e) {
                console.error('[ObjectHierarchy] Error fetching contacts:', e);
            }
            contactData.percentage = totalBytes > 0 ? (contactData.size / totalBytes) * 100 : 0;
            if (contactData.count > 0)
                hierarchyData.push(contactData);
            // ONE.CORE System Objects
            const systemData = {
                type: 'System Objects',
                count: 0,
                size: 0,
                percentage: 0,
                children: []
            };
            // Estimate system overhead (keys, certificates, metadata)
            const systemOverhead = totalBytes - messageData.size - contactData.size;
            if (systemOverhead > 0) {
                systemData.children?.push({
                    type: 'Keys & Certificates',
                    count: 0, // Unknown count
                    size: systemOverhead * 0.3,
                    percentage: totalBytes > 0 ? (systemOverhead * 0.3 / totalBytes) * 100 : 0
                });
                systemData.children?.push({
                    type: 'Metadata & Indexes',
                    count: 0,
                    size: systemOverhead * 0.4,
                    percentage: totalBytes > 0 ? (systemOverhead * 0.4 / totalBytes) * 100 : 0
                });
                systemData.children?.push({
                    type: 'CRDT State',
                    count: 0,
                    size: systemOverhead * 0.3,
                    percentage: totalBytes > 0 ? (systemOverhead * 0.3 / totalBytes) * 100 : 0
                });
                systemData.size = systemOverhead;
                systemData.percentage = totalBytes > 0 ? (systemOverhead / totalBytes) * 100 : 0;
                hierarchyData.push(systemData);
            }
            setHierarchy(hierarchyData);
        }
        catch (error) {
            console.error('[ObjectHierarchy] Failed to fetch hierarchy:', error);
            setHierarchy([]);
        }
        finally {
            setLoading(false);
        }
    };
    const estimateObjectSize = (obj) => {
        // Rough estimation of object size in bytes
        try {
            const jsonStr = JSON.stringify(obj);
            return new Blob([jsonStr]).size;
        }
        catch {
            return 0;
        }
    };
    const formatBytes = (bytes) => {
        if (bytes === 0)
            return '0 B';
        if (bytes < 1024)
            return bytes + ' B';
        if (bytes < 1024 * 1024)
            return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1024 * 1024 * 1024)
            return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
        return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    };
    const toggleNode = (path) => {
        const newExpanded = new Set(expandedNodes);
        if (newExpanded.has(path)) {
            newExpanded.delete(path);
        }
        else {
            newExpanded.add(path);
        }
        setExpandedNodes(newExpanded);
    };
    const getIcon = (type) => {
        if (type.includes('Message'))
            return _jsx(MessageSquare, { className: "h-4 w-4" });
        if (type.includes('Contact') || type.includes('AI') || type.includes('Human') || type.includes('Me'))
            return _jsx(User, { className: "h-4 w-4" });
        if (type.includes('Conversation'))
            return _jsx(FolderOpen, { className: "h-4 w-4" });
        if (type.includes('Key') || type.includes('Certificate'))
            return _jsx(Hash, { className: "h-4 w-4" });
        if (type.includes('Metadata') || type.includes('Index'))
            return _jsx(Database, { className: "h-4 w-4" });
        if (type.includes('CRDT'))
            return _jsx(Clock, { className: "h-4 w-4" });
        if (type.includes('System'))
            return _jsx(Package, { className: "h-4 w-4" });
        return _jsx(FileText, { className: "h-4 w-4" });
    };
    const handleNodeClick = (node, event) => {
        // Prevent toggling when clicking navigation links
        if (event.target.closest('.navigate-link')) {
            return;
        }
        const path = event.currentTarget.dataset.path;
        if (path && node.children && node.children.length > 0) {
            toggleNode(path);
        }
    };
    const handleNavigate = (node) => {
        if (!onNavigate)
            return;
        // Navigate based on node type
        if (node.type === 'Messages' || node.type.includes('Message')) {
            onNavigate('chats');
        }
        else if (node.type.includes('Conversation')) {
            // Extract conversation ID if available
            if (node.type === 'Default Conversation') {
                onNavigate('chats', 'default');
            }
            else {
                onNavigate('chats');
            }
        }
        else if (node.type === 'Contacts' || node.type.includes('Contact') || node.type.includes('AI') || node.type.includes('Human')) {
            onNavigate('contacts');
        }
        else if (node.type === 'Me (Identity)') {
            onNavigate('settings');
        }
        else if (node.type === 'System Objects' || node.type.includes('Keys') || node.type.includes('Metadata') || node.type.includes('CRDT')) {
            // Navigate to settings and scroll to system objects section
            onNavigate('settings', undefined, 'system-objects');
        }
    };
    const isNavigable = (node) => {
        return node.type === 'Messages' ||
            node.type === 'Contacts' ||
            node.type.includes('Conversation') ||
            node.type.includes('AI') ||
            node.type.includes('Human') ||
            node.type === 'Me (Identity)' ||
            node.type === 'System Objects' ||
            node.type.includes('Keys') ||
            node.type.includes('Metadata') ||
            node.type.includes('CRDT');
    };
    const filterNodes = (nodes) => {
        if (!searchQuery && !filterType)
            return nodes;
        return nodes.filter(node => {
            const matchesSearch = !searchQuery ||
                node.type.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesFilter = !filterType ||
                node.type.includes(filterType);
            if (node.children) {
                const filteredChildren = filterNodes(node.children);
                if (filteredChildren.length > 0)
                    return true;
            }
            return matchesSearch && matchesFilter;
        });
    };
    const renderNode = (node, path = '', level = 0) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedNodes.has(path);
        const navigable = isNavigable(node);
        return (_jsxs("div", { className: "select-none", children: [_jsxs("div", { className: `flex items-center space-x-2 py-2 px-3 hover:bg-accent rounded-md cursor-pointer ${level > 0 ? 'ml-' + (level * 4) : ''}`, onClick: (e) => handleNodeClick(node, e), "data-path": path, style: { paddingLeft: `${level * 20 + 12}px` }, children: [hasChildren ? (isExpanded ? _jsx(ChevronDown, { className: "h-4 w-4" }) : _jsx(ChevronRight, { className: "h-4 w-4" })) : (_jsx("div", { className: "w-4" })), getIcon(node.type), _jsxs("span", { className: `flex-1 font-medium ${navigable ? 'navigate-link text-blue-600 hover:underline' : ''}`, onClick: (e) => {
                                if (navigable && onNavigate) {
                                    e.stopPropagation();
                                    handleNavigate(node);
                                }
                            }, children: [node.type, navigable && onNavigate && (_jsx("span", { className: "ml-1 text-xs text-muted-foreground", children: "\u2192" }))] }), node.count > 0 && (_jsxs(Badge, { variant: "secondary", className: "ml-2", children: [node.count, " items"] })), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: formatBytes(node.size) }), _jsxs("span", { className: "text-xs text-muted-foreground", children: ["(", node.percentage.toFixed(1), "%)"] })] })] }), hasChildren && isExpanded && (_jsx("div", { children: filterNodes(node.children || []).map((child, index) => renderNode(child, `${path}-${index}`, level + 1)) }))] }, path));
    };
    const filteredHierarchy = filterNodes(hierarchy);
    return (_jsxs("div", { className: "h-full flex flex-col space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center space-x-4", children: [onBack && (_jsxs(Button, { variant: "ghost", size: "sm", onClick: onBack, children: [_jsx(ArrowLeft, { className: "h-4 w-4 mr-2" }), "Back"] })), _jsxs("div", { children: [_jsxs("h2", { className: "text-2xl font-bold flex items-center space-x-2", children: [_jsx(HardDrive, { className: "h-6 w-6" }), _jsx("span", { children: "Object Storage Hierarchy" })] }), _jsx("p", { className: "text-muted-foreground", children: "Detailed breakdown of objects stored in your Internet of Me" })] })] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: fetchObjectHierarchy, disabled: loading, children: [_jsx(RefreshCw, { className: `h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}` }), "Refresh"] })] }), _jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "flex items-center space-x-4", children: [_jsxs("div", { className: "flex-1 relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" }), _jsx(Input, { placeholder: "Search objects...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "pl-9" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsxs(Button, { variant: filterType === 'Messages' ? 'default' : 'outline', size: "sm", onClick: () => setFilterType(filterType === 'Messages' ? null : 'Messages'), children: [_jsx(MessageSquare, { className: "h-4 w-4 mr-1" }), "Messages"] }), _jsxs(Button, { variant: filterType === 'Contacts' ? 'default' : 'outline', size: "sm", onClick: () => setFilterType(filterType === 'Contacts' ? null : 'Contacts'), children: [_jsx(User, { className: "h-4 w-4 mr-1" }), "Contacts"] }), _jsxs(Button, { variant: filterType === 'System' ? 'default' : 'outline', size: "sm", onClick: () => setFilterType(filterType === 'System' ? null : 'System'), children: [_jsx(Package, { className: "h-4 w-4 mr-1" }), "System"] })] }), _jsxs(Button, { variant: "outline", size: "sm", children: [_jsx(Download, { className: "h-4 w-4 mr-2" }), "Export"] })] }) }) }), _jsxs(Card, { children: [_jsx(CardHeader, { className: "pb-3", children: _jsx(CardTitle, { className: "text-lg", children: "Total Storage Used" }) }), _jsx(CardContent, { children: _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "font-medium", children: "Total" }), _jsx("span", { className: "text-muted-foreground", children: formatBytes(totalSize) })] }), _jsx(Progress, { value: 100, className: "h-2" }), _jsxs("div", { className: "grid grid-cols-4 gap-4 mt-4 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-muted-foreground", children: "Messages" }), _jsx("p", { className: "font-medium", children: hierarchy.find(h => h.type === 'Messages')?.count || 0 })] }), _jsxs("div", { children: [_jsx("p", { className: "text-muted-foreground", children: "Contacts" }), _jsx("p", { className: "font-medium", children: hierarchy.find(h => h.type === 'Contacts')?.count || 0 })] }), _jsxs("div", { children: [_jsx("p", { className: "text-muted-foreground", children: "System" }), _jsx("p", { className: "font-medium", children: formatBytes(hierarchy.find(h => h.type === 'System Objects')?.size || 0) })] }), _jsxs("div", { children: [_jsx("p", { className: "text-muted-foreground", children: "Total Objects" }), _jsx("p", { className: "font-medium", children: hierarchy.reduce((sum, h) => sum + h.count, 0) })] })] })] }) })] }), _jsxs(Card, { className: "flex-1 flex flex-col min-h-0", children: [_jsxs(CardHeader, { className: "flex-shrink-0", children: [_jsx(CardTitle, { children: "Object Tree" }), _jsx(CardDescription, { children: "Click on categories to navigate to relevant sections \u2022 Expand nodes to see details \u2022 System objects link to Settings" })] }), _jsx(CardContent, { className: "flex-1 p-0 min-h-0", children: _jsx(ScrollArea, { className: "h-full px-4 pb-4", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-32", children: _jsx("span", { className: "text-muted-foreground", children: "Loading object hierarchy..." }) })) : filteredHierarchy.length === 0 ? (_jsx("div", { className: "flex items-center justify-center h-32", children: _jsx("span", { className: "text-muted-foreground", children: searchQuery || filterType ? 'No matching objects found' : 'No objects found' }) })) : (_jsx("div", { className: "space-y-1", children: filteredHierarchy.map((node, index) => renderNode(node, `root-${index}`)) })) }) })] }), _jsx(Card, { children: _jsx(CardContent, { className: "p-4", children: _jsxs("div", { className: "grid grid-cols-3 gap-4 text-xs text-muted-foreground", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(MessageSquare, { className: "h-3 w-3" }), _jsx("span", { children: "Messages & Conversations" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(User, { className: "h-3 w-3" }), _jsx("span", { children: "Contacts & Identities" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Package, { className: "h-3 w-3" }), _jsx("span", { children: "System & Metadata (click to view in Settings)" })] })] }) }) })] }));
}
