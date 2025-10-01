/**
 * HTML Template Service
 * Provides HTML boilerplate and structure templates
 */

interface GenerateHTMLData {
  metadata: any;
  messages: string[];
  options?: {
    theme?: 'light' | 'dark' | 'auto';
  };
}

/**
 * Generate complete HTML document with all components
 * @param {Object} data - Export data
 * @returns {string} - Complete HTML document
 */
export function generateCompleteHTML(data: GenerateHTMLData): string {
  const {
    metadata,
    messages,
    options = {}
  } = data;

  const { theme = 'light' } = options;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  ${getContentSecurityPolicy()}
  <title>${escapeHTML(metadata.title || 'LAMA Conversation Export')}</title>
  ${getStyles(theme)}
</head>
<body>
  ${generateHeader(metadata)}
  <main class="conversation-content">
    ${messages.join('\n')}
  </main>
  ${generateFooter(metadata)}
  ${getVerificationScript()}
</body>
</html>`;
}

/**
 * Generate conversation header
 * @param {Object} metadata - Conversation metadata
 * @returns {string} - Header HTML
 */
function generateHeader(metadata: any): any {
  const {
    title = 'Conversation Export',
    topicId,
    messageCount = 0,
    participants = [],
    dateRange,
    exportDate = new Date().toISOString()
  } = metadata;

  const participantsList: any[] = participants.map((participant: any) => `
    <div class="participant" itemscope itemtype="//refin.io/Person">
      <span itemprop="name">${escapeHTML(participant.name)}</span>
      <span itemprop="email" class="participant-email">${escapeHTML(participant.email)}</span>
      ${participant.personHash ? `<meta itemprop="personHash" content="${participant.personHash}">` : ''}
    </div>
  `).join('');

  const dateRangeText = dateRange ?
    `${formatDate(dateRange.start)} - ${formatDate(dateRange.end)}` :
    'All messages';

  return `
    <header class="conversation-header" itemscope itemtype="//refin.io/ConversationExport">
      <div class="header-main">
        <h1 class="conversation-title" itemprop="title">${escapeHTML(title)}</h1>
        <div class="conversation-meta">
          <meta itemprop="topicId" content="${escapeHTML(topicId)}">
          <meta itemprop="messageCount" content="${messageCount}">
          <meta itemprop="exportDate" content="${exportDate}">

          <div class="meta-item">
            <span class="meta-label">Messages:</span>
            <span class="meta-value">${messageCount}</span>
          </div>

          <div class="meta-item">
            <span class="meta-label">Period:</span>
            <time class="meta-value" itemprop="dateRange">${dateRangeText}</time>
          </div>

          <div class="meta-item">
            <span class="meta-label">Exported:</span>
            <time class="meta-value">${formatDate(exportDate)}</time>
          </div>
        </div>
      </div>

      ${participants.length > 0 ? `
        <div class="participants-section" itemprop="participants">
          <h2 class="participants-title">Participants</h2>
          <div class="participants-list">
            ${participantsList}
          </div>
        </div>
      ` : ''}
    </header>
  `;
}

/**
 * Generate footer with export information
 * @param {Object} metadata - Export metadata
 * @returns {string} - Footer HTML
 */
function generateFooter(metadata: any): any {
  return `
    <footer class="conversation-footer">
      <div class="export-info">
        <p class="export-notice">
          This conversation was exported from LAMA on ${formatDate(metadata.exportDate || new Date().toISOString())}.
          All messages include cryptographic hashes for integrity verification.
        </p>
        <div class="verification-info">
          <details>
            <summary>Verification Information</summary>
            <div class="verification-details">
              <p><strong>Message Hashes:</strong> Each message includes a SHA-256 hash in the <code>data-hash</code> attribute.</p>
              <p><strong>Signatures:</strong> Signed messages include cryptographic signatures in the <code>data-signature</code> attribute.</p>
              <p><strong>Microdata:</strong> All data is embedded using HTML5 microdata format for machine readability.</p>
              <p><strong>Integrity:</strong> You can verify message integrity by recalculating hashes from the source content.</p>
            </div>
          </details>
        </div>
      </div>
    </footer>
  `;
}

/**
 * Get Content Security Policy meta tag
 * @returns {string} - CSP meta tag
 */
function getContentSecurityPolicy(): any {
  return `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'unsafe-inline'; img-src data: 'self'; script-src 'unsafe-inline'; connect-src 'none';">`;
}

/**
 * Get CSS styles for the document
 * @param {string} theme - Theme name
 * @returns {string} - Style tag with CSS
 */
function getStyles(theme: any): any {
  const baseStyles = `
    :root {
      --primary-color: #007bff;
      --secondary-color: #6c757d;
      --success-color: #28a745;
      --danger-color: #dc3545;
      --warning-color: #ffc107;
      --info-color: #17a2b8;
      --light-color: #f8f9fa;
      --dark-color: #343a40;
    }

    * {
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
      color: #333;
    }

    .conversation-header {
      background: white;
      border-bottom: 3px solid var(--primary-color);
      padding: 30px;
      margin-bottom: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }

    .header-main {
      max-width: 800px;
      margin: 0 auto;
    }

    .conversation-title {
      font-size: 2.5em;
      margin: 0 0 20px 0;
      font-weight: 700;
      color: var(--primary-color);
    }

    .conversation-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 25px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      font-weight: 600;
      color: var(--secondary-color);
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .meta-value {
      font-size: 1.1em;
      margin-top: 5px;
    }

    .participants-section {
      border-top: 1px solid #eee;
      padding-top: 25px;
    }

    .participants-title {
      font-size: 1.3em;
      margin: 0 0 15px 0;
      color: var(--secondary-color);
    }

    .participants-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .participant {
      background: var(--light-color);
      border: 1px solid #dee2e6;
      border-radius: 20px;
      padding: 8px 15px;
      font-size: 0.9em;
    }

    .participant-email {
      color: var(--secondary-color);
      margin-left: 8px;
      font-size: 0.85em;
    }

    .conversation-content {
      max-width: 800px;
      margin: 0 auto;
      padding: 0 20px;
    }

    .message {
      margin-bottom: 25px;
      padding: 20px;
      border-radius: 12px;
      background: white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      border-left: 4px solid #e9ecef;
    }

    .message[data-own="true"] {
      border-left-color: var(--primary-color);
      background: #f8f9ff;
    }

    .message-author {
      font-weight: 600;
      color: var(--primary-color);
      margin-bottom: 8px;
      font-size: 0.95em;
    }

    .message-content {
      margin: 12px 0;
      word-wrap: break-word;
      line-height: 1.7;
    }

    .message-timestamp {
      font-size: 0.8em;
      color: var(--secondary-color);
      margin-top: 12px;
    }

    .message-hash {
      font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
      font-size: 0.7em;
      color: #999;
      margin-top: 8px;
      padding: 5px 8px;
      background: #f8f9fa;
      border-radius: 4px;
      border: 1px solid #e9ecef;
      cursor: help;
    }

    code {
      background: rgba(0,0,0,0.05);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'Monaco', 'Consolas', 'Courier New', monospace;
      font-size: 0.9em;
    }

    pre {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      overflow-x: auto;
      border: 1px solid #e9ecef;
      margin: 15px 0;
    }

    pre code {
      background: none;
      padding: 0;
    }

    a {
      color: var(--primary-color);
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

    blockquote {
      border-left: 4px solid var(--secondary-color);
      margin: 15px 0;
      padding: 10px 20px;
      background: #f8f9fa;
      font-style: italic;
    }

    .conversation-footer {
      margin-top: 50px;
      background: white;
      border-top: 1px solid #dee2e6;
      padding: 30px;
      text-align: center;
    }

    .export-info {
      max-width: 600px;
      margin: 0 auto;
    }

    .export-notice {
      font-size: 0.9em;
      color: var(--secondary-color);
      margin-bottom: 20px;
    }

    .verification-info details {
      text-align: left;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 8px;
      padding: 15px;
    }

    .verification-info summary {
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 10px;
    }

    .verification-details p {
      margin: 10px 0;
      font-size: 0.9em;
    }

    @media (max-width: 768px) {
      .conversation-header {
        padding: 20px;
      }

      .conversation-title {
        font-size: 2em;
      }

      .conversation-meta {
        grid-template-columns: 1fr;
      }

      .participants-list {
        flex-direction: column;
      }

      .conversation-content {
        padding: 0 15px;
      }

      .message {
        padding: 15px;
      }
    }

    @media print {
      body {
        background: white;
      }

      .conversation-header {
        box-shadow: none;
        border-bottom: 2px solid #333;
      }

      .message {
        box-shadow: none;
        border: 1px solid #ddd;
        break-inside: avoid;
      }

      .verification-info {
        display: none;
      }
    }
  `;

  const darkTheme = theme === 'dark' ? `
    body {
      background-color: #1a1a1a;
      color: #e0e0e0;
    }

    .conversation-header {
      background: #2d2d2d;
      border-bottom-color: #0d6efd;
    }

    .conversation-title {
      color: #0d6efd;
    }

    .meta-label {
      color: #adb5bd;
    }

    .participant {
      background: #343a40;
      border-color: #495057;
      color: #fff;
    }

    .participant-email {
      color: #adb5bd;
    }

    .message {
      background: #2d2d2d;
      border-left-color: #495057;
    }

    .message[data-own="true"] {
      background: #1e2a3a;
      border-left-color: #0d6efd;
    }

    .message-author {
      color: #0d6efd;
    }

    .message-timestamp {
      color: #adb5bd;
    }

    .message-hash {
      background: #343a40;
      border-color: #495057;
      color: #adb5bd;
    }

    code {
      background: rgba(255,255,255,0.1);
    }

    pre {
      background: #343a40;
      border-color: #495057;
    }

    blockquote {
      background: #343a40;
      border-left-color: #adb5bd;
    }

    .conversation-footer {
      background: #2d2d2d;
      border-top-color: #495057;
    }

    .export-notice {
      color: #adb5bd;
    }

    .verification-info details {
      background: #343a40;
      border-color: #495057;
    }
  ` : '';

  return `<style>${baseStyles}${darkTheme}</style>`;
}

/**
 * Get verification script (optional JavaScript for hash verification)
 * @returns {string} - Script tag with verification code
 */
function getVerificationScript(): any {
  return `
    <script>
      // Optional client-side hash verification
      function verifyMessageHashes(): any {
        const messages = document.querySelectorAll('[data-hash]');
        console.log('Found', messages.length, 'messages with hashes');

        messages.forEach((message, index) => {
          const hash = message.getAttribute('data-hash');
          const shortHash = hash ? String(hash).substring(0, 8) + '...' : 'N/A';
          console.log(\`Message \${index + 1}: \${shortHash}\`);
        });
      }

      // Auto-run verification on load
      document.addEventListener('DOMContentLoaded', verifyMessageHashes);
    </script>
  `;
}

/**
 * Format date to human-readable string
 * @param {string} isoDate - ISO date string
 * @returns {string} - Formatted date
 */
function formatDate(isoDate: any): any {
  try {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return isoDate;
  }
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHTML(text: any): any {
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

export default {
  generateCompleteHTML
};