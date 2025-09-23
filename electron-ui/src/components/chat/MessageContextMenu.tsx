/**
 * MessageContextMenu
 *
 * Context menu for message actions including export in various formats
 */

import React, { useState, useEffect, useRef } from 'react';
import { EnhancedMessageData } from './EnhancedMessageBubble';
import { exportMessageWithMarkup } from './FormattedMessageContent';
import './MessageContextMenu.css';

export interface MessageContextMenuProps {
  message: EnhancedMessageData;
  x: number;
  y: number;
  onClose: () => void;
  onReply?: (message: EnhancedMessageData) => void;
  onEdit?: (message: EnhancedMessageData) => void;
  onDelete?: (messageId: string, reason?: string) => void;
  onCopy?: (text: string) => void;
  onShowHistory?: (messageId: string) => void;
}

export const MessageContextMenu: React.FC<MessageContextMenuProps> = ({
  message,
  x,
  y,
  onClose,
  onReply,
  onEdit,
  onDelete,
  onCopy,
  onShowHistory
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [exportSubMenu, setExportSubMenu] = useState(false);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Export functions
  const exportAsMarkdown = async () => {
    console.log('[MessageContextMenu] exportAsMarkdown called');
    const markdown = generateMarkdownExport(message);
    console.log('[MessageContextMenu] Generated markdown:', markdown);

    // Use IPC for file export
    const result = await window.electronAPI.invoke('export:message', {
      format: 'markdown',
      content: markdown,
      metadata: { messageId: message.id }
    });

    if (result.success) {
      console.log('[MessageContextMenu] File exported successfully:', result.filePath);
    } else if (result.canceled) {
      console.log('[MessageContextMenu] Export canceled by user');
    } else {
      console.error('[MessageContextMenu] Export failed:', result.error);
    }

    onClose();
  };

  const exportAsHTML = async () => {
    const html = generateHTMLExport(message);

    const result = await window.electronAPI.invoke('export:message', {
      format: 'html',
      content: html,
      metadata: { messageId: message.id }
    });

    if (result.success) {
      console.log('[MessageContextMenu] HTML exported successfully');
    } else if (!result.canceled) {
      console.error('[MessageContextMenu] HTML export failed:', result.error);
    }

    onClose();
  };

  const exportAsJSON = async () => {
    const json = exportMessageWithMarkup(message.text, {
      subjects: message.subjects,
      keywords: extractKeywords(message.text),
      context: message.topicName,
      timestamp: message.timestamp.toISOString(),
      sender: message.senderName,
      trustLevel: message.trustLevel
    });

    const result = await window.electronAPI.invoke('export:message', {
      format: 'json',
      content: json,
      metadata: { messageId: message.id }
    });

    if (result.success) {
      console.log('[MessageContextMenu] JSON exported successfully');
    } else if (!result.canceled) {
      console.error('[MessageContextMenu] JSON export failed:', result.error);
    }

    onClose();
  };

  const exportAsOneCoreMarkup = async () => {
    const markup = generateOneCoreMarkup(message);

    const result = await window.electronAPI.invoke('export:message', {
      format: 'onecore',
      content: markup,
      metadata: { messageId: message.id }
    });

    if (result.success) {
      console.log('[MessageContextMenu] ONE.core markup exported successfully');
    } else if (!result.canceled) {
      console.error('[MessageContextMenu] ONE.core export failed:', result.error);
    }

    onClose();
  };

  const exportAsVerifiableCredential = async () => {
    try {
      const result = await window.electronAPI.invoke('chat:exportMessageCredential', {
        messageId: message.id
      });

      if (result.success && result.data) {
        const json = JSON.stringify(result.data, null, 2);
        downloadFile(json, `message-${message.id}-credential.json`, 'application/json');
      } else {
        console.error('Failed to export credential:', result.error);
        alert('Failed to export verifiable credential: ' + result.error);
      }
    } catch (error) {
      console.error('Error exporting credential:', error);
      alert('Error exporting verifiable credential');
    }
    onClose();
  };

  const copyToClipboard = (format: 'plain' | 'markdown' | 'html') => {
    let content = '';
    switch (format) {
      case 'plain':
        content = message.text;
        break;
      case 'markdown':
        content = generateMarkdownExport(message);
        break;
      case 'html':
        content = generateHTMLExport(message);
        break;
    }

    navigator.clipboard.writeText(content).then(() => {
      onCopy?.(content);
      onClose();
    });
  };

  return (
    <div
      ref={menuRef}
      className="message-context-menu"
      style={{ left: x, top: y }}
    >
      <ul className="context-menu-list">
        {/* Copy options */}
        <li onClick={() => copyToClipboard('plain')}>
          <span className="menu-icon">📋</span>
          Copy Text
        </li>

        {onReply && (
          <li onClick={() => { onReply(message); onClose(); }}>
            <span className="menu-icon">↩️</span>
            Reply
          </li>
        )}

        {onEdit && message.isOwn && (
          <li onClick={() => { onEdit(message); onClose(); }}>
            <span className="menu-icon">✏️</span>
            Edit
          </li>
        )}

        <li className="menu-separator" />

        {/* Export submenu */}
        <li
          className="has-submenu"
          onMouseEnter={() => {
            console.log('[MessageContextMenu] Mouse entered Export Message');
            setExportSubMenu(true);
          }}
          onMouseLeave={(e) => {
            // Check if we're moving to a child element (the submenu)
            const relatedTarget = e.relatedTarget as HTMLElement;
            if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
              setExportSubMenu(false);
            }
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('[MessageContextMenu] Export Message parent clicked');
            setExportSubMenu(!exportSubMenu); // Toggle on click as well
          }}
        >
          <span className="menu-icon">💾</span>
          Export Message
          <span className="submenu-arrow">▶</span>

          {exportSubMenu && (
            <ul className="context-submenu" onClick={(e) => {
              console.log('[MessageContextMenu] Submenu UL clicked');
              e.stopPropagation();
            }}>
              <li onClick={(e) => {
                e.stopPropagation();
                console.log('[MessageContextMenu] Markdown export clicked!');
                exportAsMarkdown().catch(err => console.error('[MessageContextMenu] Export error:', err));
              }}>
                <span className="menu-icon">📝</span>
                Markdown (.md)
              </li>
              <li onClick={(e) => { e.stopPropagation(); exportAsHTML(); }}>
                <span className="menu-icon">🌐</span>
                HTML with Markup
              </li>
              <li onClick={(e) => { e.stopPropagation(); exportAsJSON(); }}>
                <span className="menu-icon">📄</span>
                JSON with Metadata
              </li>
              <li onClick={(e) => { e.stopPropagation(); exportAsOneCoreMarkup(); }}>
                <span className="menu-icon">🔗</span>
                ONE.core Format
              </li>
              <li onClick={(e) => { e.stopPropagation(); exportAsVerifiableCredential(); }}>
                <span className="menu-icon">🔐</span>
                Verifiable Credential
              </li>
              <li className="menu-separator" />
              <li onClick={() => copyToClipboard('markdown')}>
                <span className="menu-icon">📋</span>
                Copy as Markdown
              </li>
              <li onClick={() => copyToClipboard('html')}>
                <span className="menu-icon">📋</span>
                Copy as HTML
              </li>
            </ul>
          )}
        </li>

        {/* Version history option */}
        {message.version && message.version > 1 && (
          <li onClick={() => { onShowHistory?.(message.id); onClose(); }}>
            <span className="menu-icon">📜</span>
            View Edit History ({message.version} versions)
          </li>
        )}

        {onDelete && message.isOwn && !message.isRetracted && (
          <>
            <li className="menu-separator" />
            <li className="menu-danger" onClick={() => {
              const reason = window.prompt('Reason for deletion (optional):')
              onDelete(message.id, reason || undefined)
              onClose()
            }}>
              <span className="menu-icon">🗑️</span>
              Retract Message
            </li>
          </>
        )}
      </ul>
    </div>
  );
};

// Generate pure markdown export
function generateMarkdownExport(message: EnhancedMessageData): string {
  const header = `# Message from ${message.senderName}
**Date:** ${message.timestamp.toLocaleString()}
**Topic:** ${message.topicName || 'Direct Message'}
${message.subjects.length > 0 ? `**Subjects:** ${message.subjects.map(s => `#${s}`).join(' ')}\n` : ''}
---

`;

  const content = message.text;

  const footer = message.attachments && message.attachments.length > 0
    ? `\n\n## Attachments\n${message.attachments.map(a => `- ${a.name} (${a.type})`).join('\n')}`
    : '';

  return header + content + footer;
}

// Generate HTML with structured markup
function generateHTMLExport(message: EnhancedMessageData): string {
  const subjects = message.subjects.map(s =>
    `<meta name="subject" content="${s}">`
  ).join('\n    ');

  const keywords = extractKeywords(message.text).map(k =>
    `<meta name="keyword" content="${k}">`
  ).join('\n    ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Message from ${message.senderName}</title>

    <!-- Structured Data -->
    <meta name="author" content="${message.senderName}">
    <meta name="date" content="${message.timestamp.toISOString()}">
    <meta name="trust-level" content="${message.trustLevel}">
    <meta name="topic" content="${message.topicName || 'Direct Message'}">
    ${subjects}
    ${keywords}

    <!-- Schema.org structured data -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "Message",
      "author": {
        "@type": "Person",
        "name": "${message.senderName}",
        "identifier": "${message.senderId}"
      },
      "dateCreated": "${message.timestamp.toISOString()}",
      "text": ${JSON.stringify(message.text)},
      "keywords": ${JSON.stringify(message.subjects.concat(extractKeywords(message.text)))},
      "inLanguage": "en"
    }
    </script>

    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 800px;
        margin: 40px auto;
        padding: 20px;
        line-height: 1.6;
        color: #333;
      }
      .message-header {
        border-bottom: 2px solid #e0e0e0;
        padding-bottom: 20px;
        margin-bottom: 20px;
      }
      .message-meta {
        color: #666;
        font-size: 14px;
      }
      .message-content {
        margin: 20px 0;
      }
      .subjects {
        margin-top: 10px;
      }
      .subject-tag {
        display: inline-block;
        padding: 4px 12px;
        margin: 4px;
        background: #e3f2fd;
        border: 1px solid #90caf9;
        border-radius: 16px;
        color: #1976d2;
        font-size: 13px;
      }
      code {
        background: #f5f5f5;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Monaco', 'Courier New', monospace;
      }
      pre {
        background: #f5f5f5;
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
      }
      blockquote {
        border-left: 4px solid #2196f3;
        padding-left: 16px;
        margin-left: 0;
        color: #555;
      }
    </style>
</head>
<body>
    <article class="message">
        <header class="message-header">
            <h1>Message from ${message.senderName}</h1>
            <div class="message-meta">
                <p><strong>Date:</strong> <time datetime="${message.timestamp.toISOString()}">${message.timestamp.toLocaleString()}</time></p>
                <p><strong>Topic:</strong> ${message.topicName || 'Direct Message'}</p>
                <p><strong>Trust Level:</strong> ${getTrustLevelLabel(message.trustLevel)}</p>
            </div>
            ${message.subjects.length > 0 ? `
            <div class="subjects">
                ${message.subjects.map(s => `<span class="subject-tag">#${s}</span>`).join('')}
            </div>
            ` : ''}
        </header>

        <main class="message-content">
            ${convertMarkdownToHTML(message.text)}
        </main>

        ${message.attachments && message.attachments.length > 0 ? `
        <footer class="message-attachments">
            <h2>Attachments</h2>
            <ul>
                ${message.attachments.map(a => `
                <li data-attachment-id="${a.id}" data-type="${a.type}">
                    ${a.name} (${a.type})
                </li>
                `).join('')}
            </ul>
        </footer>
        ` : ''}
    </article>
</body>
</html>`;
}

// Generate ONE.core markup format
function generateOneCoreMarkup(message: EnhancedMessageData): string {
  return `$type$:Message
$id$:${message.id}
$sender$:${message.senderId}
$senderName$:${message.senderName}
$timestamp$:${message.timestamp.toISOString()}
$trustLevel$:${message.trustLevel}
$topic$:${message.topicName || 'direct'}

[[subjects]]
${message.subjects.map(s => `[[subject:${s}]]`).join('\n')}

[[keywords]]
${extractKeywords(message.text).map(k => `[[keyword:${k}]]`).join('\n')}

[[content]]
${message.text}

${message.attachments && message.attachments.length > 0 ? `
[[attachments]]
${message.attachments.map(a => `
[attachment:${a.id}]
  name: ${a.name}
  type: ${a.type}
  size: ${a.size}
  subjects: ${a.subjects.join(', ')}
`).join('\n')}
` : ''}
`;
}

// Helper functions
function extractKeywords(text: string): string[] {
  // Simple keyword extraction - could be enhanced with NLP
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 4);

  const frequency: { [key: string]: number } = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function getTrustLevelLabel(level: number): string {
  switch (level) {
    case 1: return 'Acquaintance';
    case 2: return 'Contact';
    case 3: return 'Colleague';
    case 4: return 'Friend';
    case 5: return 'Close Friend';
    default: return 'Unknown';
  }
}

function convertMarkdownToHTML(markdown: string): string {
  // Simple markdown to HTML conversion
  // In production, use the marked library
  return markdown
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/```(.+?)```/gs, '<pre><code>$1</code></pre>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>');
}

// Download function removed - now using IPC for file exports