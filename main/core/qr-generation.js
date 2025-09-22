/**
 * QR Generation Service for Audit Flow
 *
 * Generates QR codes compatible with ONE.core contact invites
 * that reference attestations for Topics or Messages
 */

import QRCode from 'qrcode';

/**
 * QR Generator for audit attestations
 */
export class QRGenerator {
  constructor() {
    this.version = '1.0.0';
    this.baseUrl = 'one://';
  }

  /**
   * Generate QR code for message attestation
   * Compatible with ONE.core contact invite format
   *
   * @param {Object} options
   * @param {string} options.messageHash - SHA256 hash of the message
   * @param {number} options.messageVersion - Version number
   * @param {string} options.topicId - Topic containing the message
   * @param {string} options.attestationType - 'message' or 'topic'
   * @returns {Promise<Object>} QR data URL and text
   */
  async generateQRForMessage(options) {
    const { messageHash, messageVersion, topicId, attestationType = 'message' } = options;

    if (!messageHash) {
      throw new Error('Message hash is required for QR generation');
    }

    // Create ONE.core invite-compatible URL
    // Format: one://attestation/{type}/{hash}?v={version}&topic={topicId}
    const qrData = this.createInviteUrl({
      type: attestationType,
      hash: messageHash,
      version: messageVersion,
      topicId
    });

    try {
      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      return {
        qrDataUrl,
        qrText: qrData,
        metadata: {
          version: this.version,
          type: 'attestation',
          attestationType,
          messageHash,
          messageVersion,
          topicId,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[QRGenerator] Error generating QR code:', error);
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Generate QR code for topic attestation
   *
   * @param {Object} options
   * @param {string} options.topicId - Topic ID
   * @param {string} options.topicHash - Topic content hash
   * @returns {Promise<Object>} QR data
   */
  async generateQRForTopic(options) {
    const { topicId, topicHash } = options;

    if (!topicId || !topicHash) {
      throw new Error('Topic ID and hash are required');
    }

    const qrData = this.createInviteUrl({
      type: 'topic',
      hash: topicHash,
      topicId
    });

    try {
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        errorCorrectionLevel: 'H', // Higher correction for topic QRs
        type: 'image/png',
        width: 256
      });

      return {
        qrDataUrl,
        qrText: qrData,
        metadata: {
          version: this.version,
          type: 'attestation',
          attestationType: 'topic',
          topicId,
          topicHash,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[QRGenerator] Error generating topic QR:', error);
      throw new Error(`Failed to generate topic QR: ${error.message}`);
    }
  }

  /**
   * Create ONE.core invite-compatible URL
   *
   * @private
   * @param {Object} params
   * @returns {string} ONE.core URL
   */
  createInviteUrl(params) {
    const { type, hash, version, topicId } = params;

    // Base URL for attestation invites
    let url = `${this.baseUrl}attestation/${type}/${hash}`;

    // Add query parameters
    const queryParams = [];
    if (version !== undefined) {
      queryParams.push(`v=${version}`);
    }
    if (topicId) {
      queryParams.push(`topic=${topicId}`);
    }

    if (queryParams.length > 0) {
      url += `?${queryParams.join('&')}`;
    }

    return url;
  }

  /**
   * Parse QR code data (for scanning)
   *
   * @param {string} qrText - Scanned QR text
   * @returns {Object} Parsed data
   */
  parseQRData(qrText) {
    if (!qrText.startsWith('one://')) {
      throw new Error('Invalid QR format - must be ONE.core URL');
    }

    const url = new URL(qrText.replace('one://', 'https://'));
    const pathParts = url.pathname.split('/').filter(p => p);

    if (pathParts[0] !== 'attestation') {
      throw new Error('Not an attestation QR code');
    }

    const parsed = {
      type: pathParts[1], // 'message' or 'topic'
      hash: pathParts[2],
      version: url.searchParams.get('v') ? parseInt(url.searchParams.get('v')) : undefined,
      topicId: url.searchParams.get('topic')
    };

    return parsed;
  }

  /**
   * Generate batch QR codes for multiple messages
   *
   * @param {Array} messages - Array of message objects
   * @returns {Promise<Array>} Array of QR results
   */
  async generateBatchQRCodes(messages) {
    console.log(`[QRGenerator] Generating ${messages.length} QR codes`);

    const results = [];
    for (const message of messages) {
      try {
        const qr = await this.generateQRForMessage({
          messageHash: message.hash,
          messageVersion: message.version,
          topicId: message.topicId,
          attestationType: 'message'
        });
        results.push({
          success: true,
          messageId: message.id,
          ...qr
        });
      } catch (error) {
        results.push({
          success: false,
          messageId: message.id,
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[QRGenerator] Generated ${successCount}/${messages.length} QR codes`);

    return results;
  }

  /**
   * Validate QR data against message
   *
   * @param {string} qrText - QR text to validate
   * @param {Object} message - Message to validate against
   * @returns {boolean} Is valid
   */
  validateQRAgainstMessage(qrText, message) {
    try {
      const parsed = this.parseQRData(qrText);

      return parsed.hash === message.hash &&
             (!parsed.version || parsed.version === message.version);
    } catch (error) {
      console.error('[QRGenerator] QR validation failed:', error);
      return false;
    }
  }
}

// Export singleton instance
const qrGenerator = new QRGenerator();
export default qrGenerator;