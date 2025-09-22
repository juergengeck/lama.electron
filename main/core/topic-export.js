/**
 * Topic Export Service with Attestation Support
 *
 * Exports topics with structured data including attestations
 * Supports HTML with microdata, JSON, and pure microdata formats
 */

/**
 * Topic Exporter with attestation support
 */
export class TopicExporter {
  constructor(channelManager, attestationManager) {
    this.channelManager = channelManager;
    this.attestationManager = attestationManager;
  }

  /**
   * Export topic with attestations
   *
   * @param {Object} params
   * @param {string} params.topicId - Topic to export
   * @param {boolean} params.includeAttestations - Include attestations
   * @param {string} params.format - 'html', 'json', or 'microdata'
   * @returns {Promise<Object>} Export result
   */
  async exportTopicWithAttestations(params) {
    const { topicId, includeAttestations = true, format = 'html' } = params;

    if (!topicId) {
      throw new Error('Topic ID is required for export');
    }

    try {
      // Get topic data
      const topicData = await this.getTopicData(topicId);

      // Get messages from topic
      const messages = await this.getTopicMessages(topicId);

      // Get attestations if requested
      let attestations = [];
      if (includeAttestations && this.attestationManager) {
        attestations = await this.attestationManager.getAttestationsForTopic(topicId);
      }

      // Group attestations by message
      const attestationsByMessage = this.groupAttestationsByMessage(attestations);

      // Format based on requested type
      let exportData;
      switch (format) {
        case 'json':
          exportData = this.exportAsJSON(topicData, messages, attestationsByMessage);
          break;
        case 'microdata':
          exportData = this.exportAsMicrodata(topicData, messages, attestationsByMessage);
          break;
        case 'html':
        default:
          exportData = this.exportAsHTML(topicData, messages, attestationsByMessage);
          break;
      }

      return {
        format,
        data: exportData,
        metadata: {
          exportedAt: new Date().toISOString(),
          topicId,
          messageCount: messages.length,
          attestationCount: attestations.length
        }
      };
    } catch (error) {
      console.error('[TopicExporter] Error exporting topic:', error);
      throw error;
    }
  }

  /**
   * Export as JSON
   *
   * @private
   */
  exportAsJSON(topicData, messages, attestationsByMessage) {
    const exportObj = {
      $type$: 'AuditedTopic',
      topicId: topicData.id,
      topicName: topicData.name || 'Unnamed Topic',
      exportedAt: new Date().toISOString(),
      exportedBy: topicData.exportedBy || 'unknown',
      schemaVersion: '1.0.0',
      schemaUrl: 'https://one.core/schemas/audited-topic',
      messages: messages.map(msg => ({
        hash: msg.hash,
        version: msg.version || 1,
        content: msg.text || msg.content,
        timestamp: msg.timestamp,
        sender: msg.sender || msg.senderId,
        senderName: msg.senderName,
        subjects: msg.subjects || [],
        attestations: attestationsByMessage.get(msg.hash) || []
      }))
    };

    return JSON.stringify(exportObj, null, 2);
  }

  /**
   * Export as HTML with microdata
   *
   * @private
   */
  exportAsHTML(topicData, messages, attestationsByMessage) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Audited Topic: ${this.escapeHtml(topicData.name || 'Unnamed')}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 1200px;
      margin: 40px auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .topic-header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .message {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 15px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      color: #666;
      font-size: 14px;
    }
    .message-content {
      margin: 15px 0;
      line-height: 1.6;
    }
    .attestation {
      background: #e3f2fd;
      border: 1px solid #90caf9;
      border-radius: 4px;
      padding: 10px;
      margin-top: 10px;
    }
    .attestation-header {
      font-weight: bold;
      color: #1976d2;
      margin-bottom: 5px;
    }
    .hash {
      font-family: monospace;
      font-size: 12px;
      color: #999;
    }
    .version-badge {
      display: inline-block;
      background: #e0e0e0;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div itemscope itemtype="https://one.core/Topic" class="topic-header">
    <h1 itemprop="name">${this.escapeHtml(topicData.name || 'Audited Topic')}</h1>
    <meta itemprop="id" content="${topicData.id}">
    <meta itemprop="exportedAt" content="${new Date().toISOString()}">
    <div class="export-info">
      <p>Topic ID: <span class="hash">${topicData.id}</span></p>
      <p>Exported: ${new Date().toLocaleString()}</p>
      <p>Messages: ${messages.length} | Attestations: ${this.countTotalAttestations(attestationsByMessage)}</p>
    </div>
  </div>

  ${messages.map(msg => this.renderMessage(msg, attestationsByMessage.get(msg.hash) || [])).join('\n')}
</body>
</html>`;

    return html;
  }

  /**
   * Render a single message with attestations
   *
   * @private
   */
  renderMessage(message, attestations) {
    return `
  <div itemscope itemtype="https://one.core/Message" class="message">
    <meta itemprop="hash" content="${message.hash}">
    <meta itemprop="version" content="${message.version || 1}">

    <div class="message-header">
      <span itemprop="sender">${this.escapeHtml(message.senderName || message.sender || 'Unknown')}</span>
      <span>
        <span class="version-badge">v${message.version || 1}</span>
        <time itemprop="timestamp" datetime="${message.timestamp}">
          ${new Date(message.timestamp).toLocaleString()}
        </time>
      </span>
    </div>

    <div itemprop="content" class="message-content">
      ${this.escapeHtml(message.text || message.content || '')}
    </div>

    <div class="hash">Hash: ${message.hash.substring(0, 16)}...</div>

    ${attestations.map(att => this.renderAttestation(att)).join('\n')}
  </div>`;
  }

  /**
   * Render an attestation
   *
   * @private
   */
  renderAttestation(attestation) {
    return `
    <div itemscope itemtype="https://one.core/Attestation" class="attestation">
      <meta itemprop="messageHash" content="${attestation.messageHash}">
      <meta itemprop="auditorId" content="${attestation.auditorId}">
      <meta itemprop="timestamp" content="${attestation.timestamp}">

      <div class="attestation-header">
        ✓ Attestation by <span itemprop="auditorName">${this.escapeHtml(attestation.auditorName || 'Auditor')}</span>
      </div>

      <div itemprop="claim">
        ${this.escapeHtml(attestation.attestationClaim || 'Content verified')}
      </div>

      <div style="font-size: 12px; color: #666; margin-top: 5px;">
        Type: <span itemprop="type">${attestation.attestationType}</span> |
        <time datetime="${attestation.timestamp}">
          ${new Date(attestation.timestamp).toLocaleString()}
        </time>
      </div>
    </div>`;
  }

  /**
   * Export as pure microdata
   *
   * @private
   */
  exportAsMicrodata(topicData, messages, attestationsByMessage) {
    const microdata = `<div itemscope itemtype="https://one.core/Topic">
  <meta itemprop="id" content="${topicData.id}">
  <meta itemprop="name" content="${this.escapeHtml(topicData.name || '')}">
  <meta itemprop="exportedAt" content="${new Date().toISOString()}">

  ${messages.map(msg => `
  <div itemprop="message" itemscope itemtype="https://one.core/Message">
    <meta itemprop="hash" content="${msg.hash}">
    <meta itemprop="version" content="${msg.version || 1}">
    <meta itemprop="sender" content="${msg.sender || msg.senderId}">
    <meta itemprop="timestamp" content="${msg.timestamp}">
    <div itemprop="content">${this.escapeHtml(msg.text || msg.content || '')}</div>

    ${(attestationsByMessage.get(msg.hash) || []).map(att => `
    <div itemprop="attestation" itemscope itemtype="https://one.core/Attestation">
      <meta itemprop="messageHash" content="${att.messageHash}">
      <meta itemprop="auditorId" content="${att.auditorId}">
      <meta itemprop="auditorName" content="${this.escapeHtml(att.auditorName || '')}">
      <meta itemprop="timestamp" content="${att.timestamp}">
      <meta itemprop="type" content="${att.attestationType}">
      <div itemprop="claim">${this.escapeHtml(att.attestationClaim || '')}</div>
    </div>`).join('\n')}
  </div>`).join('\n')}
</div>`;

    return microdata;
  }

  /**
   * Get topic data
   *
   * @private
   */
  async getTopicData(topicId) {
    // In a real implementation, this would fetch from TopicModel
    return {
      id: topicId,
      name: topicId, // Would be fetched from topic metadata
      exportedBy: 'current-user' // Would be current user ID
    };
  }

  /**
   * Get messages from topic
   *
   * @private
   */
  async getTopicMessages(topicId) {
    if (!this.channelManager) {
      return [];
    }

    try {
      // Get messages from channel
      const entries = await this.channelManager.getChannelEntries(topicId);

      // Filter and format messages
      const messages = entries
        .filter(entry => entry.data && entry.data.$type$ !== 'MessageAttestation')
        .map(entry => ({
          hash: entry.hash || this.generateHash(entry.data),
          version: entry.data.version || 1,
          text: entry.data.text,
          content: entry.data.content || entry.data.text,
          timestamp: entry.timestamp || entry.data.timestamp,
          sender: entry.author || entry.data.sender,
          senderName: entry.data.senderName,
          subjects: entry.data.subjects || []
        }));

      return messages;
    } catch (error) {
      console.error('[TopicExporter] Error getting messages:', error);
      return [];
    }
  }

  /**
   * Group attestations by message hash
   *
   * @private
   */
  groupAttestationsByMessage(attestations) {
    const grouped = new Map();

    for (const attestation of attestations) {
      const hash = attestation.messageHash;
      if (!grouped.has(hash)) {
        grouped.set(hash, []);
      }
      grouped.get(hash).push(attestation);
    }

    return grouped;
  }

  /**
   * Count total attestations
   *
   * @private
   */
  countTotalAttestations(attestationsByMessage) {
    let count = 0;
    for (const attestations of attestationsByMessage.values()) {
      count += attestations.length;
    }
    return count;
  }

  /**
   * Escape HTML
   *
   * @private
   */
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return (text || '').replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * Generate hash for data (simplified)
   *
   * @private
   */
  generateHash(data) {
    // In production, this would use proper SHA256 hashing
    return 'hash-' + JSON.stringify(data).substring(0, 16);
  }
}

export default TopicExporter;