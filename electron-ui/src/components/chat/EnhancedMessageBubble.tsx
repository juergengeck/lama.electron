/**
 * EnhancedMessageBubble
 * 
 * Enhanced message bubble component that displays Subject hashtags and trust information.
 * Web-compatible version for LAMA desktop integration.
 */

import React, { useState, useCallback } from 'react';
import './EnhancedMessageBubble.css';

// Enhanced message data
export interface EnhancedMessageData {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  isOwn: boolean;
  
  // Subject hashtags
  subjects: string[];
  
  // Attachments with Subject info
  attachments?: Array<{
    id: string;
    name: string;
    type: 'image' | 'video' | 'audio' | 'document';
    url: string;
    thumbnail?: string;
    size: number;
    subjects: string[];
    trustLevel: number;
  }>;
  
  // Trust information
  trustLevel: number;
  canDownload?: boolean;
}

export interface EnhancedMessageBubbleProps {
  message: EnhancedMessageData;
  onHashtagClick?: (hashtag: string) => void;
  onAttachmentClick?: (attachmentId: string) => void;
  onDownloadAttachment?: (attachmentId: string) => void;
  theme?: 'light' | 'dark';
}

// Subject hashtag chip component
const SubjectHashtagChip: React.FC<{
  hashtag: string;
  onClick?: () => void;
  size?: 'small' | 'normal';
  theme?: 'light' | 'dark';
}> = ({ hashtag, onClick, size = 'normal', theme = 'dark' }) => {
  
  return (
    <button
      className={`hashtag-chip ${size} ${theme} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
      disabled={!onClick}
    >
      #{hashtag}
    </button>
  );
};

// Trust level indicator
const TrustLevelIndicator: React.FC<{
  trustLevel: number;
  compact?: boolean;
  theme?: 'light' | 'dark';
}> = ({ trustLevel, compact = false, theme = 'dark' }) => {
  
  const getTrustInfo = (level: number) => {
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
    return (
      <div 
        className="trust-dot"
        style={{ backgroundColor: color }}
        title={label}
      />
    );
  }
  
  return (
    <div className="trust-indicator" style={{ borderColor: color }}>
      <div className="trust-dot" style={{ backgroundColor: color }} />
      <span className="trust-label">{label}</span>
    </div>
  );
};

// Attachment view component
const AttachmentView: React.FC<{
  attachment: EnhancedMessageData['attachments'][0];
  onAttachmentClick?: (attachmentId: string) => void;
  onDownloadAttachment?: (attachmentId: string) => void;
  onHashtagClick?: (hashtag: string) => void;
  theme?: 'light' | 'dark';
}> = ({ attachment, onAttachmentClick, onDownloadAttachment, onHashtagClick, theme = 'dark' }) => {
  
  const [isExpanded, setIsExpanded] = useState(false);
  
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      case 'document': return '📄';
      default: return '📎';
    }
  };
  
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  const handleAttachmentClick = () => {
    if (attachment.type === 'image' || attachment.type === 'video') {
      onAttachmentClick?.(attachment.id);
    } else {
      onDownloadAttachment?.(attachment.id);
    }
  };
  
  return (
    <div className={`attachment-view image-bubble ${theme} ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Image as bubble background */}
      {attachment.thumbnail && (
        <div 
          className="attachment-image-bubble" 
          onClick={handleAttachmentClick}
          style={{
            backgroundImage: `url(${attachment.thumbnail})`
          }}
        >
          {(attachment.type === 'video' || attachment.type === 'audio') && (
            <div className="play-overlay">
              <div className="play-button">▶</div>
            </div>
          )}
          
          {/* WhatsApp-style chevron in upper right corner */}
          <button 
            className="expand-chevron"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            title={isExpanded ? "Show less" : "Show more"}
          >
            <span style={{
              display: 'inline-block',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              fontSize: '16px',
              fontWeight: 'bold',
              color: 'rgba(255,255,255,0.9)'
            }}>
              ⌃
            </span>
          </button>
          
          {/* Tags overlay at bottom left */}
          {attachment.subjects.length > 0 && (
            <div className="tags-overlay">
              {attachment.subjects.slice(0, 3).map((subject, index) => (
                <span 
                  key={index}
                  className="overlay-tag"
                  onClick={(e) => {
                    e.stopPropagation();
                    onHashtagClick?.(subject);
                  }}
                >
                  {subject}
                </span>
              ))}
            </div>
          )}
          
          {/* Time and checkmarks in bottom right */}
          <div className="message-status-overlay">
            <span className="message-time">15m</span>
            <span className="message-checkmarks">✓✓</span>
          </div>
          
        </div>
      )}
      
      {/* Non-image attachments */}
      {!attachment.thumbnail && (
        <div className="attachment-icon-container">
          <div className="attachment-icon">
            {getFileIcon(attachment.type)}
          </div>
        </div>
      )}
      
      {/* Expandable details */}
      {isExpanded && (
        <div className="attachment-details">
          <div className="detail-row">
            <span className="detail-label">Name:</span>
            <span className="detail-value">{attachment.name}</span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Size:</span>
            <span className="detail-value">{formatFileSize(attachment.size)}</span>
          </div>
          
          <div className="detail-row">
            <span className="detail-label">Type:</span>
            <span className="detail-value">{attachment.type}</span>
          </div>
          
          {/* Show attachment subjects as small tags */}
          {attachment.subjects.length > 0 && (
            <div className="detail-row">
              <span className="detail-label">Tags:</span>
              <div className="attachment-subjects">
                {attachment.subjects.map((subject, index) => (
                  <SubjectHashtagChip
                    key={index}
                    hashtag={subject}
                    onClick={() => onHashtagClick?.(subject)}
                    size="small"
                    theme={theme}
                  />
                ))}
              </div>
            </div>
          )}
          
          <div className="detail-row">
            <span className="detail-label">Trust:</span>
            <TrustLevelIndicator 
              trustLevel={attachment.trustLevel} 
              compact={false}
              theme={theme}
            />
          </div>
          
          {/* Action buttons in details */}
          <div className="detail-row">
            <span className="detail-label">Actions:</span>
            <div className="detail-actions">
              {(attachment.type === 'image' || attachment.type === 'video') && (
                <button 
                  className="detail-action-button"
                  onClick={() => onAttachmentClick?.(attachment.id)}
                  title="View"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                  </svg>
                  View
                </button>
              )}
              
              <button 
                className="detail-action-button"
                onClick={() => onDownloadAttachment?.(attachment.id)}
                title="Download"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Message text parser that highlights hashtags
const MessageTextWithHashtags: React.FC<{
  text: string;
  onHashtagClick?: (hashtag: string) => void;
  theme?: 'light' | 'dark';
}> = ({ text, onHashtagClick, theme = 'dark' }) => {
  
  // Split text by hashtags and render with clickable hashtag spans
  const renderTextWithHashtags = () => {
    const hashtagRegex = /(#[\w-]+)/g;
    const parts = text.split(hashtagRegex);
    
    return parts.map((part, index) => {
      if (part.match(hashtagRegex)) {
        return (
          <span
            key={index}
            className={`inline-hashtag ${theme} ${onHashtagClick ? 'clickable' : ''}`}
            onClick={() => onHashtagClick?.(part.slice(1))}
          >
            {part}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };
  
  return <div className="message-text">{renderTextWithHashtags()}</div>;
};

// Main enhanced message bubble component
export const EnhancedMessageBubble: React.FC<EnhancedMessageBubbleProps> = ({
  message,
  onHashtagClick,
  onAttachmentClick,
  onDownloadAttachment,
  theme = 'dark'
}) => {
  
  const [showFullTimestamp, setShowFullTimestamp] = useState(false);
  
  const formatTimestamp = (date: Date, full: boolean = false) => {
    if (full) {
      return date.toLocaleString();
    }
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };
  
  return (
    <div className={`enhanced-message-bubble ${message.isOwn ? 'own' : 'other'} ${theme}`}>
      <div className="message-header">
        <span className="sender-name">{message.senderName}</span>
        <TrustLevelIndicator 
          trustLevel={message.trustLevel} 
          compact 
          theme={theme}
        />
      </div>
      
      <div className="message-content">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            {message.text && !message.text.includes('📎 Attachments:') && (
              <MessageTextWithHashtags
                text={message.text}
                onHashtagClick={onHashtagClick}
                theme={theme}
              />
            )}
            
            {message.attachments && message.attachments.length > 0 && (
              <div className="message-attachments">
                {message.attachments.map((attachment) => (
                  <AttachmentView
                    key={attachment.id}
                    attachment={attachment}
                    onAttachmentClick={onAttachmentClick}
                    onDownloadAttachment={onDownloadAttachment}
                    onHashtagClick={onHashtagClick}
                    theme={theme}
                  />
                ))}
              </div>
            )}
            
            {message.subjects.length > 0 && (!message.attachments || message.attachments.length === 0) && (
              <div className="message-subjects">
                {message.subjects.map((subject, index) => (
                  <SubjectHashtagChip
                    key={index}
                    hashtag={subject}
                    onClick={() => onHashtagClick?.(subject)}
                    theme={theme}
                  />
                ))}
              </div>
            )}
          </div>
          
          {/* Timestamp and checkmarks in bottom right of bubble */}
          <div className="flex items-end gap-1 text-xs opacity-60 shrink-0">
            <span className="text-[10px]">
              {message.timestamp.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: true 
              }).toLowerCase()}
            </span>
            {message.isOwn && (
              <span className="text-xs">✓✓</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};