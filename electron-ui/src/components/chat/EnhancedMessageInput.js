import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * EnhancedMessageInput
 *
 * Web-compatible enhanced message input component for LAMA desktop.
 * Converts React Native EnhancedInputToolbar to standard React for Electron.
 *
 * Features:
 * - Subject hashtag suggestions and detection
 * - Media upload with drag & drop support
 * - Trust-aware attachment handling
 * - HTML5 File API integration
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import './EnhancedMessageInput.css';
// Subject hashtag extractor (simplified web version)
class WebSubjectExtractor {
    extractHashtagsFromText(text) {
        const hashtagRegex = /#[\w-]+/g;
        const matches = text.match(hashtagRegex) || [];
        return matches.map(tag => tag.toLowerCase());
    }
    extractSubjectsFromFile(file) {
        const subjects = [];
        const filename = file.name.toLowerCase();
        // File type subjects
        if (file.type.startsWith('image/'))
            subjects.push('photo', 'image');
        if (file.type.startsWith('video/'))
            subjects.push('video', 'media');
        if (file.type.startsWith('audio/'))
            subjects.push('audio', 'sound');
        if (file.type.includes('pdf'))
            subjects.push('document', 'pdf');
        // Filename subjects
        if (filename.includes('screenshot'))
            subjects.push('screenshot', 'work');
        if (filename.includes('photo'))
            subjects.push('photography');
        if (filename.includes('video'))
            subjects.push('recording');
        if (filename.includes('work') || filename.includes('meeting'))
            subjects.push('work', 'business');
        if (filename.includes('personal') || filename.includes('family'))
            subjects.push('personal');
        return [...new Set(subjects)];
    }
}
// Contextual hashtag suggester (simplified web version)
class WebHashtagSuggester {
    async suggestHashtags(currentText, context) {
        const suggestions = [];
        const lowerText = currentText.toLowerCase();
        // Content-based suggestions
        const contentPatterns = [
            { words: ['photo', 'picture', 'image'], hashtags: ['#photo', '#photography', '#pic'] },
            { words: ['video', 'recording'], hashtags: ['#video', '#recording', '#media'] },
            { words: ['work', 'project', 'meeting'], hashtags: ['#work', '#project', '#business'] },
            { words: ['food', 'cooking', 'recipe'], hashtags: ['#food', '#cooking', '#recipe'] },
            { words: ['travel', 'trip', 'vacation'], hashtags: ['#travel', '#trip', '#adventure'] },
            { words: ['music', 'song'], hashtags: ['#music', '#song', '#audio'] },
            { words: ['game', 'gaming', 'fun'], hashtags: ['#gaming', '#fun', '#entertainment'] },
            { words: ['nature', 'outdoor'], hashtags: ['#nature', '#outdoor', '#landscape'] },
            { words: ['tech', 'coding', 'software'], hashtags: ['#tech', '#coding', '#programming'] }
        ];
        for (const pattern of contentPatterns) {
            const matchingWords = pattern.words.filter(word => lowerText.includes(word));
            if (matchingWords.length > 0) {
                for (const hashtag of pattern.hashtags) {
                    suggestions.push({
                        hashtag,
                        confidence: Math.min(0.8, matchingWords.length * 0.3),
                        source: 'content-analysis',
                        description: `Detected from: "${matchingWords.join(', ')}"`
                    });
                }
            }
        }
        // Time-based suggestions
        const now = new Date();
        const hour = now.getHours();
        if (hour >= 6 && hour <= 10) {
            suggestions.push({
                hashtag: '#morning',
                confidence: 0.6,
                source: 'trending',
                description: 'Current time of day'
            });
        }
        else if (hour >= 17 && hour <= 20) {
            suggestions.push({
                hashtag: '#evening',
                confidence: 0.6,
                source: 'trending',
                description: 'Current time of day'
            });
        }
        // File type suggestions
        if (context.fileType) {
            if (context.fileType.startsWith('image/')) {
                suggestions.push({
                    hashtag: '#photo',
                    confidence: 0.8,
                    source: 'content-analysis',
                    description: 'Image file detected'
                });
            }
        }
        return suggestions.slice(0, 6); // Top 6 suggestions
    }
}
// Attachment preview component
const AttachmentPreview = ({ attachment, onRemove, onEditSubjects }) => {
    const getFileIcon = (type) => {
        switch (type) {
            case 'image': return '🖼️';
            case 'video': return '🎥';
            case 'audio': return '🎵';
            case 'document': return '📄';
            default: return '📎';
        }
    };
    return (_jsxs("div", { className: "attachment-preview", children: [_jsxs("div", { className: "attachment-thumbnail", children: [attachment.thumbnail ? (_jsx("img", { src: attachment.thumbnail, alt: attachment.file.name })) : (_jsx("div", { className: "attachment-icon", children: getFileIcon(attachment.type) })), attachment.processing && (_jsx("div", { className: "processing-overlay", children: _jsx("div", { className: "spinner" }) }))] }), _jsxs("div", { className: "attachment-info", children: [_jsx("div", { className: "attachment-name", children: attachment.file.name }), _jsxs("div", { className: "attachment-subjects", children: [attachment.subjects.slice(0, 3).map((subject, index) => (_jsxs("span", { className: "subject-tag", children: ["#", subject] }, index))), attachment.subjects.length > 3 && (_jsxs("span", { className: "more-subjects", children: ["+", attachment.subjects.length - 3] }))] }), _jsxs("div", { className: "attachment-trust", children: ["Trust Level: ", attachment.trustLevel] })] }), _jsxs("div", { className: "attachment-actions", children: [_jsx("button", { onClick: onEditSubjects, className: "action-button edit-button", title: "Edit subjects", children: "\u270F\uFE0F" }), _jsx("button", { onClick: onRemove, className: "action-button remove-button", title: "Remove attachment", children: "\u2715" })] })] }));
};
// Hashtag suggestions panel
const HashtagSuggestionsPanel = ({ suggestions, onSelectHashtag, visible }) => {
    if (!visible || suggestions.length === 0)
        return null;
    return (_jsxs("div", { className: "hashtag-suggestions-panel", children: [_jsx("div", { className: "suggestions-title", children: "Suggested hashtags:" }), _jsx("div", { className: "suggestions-container", children: suggestions.map((suggestion, index) => (_jsxs("button", { className: "suggestion-chip", onClick: () => onSelectHashtag(suggestion.hashtag), title: suggestion.description, children: [suggestion.hashtag, suggestion.confidence > 0.8 && _jsx("span", { className: "high-confidence", children: "\u2B50" })] }, index))) })] }));
};
// Main enhanced message input component
export const EnhancedMessageInput = ({ onSendMessage, onHashtagClick, placeholder = "Type a message...", disabled = false, theme = 'light' }) => {
    console.log('[EnhancedMessageInput] Component mounted/rendered');
    const [messageText, setMessageText] = useState('');
    const [attachments, setAttachments] = useState([]);
    // Log attachments whenever they change
    useEffect(() => {
        // Attachments state updated
    }, [attachments]);
    const [hashtagSuggestions, setHashtagSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const subjectExtractor = new WebSubjectExtractor();
    const hashtagSuggester = new WebHashtagSuggester();
    // Handle text input changes and hashtag detection
    const handleTextChange = useCallback(async (text) => {
        setMessageText(text);
        // Auto-resize textarea
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
        // Check if user is typing a hashtag
        const hashtagMatch = text.match(/#[\w-]*$/);
        if (hashtagMatch) {
            const partialHashtag = hashtagMatch[0];
            if (partialHashtag.length > 1) {
                const suggestions = await hashtagSuggester.suggestHashtags(text, {});
                // Filter suggestions based on partial input
                const filteredSuggestions = suggestions.filter(s => s.hashtag.toLowerCase().includes(partialHashtag.slice(1).toLowerCase()));
                setHashtagSuggestions(filteredSuggestions);
                setShowSuggestions(filteredSuggestions.length > 0);
            }
            else {
                setShowSuggestions(false);
            }
        }
        else {
            setShowSuggestions(false);
        }
    }, [hashtagSuggester]);
    // Select hashtag from suggestions
    const selectHashtag = useCallback((hashtag) => {
        const newText = messageText.replace(/#[\w-]*$/, hashtag + ' ');
        setMessageText(newText);
        setShowSuggestions(false);
        textareaRef.current?.focus();
    }, [messageText]);
    // Handle file selection
    const handleFileSelection = useCallback(async (files) => {
        if (!files || files.length === 0)
            return;
        setIsUploading(true);
        try {
            const newAttachments = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                // Determine attachment type
                const attachmentType = file.type.startsWith('image/') ? 'image' :
                    file.type.startsWith('video/') ? 'video' :
                        file.type.startsWith('audio/') ? 'audio' : 'document';
                // Extract subjects from filename and type
                const extractedSubjects = subjectExtractor.extractSubjectsFromFile(file);
                // Generate thumbnail for images
                let thumbnail;
                if (attachmentType === 'image') {
                    try {
                        thumbnail = await generateImageThumbnail(file);
                    }
                    catch (err) {
                        // Continue without thumbnail
                    }
                }
                const attachment = {
                    id: `${Date.now()}_${i}`,
                    file,
                    type: attachmentType,
                    thumbnail,
                    subjects: extractedSubjects,
                    trustLevel: 3, // Default colleague level
                    processing: false
                };
                newAttachments.push(attachment);
            }
            setAttachments(prev => [...prev, ...newAttachments]);
        }
        catch (error) {
            console.error('File processing failed:', error);
            alert('Failed to process selected files');
        }
        finally {
            setIsUploading(false);
        }
    }, [subjectExtractor]);
    // Generate image thumbnail
    const generateImageThumbnail = (file) => {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                // Use larger size for better quality preview
                const maxWidth = 800;
                const maxHeight = 600;
                let { width, height } = img;
                // Calculate new dimensions maintaining aspect ratio
                const scale = Math.min(maxWidth / width, maxHeight / height, 1); // Don't upscale
                const newWidth = Math.floor(width * scale);
                const newHeight = Math.floor(height * scale);
                canvas.width = newWidth;
                canvas.height = newHeight;
                ctx?.drawImage(img, 0, 0, newWidth, newHeight);
                resolve(canvas.toDataURL('image/jpeg', 0.9)); // Higher quality
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    };
    // Handle drag and drop
    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);
    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFileSelection(e.dataTransfer.files);
    }, [handleFileSelection]);
    // Remove attachment
    const removeAttachment = useCallback((attachmentId) => {
        setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    }, []);
    // Edit attachment subjects
    const editAttachmentSubjects = useCallback((attachmentId) => {
        // TODO: Show subject editing modal
        const newSubjects = prompt('Enter subjects (space-separated):');
        if (newSubjects) {
            setAttachments(prev => prev.map(a => a.id === attachmentId
                ? { ...a, subjects: newSubjects.split(' ').filter(s => s.trim()) }
                : a));
        }
    }, []);
    // Send message
    const handleSend = useCallback(async () => {
        if (!messageText.trim() && attachments.length === 0)
            return;
        try {
            setIsUploading(true);
            await onSendMessage(messageText, attachments);
            // Clear input
            setMessageText('');
            setAttachments([]);
            setShowSuggestions(false);
            // Reset textarea height
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
        catch (error) {
            console.error('Send failed:', error);
            alert('Failed to send message');
        }
        finally {
            setIsUploading(false);
        }
    }, [messageText, attachments, onSendMessage]);
    // Handle key press
    const handleKeyPress = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);
    const canSend = (messageText.trim().length > 0 || attachments.length > 0) && !isUploading;
    return (_jsxs("div", { className: `enhanced-message-input ${theme} ${isDragOver ? 'drag-over' : ''}`, children: [_jsx(HashtagSuggestionsPanel, { suggestions: hashtagSuggestions, onSelectHashtag: selectHashtag, visible: showSuggestions }), attachments.length > 0 && (_jsx("div", { style: {
                    padding: '20px',
                    background: '#1a1a1a',
                    borderBottom: '1px solid #333'
                }, children: attachments.map((attachment) => (_jsxs("div", { style: {
                        maxWidth: '600px',
                        margin: '0 auto',
                        textAlign: 'center'
                    }, children: [attachment.thumbnail && (_jsx("img", { src: attachment.thumbnail, alt: attachment.file.name, style: {
                                maxWidth: '100%',
                                maxHeight: '400px',
                                borderRadius: '8px',
                                display: 'block',
                                margin: '0 auto 15px'
                            } })), _jsxs("div", { style: {
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '15px'
                            }, children: [_jsx("div", { style: { color: '#fff', fontSize: '16px' }, children: attachment.file.name }), _jsx("button", { onClick: () => removeAttachment(attachment.id), style: {
                                        background: '#ff4444',
                                        color: 'white',
                                        border: 'none',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontSize: '14px'
                                    }, children: "Remove" })] })] }, attachment.id))) })), _jsxs("div", { className: "input-row", onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop, children: [_jsx("button", { className: "attach-button", onClick: () => fileInputRef.current?.click(), disabled: disabled || isUploading, title: "Attach file", children: "\uD83D\uDCCE" }), _jsx("input", { ref: fileInputRef, type: "file", multiple: true, style: { display: 'none' }, onChange: (e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                handleFileSelection(e.target.files);
                            }
                        }, accept: "image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" }), _jsx("textarea", { ref: textareaRef, className: "message-textarea", value: messageText, onChange: (e) => handleTextChange(e.target.value), onKeyPress: handleKeyPress, placeholder: placeholder, disabled: disabled || isUploading, rows: 1 }), _jsx("button", { className: `send-button ${canSend ? 'active' : ''}`, onClick: handleSend, disabled: !canSend, title: "Send message", children: isUploading ? '⏳' : '➤' })] }), isDragOver && (_jsx("div", { className: "drag-overlay", children: _jsx("div", { className: "drag-message", children: "Drop files here to attach" }) }))] }));
};
