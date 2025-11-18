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

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './EnhancedMessageInput.css';

// Web-compatible interfaces
export interface EnhancedAttachment {
  id: string;
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  thumbnail?: string;
  subjects: string[];           // Subject hashtags
  trustLevel: number;           // Trust level (1-5)
  processing: boolean;
}

export interface HashtagSuggestion {
  hashtag: string;
  confidence: number;
  source: 'chat-context' | 'content-analysis' | 'user-history' | 'trending';
  description?: string;
}

export interface EnhancedMessageInputProps {
  onSendMessage: (text: string, attachments?: EnhancedAttachment[]) => Promise<void>;
  onStopStreaming?: () => void;
  onHashtagClick?: (hashtag: string) => void;
  onTextChange?: (text: string) => void; // Callback for real-time input tracking
  onRetryMessage?: () => void; // Retry last failed message
  onSwitchModel?: (newModelId: string) => void; // Switch to different LLM model
  placeholder?: string;
  disabled?: boolean;
  theme?: 'light' | 'dark';
  conversationId?: string; // Used to detect conversation changes for auto-focus
  isStreaming?: boolean; // Show stop button when streaming
  initialText?: string; // Pre-fill input with text
  availableModels?: Array<{ id: string; name: string }>; // For model switching
}

// Subject hashtag extractor (simplified web version)
class WebSubjectExtractor {
  extractHashtagsFromText(text: string): string[] {
    const hashtagRegex = /#[\w-]+/g;
    const matches = text.match(hashtagRegex) || [];
    return matches.map(tag => tag.toLowerCase());
  }
  
  extractSubjectsFromFile(file: File): string[] {
    const subjects: string[] = [];
    const filename = file.name.toLowerCase();
    
    // File type subjects
    if (file.type.startsWith('image/')) subjects.push('photo', 'image');
    if (file.type.startsWith('video/')) subjects.push('video', 'media');
    if (file.type.startsWith('audio/')) subjects.push('audio', 'sound');
    if (file.type.includes('pdf')) subjects.push('document', 'pdf');
    
    // Filename subjects
    if (filename.includes('screenshot')) subjects.push('screenshot', 'work');
    if (filename.includes('photo')) subjects.push('photography');
    if (filename.includes('video')) subjects.push('recording');
    if (filename.includes('work') || filename.includes('meeting')) subjects.push('work', 'business');
    if (filename.includes('personal') || filename.includes('family')) subjects.push('personal');
    
    return [...new Set(subjects)];
  }
}

// Contextual hashtag suggester (simplified web version)
class WebHashtagSuggester {
  async suggestHashtags(
    currentText: string,
    context: { chatId?: string; fileType?: string }
  ): Promise<HashtagSuggestion[]> {
    const suggestions: HashtagSuggestion[] = [];
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
    } else if (hour >= 17 && hour <= 20) {
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
const AttachmentPreview: React.FC<{
  attachment: EnhancedAttachment;
  onRemove: () => void;
  onEditSubjects: () => void;
}> = ({ attachment, onRemove, onEditSubjects }) => {
  
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return '🖼️';
      case 'video': return '🎥';
      case 'audio': return '🎵';
      case 'document': return '📄';
      default: return '📎';
    }
  };
  
  return (
    <div className="attachment-preview">
      <div className="attachment-thumbnail">
        {attachment.thumbnail ? (
          <img src={attachment.thumbnail} alt={attachment.file.name} />
        ) : (
          <div className="attachment-icon">
            {getFileIcon(attachment.type)}
          </div>
        )}
        {attachment.processing && (
          <div className="processing-overlay">
            <div className="spinner"></div>
          </div>
        )}
      </div>
      
      <div className="attachment-info">
        <div className="attachment-name">{attachment.file.name}</div>
        
        <div className="attachment-subjects">
          {attachment.subjects.slice(0, 3).map((subject, index) => (
            <span key={index} className="subject-tag">
              #{subject}
            </span>
          ))}
          {attachment.subjects.length > 3 && (
            <span className="more-subjects">+{attachment.subjects.length - 3}</span>
          )}
        </div>
        
        <div className="attachment-trust">
          Trust Level: {attachment.trustLevel}
        </div>
      </div>
      
      <div className="attachment-actions">
        <button 
          onClick={onEditSubjects}
          className="action-button edit-button"
          title="Edit subjects"
        >
          ✏️
        </button>
        <button 
          onClick={onRemove}
          className="action-button remove-button"
          title="Remove attachment"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// Hashtag suggestions panel
const HashtagSuggestionsPanel: React.FC<{
  suggestions: HashtagSuggestion[];
  onSelectHashtag: (hashtag: string) => void;
  visible: boolean;
}> = ({ suggestions, onSelectHashtag, visible }) => {
  
  if (!visible || suggestions.length === 0) return null;
  
  return (
    <div className="hashtag-suggestions-panel">
      <div className="suggestions-title">Suggested hashtags:</div>
      <div className="suggestions-container">
        {suggestions.map((suggestion, index) => (
          <button
            key={index}
            className="suggestion-chip"
            onClick={() => onSelectHashtag(suggestion.hashtag)}
            title={suggestion.description}
          >
            {suggestion.hashtag}
            {suggestion.confidence > 0.8 && <span className="high-confidence">⭐</span>}
          </button>
        ))}
      </div>
    </div>
  );
};

// Main enhanced message input component
export const EnhancedMessageInput: React.FC<EnhancedMessageInputProps> = ({
  onSendMessage,
  onStopStreaming,
  onHashtagClick,
  onTextChange,
  onRetryMessage,
  onSwitchModel,
  placeholder = "Type a message...",
  disabled = false,
  theme = 'light',
  conversationId,
  isStreaming = false,
  initialText = '',
  availableModels = []
}) => {
  const [messageText, setMessageText] = useState('');
  const [attachments, setAttachments] = useState<EnhancedAttachment[]>([]);
  
  // Log attachments whenever they change
  useEffect(() => {
    // Attachments state updated
  }, [attachments]);
  const [hashtagSuggestions, setHashtagSuggestions] = useState<HashtagSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subjectExtractor = new WebSubjectExtractor();
  const hashtagSuggester = new WebHashtagSuggester();

  // Auto-focus input when conversation changes
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [conversationId, disabled]);

  // Handle text input changes and hashtag detection
  const handleTextChange = useCallback(async (text: string) => {
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
        const filteredSuggestions = suggestions.filter(s =>
          s.hashtag.toLowerCase().includes(partialHashtag.slice(1).toLowerCase())
        );
        
        setHashtagSuggestions(filteredSuggestions);
        setShowSuggestions(filteredSuggestions.length > 0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  }, [hashtagSuggester]);
  
  // Select hashtag from suggestions
  const selectHashtag = useCallback((hashtag: string) => {
    const newText = messageText.replace(/#[\w-]*$/, hashtag + ' ');
    setMessageText(newText);
    setShowSuggestions(false);
    textareaRef.current?.focus();
  }, [messageText]);
  
  // Handle file selection
  const handleFileSelection = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    
    try {
      const newAttachments: EnhancedAttachment[] = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Determine attachment type
        const attachmentType = file.type.startsWith('image/') ? 'image' :
                              file.type.startsWith('video/') ? 'video' :
                              file.type.startsWith('audio/') ? 'audio' : 'document';
        
        // Extract subjects from filename and type
        const extractedSubjects = subjectExtractor.extractSubjectsFromFile(file);
        
        // Generate thumbnail for images
        let thumbnail: string | undefined;
        if (attachmentType === 'image') {
          try {
            thumbnail = await generateImageThumbnail(file);
          } catch (err) {
            // Continue without thumbnail
          }
        }
        
        const attachment: EnhancedAttachment = {
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
    } catch (error) {
      console.error('File processing failed:', error);
      alert('Failed to process selected files');
    } finally {
      setIsUploading(false);
    }
  }, [subjectExtractor]);
  
  // Generate image thumbnail
  const generateImageThumbnail = (file: File): Promise<string> => {
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
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelection(e.dataTransfer.files);
  }, [handleFileSelection]);
  
  // Remove attachment
  const removeAttachment = useCallback((attachmentId: string) => {
    setAttachments(prev => prev.filter(a => a.id !== attachmentId));
  }, []);
  
  // Edit attachment subjects
  const editAttachmentSubjects = useCallback((attachmentId: string) => {
    // TODO: Show subject editing modal
    const newSubjects = prompt('Enter subjects (space-separated):');
    if (newSubjects) {
      setAttachments(prev => prev.map(a => 
        a.id === attachmentId 
          ? { ...a, subjects: newSubjects.split(' ').filter(s => s.trim()) }
          : a
      ));
    }
  }, []);
  
  // Send message
  const handleSend = useCallback(async () => {
    // Capture current state without clearing yet
    const textToSend = messageText;
    const attachmentsToSend = attachments;

    console.log('[EnhancedMessageInput] handleSend called, messageText:', textToSend, 'attachments:', attachmentsToSend.length);

    if (!textToSend.trim() && attachmentsToSend.length === 0) {
      console.log('[EnhancedMessageInput] Empty message, not sending');
      return;
    }

    try {
      console.log('[EnhancedMessageInput] Setting upload state and calling onSendMessage');
      setIsUploading(true);

      await onSendMessage(textToSend, attachmentsToSend);
      console.log('[EnhancedMessageInput] onSendMessage completed successfully');

      // Only clear after successful send
      setMessageText('');
      setAttachments([]);
      setShowSuggestions(false);

      // Reset textarea height and restore focus
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    } catch (error) {
      console.error('[EnhancedMessageInput] Send failed:', error);
      alert('Failed to send message: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUploading(false);
    }
  }, [messageText, attachments, onSendMessage])
  
  // Handle key down (onKeyPress is deprecated)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // console.log('[EnhancedMessageInput] Key pressed:', e.key, 'shift:', e.shiftKey);
    if (e.key === 'Enter' && !e.shiftKey) {
      // console.log('[EnhancedMessageInput] Enter pressed without shift, calling handleSend');
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);
  
  const canSend = (messageText.trim().length > 0 || attachments.length > 0) && !isUploading;
  
  return (
    <div className={`enhanced-message-input ${theme} ${isDragOver ? 'drag-over' : ''}`}>
      {/* Hashtag suggestions */}
      <HashtagSuggestionsPanel
        suggestions={hashtagSuggestions}
        onSelectHashtag={selectHashtag}
        visible={showSuggestions}
      />
      
      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div style={{
          padding: '20px',
          background: '#1a1a1a',
          borderBottom: '1px solid #333'
        }}>
          {attachments.map((attachment) => (
            <div key={attachment.id} style={{
              maxWidth: '600px',
              margin: '0 auto',
              textAlign: 'center'
            }}>
              {attachment.thumbnail && (
                <img 
                  src={attachment.thumbnail} 
                  alt={attachment.file.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '400px',
                    borderRadius: '8px',
                    display: 'block',
                    margin: '0 auto 15px'
                  }}
                />
              )}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '15px'
              }}>
                <div style={{ color: '#fff', fontSize: '16px' }}>
                  {attachment.file.name}
                </div>
                <button
                  onClick={() => removeAttachment(attachment.id)}
                  style={{
                    background: '#ff4444',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Input row */}
      <div 
        className="input-row"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* File upload button */}
        <button
          className="attach-button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          title="Attach file"
        >
          📎
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileSelection(e.target.files);
            }
          }}
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
        />
        
        {/* Text input */}
        <textarea
          ref={textareaRef}
          className="message-textarea"
          value={messageText}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isUploading}
          rows={1}
        />
        
        {/* Send or Stop button */}
        {isStreaming ? (
          <button
            className="send-button stop-button"
            onClick={onStopStreaming}
            title="Stop streaming"
          >
            <svg className="radar-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              {/* Outer circle */}
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>

              {/* Radar sweep shadow - fading trail */}
              <g className="radar-shadow">
                <path
                  d="M 8 8 L 8 2 A 6 6 0 0 1 14 8 Z"
                  fill="currentColor"
                  opacity="0.15"
                />
              </g>

              {/* Hour hand - rotating */}
              <g className="radar-hand">
                <line
                  x1="8"
                  y1="8"
                  x2="8"
                  y2="3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
              </g>
            </svg>
          </button>
        ) : (
          <button
            className={`send-button ${canSend ? 'active' : ''}`}
            onClick={handleSend}
            disabled={!canSend}
            title="Send message"
          >
            ➤
          </button>
        )}
      </div>
      
      {isDragOver && (
        <div className="drag-overlay">
          <div className="drag-message">Drop files here to attach</div>
        </div>
      )}
    </div>
  );
};