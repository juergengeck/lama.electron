import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * EnhancedMessageBubble
 *
 * Enhanced message bubble component that displays Subject hashtags and trust information.
 * Web-compatible version for LAMA desktop integration.
 */
import React, { useState } from 'react';
import './EnhancedMessageBubble.css';
// Subject hashtag chip component
const SubjectHashtagChip = ({ hashtag, onClick, size = 'normal', theme = 'dark' }) => {
    return (_jsxs("button", { className: `hashtag-chip ${size} ${theme} ${onClick ? 'clickable' : ''}`, onClick: onClick, disabled: !onClick, children: ["#", hashtag] }));
};
// Trust level indicator
const TrustLevelIndicator = ({ trustLevel, compact = false, theme = 'dark' }) => {
    const getTrustInfo = (level) => {
        switch (level) {
            case 1: return { label: 'Acquaintance', color: '#9E9E9E' };
            case 2: return { label: 'Contact', color: '#2196F3' };
            case 3: return { label: 'Colleague', color: '#4CAF50' };
            case 4: return { label: 'Friend', color: '#FF9800' };
            case 5: return { label: 'Close Friend', color: '#E91E63' };
            default: return { label: 'Unknown', color: '#666' };
        }
    };
    const { label, color } = getTrustInfo(trustLevel);
    if (compact) {
        return (_jsx("div", { className: "trust-dot", style: { backgroundColor: color }, title: label }));
    }
    return (_jsxs("div", { className: "trust-indicator", style: { borderColor: color }, children: [_jsx("div", { className: "trust-dot", style: { backgroundColor: color } }), _jsx("span", { className: "trust-label", children: label })] }));
};
// Attachment view component
const AttachmentView = ({ attachment, onAttachmentClick, onDownloadAttachment, onHashtagClick, theme = 'dark', attachmentDescriptors }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [imageUrl, setImageUrl] = useState(null);
    // Create object URL from attachment descriptor
    React.useEffect(() => {
        if (attachment.type === 'image' && attachmentDescriptors) {
            const descriptor = attachmentDescriptors.get(attachment.id);
            if (descriptor && descriptor.data) {
                const blob = new Blob([descriptor.data], { type: descriptor.type });
                const url = URL.createObjectURL(blob);
                setImageUrl(url);
                // Cleanup on unmount
                return () => {
                    URL.revokeObjectURL(url);
                };
            }
        }
    }, [attachment, attachmentDescriptors]);
    const getFileIcon = (type) => {
        switch (type) {
            case 'image': return '🖼️';
            case 'video': return '🎥';
            case 'audio': return '🎵';
            case 'document': return '📄';
            default: return '📎';
        }
    };
    const formatFileSize = (bytes) => {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    const handleAttachmentClick = () => {
        if (attachment.type === 'image' || attachment.type === 'video') {
            onAttachmentClick?.(attachment.id);
        }
        else {
            onDownloadAttachment?.(attachment.id);
        }
    };
    return (_jsxs("div", { className: `attachment-view image-bubble ${theme} ${isExpanded ? 'expanded' : 'collapsed'}`, children: [(attachment.thumbnail || imageUrl) && (_jsxs("div", { className: "attachment-image-bubble", onClick: handleAttachmentClick, style: {
                    backgroundImage: `url(${imageUrl || attachment.thumbnail})`
                }, children: [(attachment.type === 'video' || attachment.type === 'audio') && (_jsx("div", { className: "play-overlay", children: _jsx("div", { className: "play-button", children: "\u25B6" }) })), _jsx("button", { className: "expand-chevron", onClick: (e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }, title: isExpanded ? "Show less" : "Show more", children: _jsx("span", { style: {
                                display: 'inline-block',
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                color: 'rgba(255,255,255,0.9)'
                            }, children: "\u2303" }) }), attachment.subjects.length > 0 && (_jsx("div", { className: "tags-overlay", children: attachment.subjects.slice(0, 3).map((subject, index) => (_jsx("span", { className: "overlay-tag", onClick: (e) => {
                                e.stopPropagation();
                                onHashtagClick?.(subject);
                            }, children: subject }, index))) })), _jsxs("div", { className: "message-status-overlay", children: [_jsx("span", { className: "message-time", children: "15m" }), _jsx("span", { className: "message-checkmarks", children: "\u2713\u2713" })] })] })), !attachment.thumbnail && (_jsx("div", { className: "attachment-icon-container", children: _jsx("div", { className: "attachment-icon", children: getFileIcon(attachment.type) }) })), isExpanded && (_jsxs("div", { className: "attachment-details", children: [_jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "detail-label", children: "Name:" }), _jsx("span", { className: "detail-value", children: attachment.name })] }), _jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "detail-label", children: "Size:" }), _jsx("span", { className: "detail-value", children: formatFileSize(attachment.size) })] }), _jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "detail-label", children: "Type:" }), _jsx("span", { className: "detail-value", children: attachment.type })] }), attachment.subjects.length > 0 && (_jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "detail-label", children: "Tags:" }), _jsx("div", { className: "attachment-subjects", children: attachment.subjects.map((subject, index) => (_jsx(SubjectHashtagChip, { hashtag: subject, onClick: () => onHashtagClick?.(subject), size: "small", theme: theme }, index))) })] })), _jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "detail-label", children: "Trust:" }), _jsx(TrustLevelIndicator, { trustLevel: attachment.trustLevel, compact: false, theme: theme })] }), _jsxs("div", { className: "detail-row", children: [_jsx("span", { className: "detail-label", children: "Actions:" }), _jsxs("div", { className: "detail-actions", children: [(attachment.type === 'image' || attachment.type === 'video') && (_jsxs("button", { className: "detail-action-button", onClick: () => onAttachmentClick?.(attachment.id), title: "View", children: [_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" }) }), "View"] })), _jsxs("button", { className: "detail-action-button", onClick: () => onDownloadAttachment?.(attachment.id), title: "Download", children: [_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "currentColor", children: _jsx("path", { d: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" }) }), "Download"] })] })] })] }))] }));
};
// Message text parser that highlights hashtags
const MessageTextWithHashtags = ({ text, onHashtagClick, theme = 'dark' }) => {
    // Split text by hashtags and render with clickable hashtag spans
    const renderTextWithHashtags = () => {
        const hashtagRegex = /(#[\w-]+)/g;
        const parts = text.split(hashtagRegex);
        return parts.map((part, index) => {
            if (part.match(hashtagRegex)) {
                return (_jsx("span", { className: `inline-hashtag ${theme} ${onHashtagClick ? 'clickable' : ''}`, onClick: () => onHashtagClick?.(part.slice(1)), children: part }, index));
            }
            return _jsx("span", { children: part }, index);
        });
    };
    return _jsx("div", { className: "message-text", children: renderTextWithHashtags() });
};
// Main enhanced message bubble component
export const EnhancedMessageBubble = ({ message, onHashtagClick, onAttachmentClick, onDownloadAttachment, theme = 'dark', attachmentDescriptors }) => {
    const [showFullTimestamp, setShowFullTimestamp] = useState(false);
    const formatTimestamp = (date, full = false) => {
        if (full) {
            return date.toLocaleString();
        }
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 1)
            return 'now';
        if (minutes < 60)
            return `${minutes}m`;
        if (hours < 24)
            return `${hours}h`;
        if (days < 7)
            return `${days}d`;
        return date.toLocaleDateString();
    };
    return (_jsxs("div", { className: `enhanced-message-bubble ${message.isOwn ? 'own' : 'other'} ${theme}`, children: [_jsxs("div", { className: "message-header", children: [_jsx("span", { className: "sender-name", children: message.senderName }), _jsx(TrustLevelIndicator, { trustLevel: message.trustLevel, compact: true, theme: theme })] }), _jsx("div", { className: "message-content", children: _jsxs("div", { className: "flex items-end gap-2", children: [_jsxs("div", { className: "flex-1", children: [message.text && !message.text.includes('📎 Attachments:') && (_jsx(MessageTextWithHashtags, { text: message.text, onHashtagClick: onHashtagClick, theme: theme })), message.attachments && message.attachments.length > 0 && (_jsx("div", { className: "message-attachments", children: message.attachments.map((attachment) => (_jsx(AttachmentView, { attachment: attachment, onAttachmentClick: onAttachmentClick, onDownloadAttachment: onDownloadAttachment, onHashtagClick: onHashtagClick, theme: theme, attachmentDescriptors: attachmentDescriptors }, attachment.id))) })), message.subjects.length > 0 && (!message.attachments || message.attachments.length === 0) && (_jsx("div", { className: "message-subjects", children: message.subjects.map((subject, index) => (_jsx(SubjectHashtagChip, { hashtag: subject, onClick: () => onHashtagClick?.(subject), theme: theme }, index))) }))] }), _jsxs("div", { className: "flex items-end gap-1 text-xs opacity-60 shrink-0", children: [_jsx("span", { className: "text-[10px]", children: message.timestamp.toLocaleTimeString('en-US', {
                                        hour: 'numeric',
                                        minute: '2-digit',
                                        hour12: true
                                    }).toLowerCase() }), message.isOwn && (_jsx("span", { className: "text-xs", children: "\u2713\u2713" }))] })] }) })] }));
};
