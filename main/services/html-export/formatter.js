/**
 * HTML Formatter Service
 * Adds human-readable formatting to imploded microdata
 */
/**
 * Create a complete HTML5 document
 * @param {string} content - Body content
 * @param {string} title - Document title
 * @param {Object} options - Formatting options
 * @returns {string} - Complete HTML document
 */
export function createHTMLDocument(content, title, options = {}) {
    const { theme = 'light' } = options;
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${addContentSecurityPolicy()}
  <title>${escapeHTML(title)}</title>
  ${addStyles(theme)}
</head>
<body>
  ${content}
</body>
</html>`;
}
/**
 * Add inline CSS styles for the specified theme
 * @param {string} theme - Theme name (light, dark, auto)
 * @returns {string} - Style tag with CSS
 */
export function addStyles(theme) {
    const baseStyles = `
    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }

    .conversation-header {
      border-bottom: 2px solid #eee;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }

    .conversation-title {
      font-size: 2em;
      margin: 0 0 10px 0;
      font-weight: 600;
    }

    .conversation-meta {
      color: #666;
      font-size: 0.9em;
    }

    .participants {
      margin-top: 15px;
    }

    .participant {
      display: inline-block;
      margin-right: 15px;
      padding: 5px 10px;
      background: #f5f5f5;
      border-radius: 15px;
      font-size: 0.85em;
    }

    .message {
      margin-bottom: 20px;
      padding: 15px;
      border-radius: 10px;
      position: relative;
    }

    .message-bubble {
      background: #fff;
      border: 1px solid #ddd;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }

    .message-own {
      background: #007bff;
      color: white;
      margin-left: 50px;
    }

    .message-other {
      background: #f8f9fa;
      margin-right: 50px;
    }

    .message-author {
      font-weight: 600;
      margin-bottom: 5px;
      font-size: 0.9em;
    }

    .message-content {
      margin: 10px 0;
      word-wrap: break-word;
    }

    .message-timestamp {
      font-size: 0.75em;
      opacity: 0.7;
      margin-top: 8px;
    }

    .message-hash {
      font-family: monospace;
      font-size: 0.7em;
      opacity: 0.5;
      margin-top: 5px;
      word-break: break-all;
    }

    code {
      background: rgba(0,0,0,0.1);
      padding: 2px 4px;
      border-radius: 3px;
      font-family: 'Monaco', 'Consolas', monospace;
    }

    pre {
      background: rgba(0,0,0,0.05);
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      border-left: 4px solid #007bff;
    }

    a {
      color: #007bff;
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    strong {
      font-weight: 600;
    }

    em {
      font-style: italic;
    }
  `;
    const themeStyles = theme === 'dark' ? `
    body {
      background-color: #1a1a1a;
      color: #e0e0e0;
    }

    .conversation-header {
      border-bottom-color: #333;
    }

    .conversation-meta {
      color: #999;
    }

    .participant {
      background: #333;
      color: #fff;
    }

    .message-bubble {
      background: #2d2d2d;
      border-color: #444;
      color: #e0e0e0;
    }

    .message-other {
      background: #252525;
    }

    code {
      background: rgba(255,255,255,0.1);
    }

    pre {
      background: rgba(255,255,255,0.05);
    }
  ` : '';
    return `<style>${baseStyles}${themeStyles}</style>`;
}
/**
 * Format a message with proper styling and structure
 * @param {string} microdata - Message microdata
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted message HTML
 */
export function formatMessage(microdata, options = {}) {
    const { isOwn = false } = options;
    // Wrap message in styled container
    const messageClass = `message message-bubble ${isOwn ? 'message-own' : 'message-other'}`;
    // Format timestamp if present
    const timestampFormatted = formatTimestamps(microdata);
    // Add hash display
    const withHashDisplay = addHashDisplay(timestampFormatted);
    return `<div class="${messageClass}">${withHashDisplay}</div>`;
}
/**
 * Create conversation header with metadata
 * @param {Object} metadata - Conversation metadata
 * @returns {string} - HTML header
 */
export function createHeader(metadata) {
    const { title = 'Conversation Export', topicId, messageCount = 0, participants = [], dateRange, exportDate = new Date().toISOString() } = metadata;
    const participantsList = participants.map((p) => `<span class="participant" itemscope itemtype="//refin.io/Person">
      <span itemprop="name">${escapeHTML(p.name)}</span>
      ${p.email ? `<span itemprop="email" style="display:none;">${escapeHTML(p.email)}</span>` : ''}
    </span>`).join('');
    const dateRangeText = dateRange ?
        `${formatDate(dateRange.start)} to ${formatDate(dateRange.end)}` :
        'All time';
    return `
    <header class="conversation-header" itemscope itemtype="//refin.io/ConversationExport">
      <h1 class="conversation-title" itemprop="title">${escapeHTML(title)}</h1>
      <div class="conversation-meta">
        <meta itemprop="topicId" content="${escapeHTML(topicId)}">
        <meta itemprop="messageCount" content="${messageCount}">
        <meta itemprop="exportDate" content="${exportDate}">
        <p><strong>Messages:</strong> ${messageCount}</p>
        <p><strong>Period:</strong> <time itemprop="dateRange">${dateRangeText}</time></p>
        <p><strong>Exported:</strong> ${formatDate(exportDate)}</p>
      </div>
      ${participants.length > 0 ? `
        <div class="participants" itemprop="participants">
          <strong>Participants:</strong><br>
          ${participantsList}
        </div>
      ` : ''}
    </header>
  `;
}
/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export function escapeHTML(text) {
    if (typeof text !== 'string') {
        return '';
    }
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
/**
 * Add Content Security Policy meta tag
 * @returns {string} - CSP meta tag
 */
export function addContentSecurityPolicy() {
    return `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; img-src data: 'self'; script-src 'none';">`;
}
/**
 * Format timestamps in microdata to human-readable format
 * @param {string} microdata - HTML with time elements
 * @returns {string} - Microdata with formatted timestamps
 */
function formatTimestamps(microdata) {
    return microdata.replace(/<time([^>]*itemprop="timestamp"[^>]*)>([^<]+)<\/time>/g, (match, attributes, isoDate) => {
        const humanDate = formatDate(isoDate);
        return `<time${attributes}><span class="message-timestamp">${humanDate}</span></time>`;
    });
}
/**
 * Add hash display to message
 * @param {string} microdata - Message microdata
 * @returns {string} - Microdata with hash display
 */
function addHashDisplay(microdata) {
    // Extract hash from data-hash attribute
    const hashMatch = String(microdata).match(/data-hash="([^"]+)"/);
    if (hashMatch) {
        const hash = hashMatch[1];
        const shortHash = String(hash).substring(0, 8) + '...';
        // Add hash display at the end
        const hashDisplay = `<div class="message-hash" title="Message Hash: ${hash}">Hash: ${shortHash}</div>`;
        // Insert before the closing div
        return microdata.replace(/<\/div>$/, hashDisplay + '</div>');
    }
    return microdata;
}
/**
 * Format date to human-readable string
 * @param {string} isoDate - ISO date string
 * @returns {string} - Formatted date
 */
function formatDate(isoDate) {
    try {
        const date = new Date(isoDate);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    catch (error) {
        return isoDate;
    }
}
export default {
    createHTMLDocument,
    addStyles,
    formatMessage,
    createHeader,
    escapeHTML,
    addContentSecurityPolicy
};
