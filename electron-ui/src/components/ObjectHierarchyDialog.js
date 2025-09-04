import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, ChevronDown, FileText, User, MessageSquare, FolderOpen, Database, Hash, Clock, HardDrive, Package } from 'lucide-react';
export function ObjectHierarchyDialog({ open, onOpenChange, totalSize, onNavigate }) {
    const [hierarchy, setHierarchy] = useState([]);
    const [expandedNodes, setExpandedNodes] = useState(new Set());
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        if (open) {
            fetchObjectHierarchy();
        }
    }, [open]);
    const fetchObjectHierarchy = async () => {
        setLoading(true);
        try {
            const lamaBridge = window.lamaBridge;
            if (!lamaBridge || !lamaBridge.appModel) {
                console.error('[ObjectHierarchy] No lamaBridge available');
                setHierarchy([]);
                return;
            }
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
                        percentage: totalSize > 0 ? (convSize / totalSize) * 100 : 0
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
                            percentage: totalSize > 0 ? (convSize / totalSize) * 100 : 0
                        });
                        messageData.count += messages.length;
                        messageData.size += convSize;
                    }
                }
            }
            catch (e) {
                console.error('[ObjectHierarchy] Error fetching messages:', e);
            }
            messageData.percentage = totalSize > 0 ? (messageData.size / totalSize) * 100 : 0;
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
                        percentage: totalSize > 0 ? (meSize / totalSize) * 100 : 0
                    });
                    contactData.size += meSize;
                }
                if (ai.length > 0) {
                    const aiSize = estimateObjectSize(ai);
                    contactData.children?.push({
                        type: 'AI Models',
                        count: ai.length,
                        size: aiSize,
                        percentage: totalSize > 0 ? (aiSize / totalSize) * 100 : 0
                    });
                    contactData.size += aiSize;
                }
                if (humans.length > 0) {
                    const humanSize = estimateObjectSize(humans);
                    contactData.children?.push({
                        type: 'Human Contacts',
                        count: humans.length,
                        size: humanSize,
                        percentage: totalSize > 0 ? (humanSize / totalSize) * 100 : 0
                    });
                    contactData.size += humanSize;
                }
                contactData.count = contacts.length;
            }
            catch (e) {
                console.error('[ObjectHierarchy] Error fetching contacts:', e);
            }
            contactData.percentage = totalSize > 0 ? (contactData.size / totalSize) * 100 : 0;
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
            const systemOverhead = totalSize - messageData.size - contactData.size;
            if (systemOverhead > 0) {
                systemData.children?.push({
                    type: 'Keys & Certificates',
                    count: 0, // Unknown count
                    size: systemOverhead * 0.3,
                    percentage: totalSize > 0 ? (systemOverhead * 0.3 / totalSize) * 100 : 0
                });
                systemData.children?.push({
                    type: 'Metadata & Indexes',
                    count: 0,
                    size: systemOverhead * 0.4,
                    percentage: totalSize > 0 ? (systemOverhead * 0.4 / totalSize) * 100 : 0
                });
                systemData.children?.push({
                    type: 'CRDT State',
                    count: 0,
                    size: systemOverhead * 0.3,
                    percentage: totalSize > 0 ? (systemOverhead * 0.3 / totalSize) * 100 : 0
                });
                systemData.size = systemOverhead;
                systemData.percentage = totalSize > 0 ? (systemOverhead / totalSize) * 100 : 0;
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
            onOpenChange(false);
        }
        else if (node.type.includes('Conversation')) {
            // Extract conversation ID if available
            if (node.type === 'Default Conversation') {
                onNavigate('chats', 'default');
            }
            else {
                onNavigate('chats');
            }
            onOpenChange(false);
        }
        else if (node.type === 'Contacts' || node.type.includes('Contact') || node.type.includes('AI') || node.type.includes('Human')) {
            onNavigate('contacts');
            onOpenChange(false);
        }
        else if (node.type === 'Me (Identity)') {
            onNavigate('settings');
            onOpenChange(false);
        }
    };
    const isNavigable = (node) => {
        return node.type === 'Messages' ||
            node.type === 'Contacts' ||
            node.type.includes('Conversation') ||
            node.type.includes('AI') ||
            node.type.includes('Human') ||
            node.type === 'Me (Identity)';
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
                            }, children: [node.type, navigable && onNavigate && (_jsx("span", { className: "ml-1 text-xs text-muted-foreground", children: "\u2192" }))] }), node.count > 0 && (_jsxs(Badge, { variant: "secondary", className: "ml-2", children: [node.count, " items"] })), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx("span", { className: "text-sm text-muted-foreground", children: formatBytes(node.size) }), _jsxs("span", { className: "text-xs text-muted-foreground", children: ["(", node.percentage.toFixed(1), "%)"] })] })] }), hasChildren && isExpanded && (_jsx("div", { children: node.children?.map((child, index) => renderNode(child, `${path}-${index}`, level + 1)) }))] }, path));
    };
    return (_jsx(Dialog, { open: open, onOpenChange: onOpenChange, children: _jsxs(DialogContent, { className: "max-w-3xl max-h-[80vh]", children: [_jsxs(DialogHeader, { children: [_jsxs(DialogTitle, { className: "flex items-center space-x-2", children: [_jsx(HardDrive, { className: "h-5 w-5" }), _jsx("span", { children: "Object Storage Hierarchy" })] }), _jsx(DialogDescription, { children: "Detailed breakdown of objects stored in your Internet of Me" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between text-sm", children: [_jsx("span", { className: "font-medium", children: "Total Storage Used" }), _jsx("span", { className: "text-muted-foreground", children: formatBytes(totalSize) })] }), _jsx(Progress, { value: 100, className: "h-2" })] }), _jsx(ScrollArea, { className: "h-[400px] border rounded-md p-4", children: loading ? (_jsx("div", { className: "flex items-center justify-center h-32", children: _jsx("span", { className: "text-muted-foreground", children: "Loading object hierarchy..." }) })) : hierarchy.length === 0 ? (_jsx("div", { className: "flex items-center justify-center h-32", children: _jsx("span", { className: "text-muted-foreground", children: "No objects found" }) })) : (_jsx("div", { className: "space-y-1", children: hierarchy.map((node, index) => renderNode(node, `root-${index}`)) })) }), _jsx("div", { className: "border-t pt-4", children: _jsxs("div", { className: "grid grid-cols-3 gap-4 text-xs text-muted-foreground", children: [_jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(MessageSquare, { className: "h-3 w-3" }), _jsx("span", { children: "Messages & Conversations" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(User, { className: "h-3 w-3" }), _jsx("span", { children: "Contacts & Identities" })] }), _jsxs("div", { className: "flex items-center space-x-2", children: [_jsx(Package, { className: "h-3 w-3" }), _jsx("span", { children: "System & Metadata" })] })] }) })] })] }) }));
}
