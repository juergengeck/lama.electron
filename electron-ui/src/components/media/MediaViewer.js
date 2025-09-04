import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * MediaViewer - Gallery view for media attachments with Subject tagging
 *
 * This component provides a visual browser for media files with Subject-based
 * organization and tagging. It's the foundation for emergent memory patterns.
 */
import { useState, useMemo } from 'react';
import { Search, Filter, Grid, List, Tag, Plus, X, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { createAttachmentView } from '@/components/attachments/AttachmentViewFactory';
import { formatFileSize, getAttachmentType } from '@/types/attachments';
export const MediaViewer = ({ items = [], onItemClick, onSubjectClick, onAddSubject, onRemoveSubject, llmContactId }) => {
    const [viewMode, setViewMode] = useState('grid');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedSubjects, setSelectedSubjects] = useState(new Set());
    const [sortBy, setSortBy] = useState('recent');
    const [showAddSubject, setShowAddSubject] = useState(null);
    const [newSubject, setNewSubject] = useState('');
    // Extract all unique subjects with counts (demand tracking)
    const allSubjects = useMemo(() => {
        const subjectMap = new Map();
        items.forEach(item => {
            item.subjects.forEach(subject => {
                const existing = subjectMap.get(subject.name);
                if (existing) {
                    existing.count += 1;
                    if (subject.lastUsed > existing.lastUsed) {
                        existing.lastUsed = subject.lastUsed;
                    }
                }
                else {
                    subjectMap.set(subject.name, { ...subject });
                }
            });
        });
        return Array.from(subjectMap.values()).sort((a, b) => {
            if (sortBy === 'popular')
                return b.count - a.count;
            if (sortBy === 'alphabetical')
                return a.name.localeCompare(b.name);
            return b.lastUsed.getTime() - a.lastUsed.getTime();
        });
    }, [items, sortBy]);
    // Filter items based on search and selected subjects
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            // Text search
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const matchesName = item.attachment.name?.toLowerCase().includes(query);
                const matchesSubject = item.subjects.some(s => s.name.toLowerCase().includes(query));
                if (!matchesName && !matchesSubject)
                    return false;
            }
            // Subject filter (items must have ALL selected subjects)
            if (selectedSubjects.size > 0) {
                const itemSubjects = new Set(item.subjects.map(s => s.name));
                for (const selected of selectedSubjects) {
                    if (!itemSubjects.has(selected))
                        return false;
                }
            }
            return true;
        });
    }, [items, searchQuery, selectedSubjects]);
    // Handle subject selection for filtering
    const toggleSubjectFilter = (subject) => {
        const newSelection = new Set(selectedSubjects);
        if (newSelection.has(subject)) {
            newSelection.delete(subject);
        }
        else {
            newSelection.add(subject);
        }
        setSelectedSubjects(newSelection);
    };
    // Handle adding new subject to item
    const handleAddSubject = (itemHash) => {
        if (newSubject.trim() && onAddSubject) {
            // Format as hashtag if not already
            const subject = newSubject.startsWith('#')
                ? newSubject.slice(1)
                : newSubject;
            onAddSubject(itemHash, subject.toLowerCase().trim());
            setNewSubject('');
            setShowAddSubject(null);
        }
    };
    // Subject resonance indicator (demand/supply)
    const getSubjectResonance = (subject) => {
        const maxCount = Math.max(...allSubjects.map(s => s.count));
        const ratio = subject.count / maxCount;
        if (ratio > 0.6)
            return 'high';
        if (ratio > 0.3)
            return 'medium';
        return 'low';
    };
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "p-4 border-b space-y-4", children: [_jsxs("div", { className: "flex gap-2", children: [_jsxs("div", { className: "flex-1 relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" }), _jsx(Input, { value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), placeholder: "Search media and subjects...", className: "pl-9" })] }), _jsxs(Select, { value: sortBy, onValueChange: (v) => setSortBy(v), children: [_jsx(SelectTrigger, { className: "w-32", children: _jsx(SelectValue, {}) }), _jsxs(SelectContent, { children: [_jsx(SelectItem, { value: "recent", children: "Recent" }), _jsx(SelectItem, { value: "popular", children: "Popular" }), _jsx(SelectItem, { value: "alphabetical", children: "A-Z" })] })] }), _jsxs("div", { className: "flex gap-1 border rounded-md", children: [_jsx(Button, { variant: viewMode === 'grid' ? 'secondary' : 'ghost', size: "icon", onClick: () => setViewMode('grid'), children: _jsx(Grid, { className: "h-4 w-4" }) }), _jsx(Button, { variant: viewMode === 'list' ? 'secondary' : 'ghost', size: "icon", onClick: () => setViewMode('list'), children: _jsx(List, { className: "h-4 w-4" }) })] })] }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "text-sm text-muted-foreground flex items-center gap-1", children: [_jsx(Filter, { className: "h-3 w-3" }), "Filter by Subjects (", selectedSubjects.size, " active)"] }), _jsx("div", { className: "flex flex-wrap gap-2", children: allSubjects.slice(0, 20).map(subject => {
                                    const resonance = getSubjectResonance(subject);
                                    const isSelected = selectedSubjects.has(subject.name);
                                    return (_jsxs(Badge, { variant: isSelected ? 'default' : 'outline', className: `cursor-pointer transition-all ${resonance === 'high' ? 'border-green-500' :
                                            resonance === 'medium' ? 'border-yellow-500' :
                                                'border-gray-500'}`, onClick: () => toggleSubjectFilter(subject.name), children: [_jsx(Hash, { className: "h-3 w-3 mr-1" }), subject.name, _jsx("span", { className: "ml-1 text-xs opacity-60", children: subject.count })] }, subject.name));
                                }) })] }), _jsxs("div", { className: "text-sm text-muted-foreground", children: [filteredItems.length, " items", selectedSubjects.size > 0 && ` matching ${selectedSubjects.size} subjects`, llmContactId && ` • Viewing as ${llmContactId}`] })] }), _jsx("div", { className: "flex-1 overflow-auto p-4", children: viewMode === 'grid' ? (_jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4", children: filteredItems.map(item => (_jsxs("div", { className: "group relative border rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer", onClick: () => onItemClick?.(item), children: [_jsx("div", { className: "aspect-square bg-muted flex items-center justify-center", children: createAttachmentView(item.attachment, item.descriptor, {
                                    mode: 'thumbnail',
                                    showMetadata: false,
                                    maxWidth: 200,
                                    maxHeight: 200
                                }) }), _jsxs("div", { className: "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity", children: [_jsx("div", { className: "text-white text-xs truncate", children: item.attachment.name }), _jsx("div", { className: "text-white/60 text-xs", children: formatFileSize(item.attachment.size || 0) })] }), _jsxs("div", { className: "p-2 space-y-1", children: [_jsxs("div", { className: "flex flex-wrap gap-1", children: [item.subjects.slice(0, 3).map(subject => (_jsxs(Badge, { variant: "secondary", className: "text-xs cursor-pointer", onClick: (e) => {
                                                    e.stopPropagation();
                                                    onSubjectClick?.(subject.name);
                                                }, children: ["#", subject.name] }, subject.name))), item.subjects.length > 3 && (_jsxs(Badge, { variant: "outline", className: "text-xs", children: ["+", item.subjects.length - 3] }))] }), showAddSubject === item.attachment.hash ? (_jsxs("div", { className: "flex gap-1", children: [_jsx(Input, { value: newSubject, onChange: (e) => setNewSubject(e.target.value), placeholder: "Add subject...", className: "h-6 text-xs", onKeyDown: (e) => {
                                                    if (e.key === 'Enter') {
                                                        handleAddSubject(item.attachment.hash);
                                                    }
                                                    if (e.key === 'Escape') {
                                                        setShowAddSubject(null);
                                                        setNewSubject('');
                                                    }
                                                }, onClick: (e) => e.stopPropagation(), autoFocus: true }), _jsx(Button, { size: "icon", variant: "ghost", className: "h-6 w-6", onClick: (e) => {
                                                    e.stopPropagation();
                                                    setShowAddSubject(null);
                                                    setNewSubject('');
                                                }, children: _jsx(X, { className: "h-3 w-3" }) })] })) : (_jsxs(Button, { variant: "ghost", size: "sm", className: "h-6 text-xs w-full", onClick: (e) => {
                                            e.stopPropagation();
                                            setShowAddSubject(item.attachment.hash);
                                        }, children: [_jsx(Plus, { className: "h-3 w-3 mr-1" }), "Add Subject"] }))] })] }, item.attachment.hash))) })) : (_jsx("div", { className: "space-y-2", children: filteredItems.map(item => (_jsxs("div", { className: "flex items-center gap-4 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer", onClick: () => onItemClick?.(item), children: [_jsx("div", { className: "w-16 h-16 bg-muted rounded flex items-center justify-center flex-shrink-0", children: createAttachmentView(item.attachment, item.descriptor, {
                                    mode: 'compact',
                                    showMetadata: false
                                }) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "font-medium truncate", children: item.attachment.name }), _jsxs("div", { className: "text-sm text-muted-foreground", children: [getAttachmentType(item.attachment.mimeType || ''), " \u2022", formatFileSize(item.attachment.size || 0), " \u2022", item.addedAt.toLocaleDateString()] }), _jsx("div", { className: "flex flex-wrap gap-1 mt-1", children: item.subjects.map(subject => (_jsxs(Badge, { variant: "secondary", className: "text-xs cursor-pointer", onClick: (e) => {
                                                e.stopPropagation();
                                                onSubjectClick?.(subject.name);
                                            }, children: ["#", subject.name, subject.confidence && (_jsxs("span", { className: "ml-1 opacity-60", children: [Math.round(subject.confidence * 100), "%"] }))] }, subject.name))) })] }), _jsx(Button, { variant: "ghost", size: "icon", onClick: (e) => {
                                    e.stopPropagation();
                                    setShowAddSubject(item.attachment.hash);
                                }, children: _jsx(Tag, { className: "h-4 w-4" }) })] }, item.attachment.hash))) })) })] }));
};
