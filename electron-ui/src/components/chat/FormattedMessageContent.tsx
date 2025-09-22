/**
 * FormattedMessageContent
 *
 * Renders message content with proper formatting:
 * - Markdown to HTML conversion
 * - Code syntax highlighting
 * - Link detection
 * - ONE.core datatype preservation
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

export interface MessageMarkup {
  format: 'plain' | 'markdown' | 'html' | 'onecore';
  content: string;
  metadata?: {
    subjects?: string[];
    keywords?: string[];
    context?: string;
    timestamp?: string;
    sender?: string;
    trustLevel?: number;
  };
}

interface FormattedMessageContentProps {
  text: string;
  format?: 'plain' | 'markdown' | 'html' | 'onecore';
  metadata?: MessageMarkup['metadata'];
  onHashtagClick?: (hashtag: string) => void;
  theme?: 'light' | 'dark';
}

// Custom components for ReactMarkdown
const MarkdownComponents = {
  code({ className, children, ...props }) {
    // Check if this is inline code by looking for the presence of a pre parent
    // In react-markdown v10+, inline is determined by context, not a prop
    const match = /language-(\w+)/.exec(className || '');
    const isInline = !match; // If there's no language class, it's inline
    const lang = match ? match[1] : '';
    const codeString = String(children).replace(/\n$/, '');

    if (!isInline && lang) {
      try {
        const highlighted = hljs.highlight(codeString, { language: lang }).value;
        return (
          <div className="code-block">
            <div className="code-header">
              <span className="code-language">{lang}</span>
              <button
                className="copy-code"
                onClick={() => navigator.clipboard.writeText(codeString)}
              >
                Copy
              </button>
            </div>
            <pre>
              <code
                className={`hljs language-${lang}`}
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            </pre>
          </div>
        );
      } catch (e) {
        // Fallback if highlighting fails
        console.warn(`Failed to highlight code as ${lang}:`, e);
        // Return unhighlighted code block
        return (
          <div className="code-block">
            <pre>
              <code className={className || ''}>
                {codeString}
              </code>
            </pre>
          </div>
        );
      }
    }

    // Inline code or code without language specification
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  a({ href, children, ...props }) {
    if (href?.startsWith('sha256:')) {
      return (
        <a
          href={href}
          className="onecore-ref"
          data-hash={href.substring(7)}
          title="ONE.core reference"
          {...props}
        >
          {children}
        </a>
      );
    }
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
  // Add support for strikethrough, tables, and other GFM features
  pre({ children, ...props }) {
    return <pre {...props}>{children}</pre>;
  },
  table({ children, ...props }) {
    return <table className="markdown-table" {...props}>{children}</table>;
  },
  strong({ children, ...props }) {
    return <strong {...props}>{children}</strong>;
  },
  em({ children, ...props }) {
    return <em {...props}>{children}</em>;
  }
};

export const FormattedMessageContent: React.FC<FormattedMessageContentProps> = ({
  text,
  format = 'markdown',
  metadata,
  onHashtagClick,
  theme = 'dark'
}) => {

  // Render content based on format
  const renderContent = () => {
    // Handle empty or undefined text
    if (!text) {
      return <div className="empty-message"></div>;
    }

    switch (format) {
      case 'plain':
        // Plain text with hashtag detection
        return (
          <div
            dangerouslySetInnerHTML={{
              __html: text.replace(/(#[\w-]+)/g, '<span class="inline-hashtag">$1</span>')
            }}
          />
        );

      case 'markdown':
        // Use ReactMarkdown with proper components
        try {
          return (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={MarkdownComponents}
              className="markdown-content"
            >
              {text || ''}
            </ReactMarkdown>
          );
        } catch (error) {
          console.error('[FormattedMessageContent] Error rendering markdown:', error);
          // Fallback to plain text if markdown parsing fails
          return <div className="whitespace-pre-wrap">{text}</div>;
        }

      case 'html':
        // Direct HTML (sanitized)
        return (
          <div
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(text)
            }}
          />
        );

      case 'onecore':
        // Parse ONE.core markup format
        return (
          <div
            dangerouslySetInnerHTML={{
              __html: parseOneCoreMarkup(text, metadata)
            }}
          />
        );

      default:
        return <div>{text}</div>;
    }
  };

  // Handle clicks on formatted content
  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;

    // Handle hashtag clicks
    if (target.classList.contains('inline-hashtag')) {
      const hashtag = target.textContent?.slice(1);
      if (hashtag && onHashtagClick) {
        onHashtagClick(hashtag);
      }
    }

    // Handle code copy button clicks
    if (target.classList.contains('copy-code')) {
      const code = decodeURIComponent(target.dataset.code || '');
      navigator.clipboard.writeText(code);
      target.textContent = 'Copied!';
      setTimeout(() => {
        target.textContent = 'Copy';
      }, 2000);
    }

    // Handle ONE.core reference clicks
    if (target.classList.contains('onecore-ref')) {
      const hash = target.dataset.hash;
      if (hash) {
        console.log('ONE.core reference clicked:', hash);
        // Could emit an event to load the referenced content
      }
    }
  };

  return (
    <div
      className={`formatted-message-content ${theme}`}
      onClick={handleContentClick}
    >
      {renderContent()}
    </div>
  );
};

// Parse ONE.core markup with context preservation
function parseOneCoreMarkup(text: string, metadata?: MessageMarkup['metadata']): string {
  let result = text;

  // Parse ONE.core type annotations
  result = result.replace(/\$type\$:(\w+)/g, '<span class="onecore-type">$1</span>');

  // Parse SHA256 references
  result = result.replace(/\[sha256:([a-f0-9]{64})\]/g,
    '<a href="sha256:$1" class="onecore-ref" data-hash="$1">📎 Reference</a>');

  // Parse subject tags
  result = result.replace(/\[\[subject:([^\]]+)\]\]/g,
    '<span class="subject-tag" data-subject="$1">#$1</span>');

  // Add metadata as data attributes if provided
  if (metadata) {
    const metaString = Object.entries(metadata)
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          return `data-${key}="${value.join(',')}"`;
        }
        return `data-${key}="${value}"`;
      })
      .join(' ');

    result = `<div class="onecore-message" ${metaString}>${result}</div>`;
  }

  return result;
}

// Export format for messages with ONE.core markup
export function exportMessageWithMarkup(
  text: string,
  metadata: MessageMarkup['metadata']
): string {
  const exportData = {
    $type$: 'FormattedMessage',
    content: text,
    format: 'markdown',
    timestamp: metadata?.timestamp || new Date().toISOString(),
    sender: metadata?.sender,
    trustLevel: metadata?.trustLevel,
    subjects: metadata?.subjects || [],
    keywords: metadata?.keywords || [],
    context: metadata?.context
  };

  return JSON.stringify(exportData, null, 2);
}

// Import message from ONE.core format
export function importMessageFromMarkup(markup: string): MessageMarkup {
  try {
    const data = JSON.parse(markup);
    return {
      format: data.format || 'markdown',
      content: data.content,
      metadata: {
        subjects: data.subjects,
        keywords: data.keywords,
        context: data.context,
        timestamp: data.timestamp,
        sender: data.sender,
        trustLevel: data.trustLevel
      }
    };
  } catch (error) {
    // Fallback to plain text if not valid JSON
    return {
      format: 'plain',
      content: markup,
      metadata: {}
    };
  }
}