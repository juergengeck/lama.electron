/**
 * Attestation Manager for Message Audit
 *
 * Manages creation, storage, and retrieval of attestations
 * Attestations are stored as Topic objects and synced via ONE.core
 */

/**
 * Attestation Manager
 */
export class AttestationManager {
  constructor(channelManager, trustedKeysManager, leuteModel) {
    this.channelManager = channelManager;
    this.trust = trustedKeysManager;
    this.leuteModel = leuteModel;
    this.attestationCache = new Map(); // messageHash -> attestations[]
  }

  /**
   * Create an attestation for a message
   *
   * @param {Object} params
   * @param {string} params.messageHash - SHA256 hash of message version
   * @param {number} params.messageVersion - Version number
   * @param {string} params.attestedContent - Content being attested
   * @param {string} params.attestationType - Type of attestation
   * @param {string} params.attestationClaim - Human-readable claim
   * @param {string} params.topicId - Topic containing the message
   * @returns {Promise<Object>} Created attestation
   */
  async createAttestation(params) {
    const {
      messageHash,
      messageVersion,
      attestedContent,
      attestationType = 'reproduction-correct',
      attestationClaim,
      topicId
    } = params;

    if (!messageHash || !attestedContent) {
      throw new Error('Message hash and content are required');
    }

    try {
      // Get auditor identity
      const me = await this.leuteModel.me();
      const profile = await me.mainProfile();
      const auditorId = me.personId;
      const auditorName = profile?.name || 'Unknown Auditor';

      // Create attestation object
      const attestation = {
        $type$: 'MessageAttestation',
        messageHash,
        messageVersion: messageVersion || 1,
        attestedContent,
        auditorId,
        auditorName,
        timestamp: new Date().toISOString(),
        attestationType,
        attestationClaim: attestationClaim || `I attest that this ${attestationType} is correct`,
        attestationMethod: 'manual-verification',
        topicId
      };

      // Store attestation in ONE.core
      const { storeObject } = await import('@refinio/one.core/lib/storage.js');
      const result = await storeObject(attestation);
      const attestationHash = result.idHash || result;

      console.log('[AttestationManager] Created attestation:', attestationHash.substring(0, 8));

      // Create AffirmationCertificate if trust manager available
      let certificateHash = null;
      if (this.trust) {
        try {
          certificateHash = await this.trust.certify('AffirmationCertificate', {
            data: attestationHash
          });
          console.log('[AttestationManager] Created certificate:', certificateHash.substring(0, 8));
        } catch (error) {
          console.warn('[AttestationManager] Could not create certificate:', error.message);
        }
      }

      // Store in Topic structure via ChannelManager if available
      if (this.channelManager && topicId) {
        try {
          await this.storeInTopic(topicId, attestation, attestationHash);
        } catch (error) {
          console.warn('[AttestationManager] Could not store in topic:', error.message);
        }
      }

      // Cache the attestation
      this.addToCache(messageHash, attestation);

      return {
        attestation,
        hash: attestationHash,
        certificateHash
      };
    } catch (error) {
      console.error('[AttestationManager] Error creating attestation:', error);
      throw error;
    }
  }

  /**
   * Store attestation in Topic structure
   *
   * @private
   */
  async storeInTopic(topicId, attestation, attestationHash) {
    if (!this.channelManager) {
      console.warn('[AttestationManager] ChannelManager not available');
      return;
    }

    try {
      // Create a channel entry for the attestation
      const channelEntry = {
        $type$: 'ChannelEntry',
        channel: topicId,
        data: attestation,
        timestamp: attestation.timestamp,
        author: attestation.auditorId
      };

      // Store through channel manager (this will sync)
      await this.channelManager.addToChannel(topicId, channelEntry);

      console.log('[AttestationManager] Stored attestation in topic:', topicId);
    } catch (error) {
      console.error('[AttestationManager] Failed to store in topic:', error);
      throw error;
    }
  }

  /**
   * Get attestations for a message
   *
   * @param {string} messageHash - Message hash
   * @returns {Promise<Array>} Array of attestations
   */
  async getAttestationsForMessage(messageHash) {
    // Check cache first
    if (this.attestationCache.has(messageHash)) {
      return this.attestationCache.get(messageHash);
    }

    try {
      const { getObject } = await import('@refinio/one.core/lib/storage.js');
      const { getAllEntries } = await import('@refinio/one.core/lib/reverse-map-query.js');

      // Query for attestations by message hash
      const attestationHashes = await getAllEntries(messageHash, 'MessageAttestation');
      const attestations = [];

      for (const hash of attestationHashes) {
        try {
          const attestation = await getObject(hash);
          if (attestation.messageHash === messageHash) {
            attestations.push(attestation);
          }
        } catch (error) {
          console.warn('[AttestationManager] Could not retrieve attestation:', hash);
        }
      }

      // Update cache
      this.attestationCache.set(messageHash, attestations);

      return attestations;
    } catch (error) {
      console.error('[AttestationManager] Error getting attestations:', error);
      return [];
    }
  }

  /**
   * Get all attestations for a topic
   *
   * @param {string} topicId - Topic ID
   * @returns {Promise<Array>} Array of attestations
   */
  async getAttestationsForTopic(topicId) {
    if (!this.channelManager) {
      return [];
    }

    try {
      // Get all channel entries for the topic
      const entries = await this.channelManager.getChannelEntries(topicId);

      // Filter for attestation entries
      const attestations = entries
        .filter(entry => entry.data?.$type$ === 'MessageAttestation')
        .map(entry => entry.data);

      return attestations;
    } catch (error) {
      console.error('[AttestationManager] Error getting topic attestations:', error);
      return [];
    }
  }

  /**
   * Get attestations by auditor
   *
   * @param {string} auditorId - Auditor person ID
   * @returns {Promise<Array>} Array of attestations
   */
  async getAttestationsByAuditor(auditorId) {
    try {
      const { getAllEntries } = await import('@refinio/one.core/lib/reverse-map-query.js');
      const { getObject } = await import('@refinio/one.core/lib/storage.js');

      // Query for attestations by auditor
      const attestationHashes = await getAllEntries(auditorId, 'MessageAttestation');
      const attestations = [];

      for (const hash of attestationHashes) {
        try {
          const attestation = await getObject(hash);
          if (attestation.auditorId === auditorId) {
            attestations.push(attestation);
          }
        } catch (error) {
          console.warn('[AttestationManager] Could not retrieve attestation:', hash);
        }
      }

      return attestations;
    } catch (error) {
      console.error('[AttestationManager] Error getting auditor attestations:', error);
      return [];
    }
  }

  /**
   * Verify an attestation
   *
   * @param {string} attestationHash - Hash of attestation
   * @param {string} expectedMessageHash - Expected message hash
   * @returns {Promise<Object>} Verification result
   */
  async verifyAttestation(attestationHash, expectedMessageHash) {
    try {
      const { getObject } = await import('@refinio/one.core/lib/storage.js');
      const { verifySignature } = await import('@refinio/one.core/lib/signatures.js');

      // Retrieve attestation
      const attestation = await getObject(attestationHash);

      if (attestation.$type$ !== 'MessageAttestation') {
        throw new Error('Not a MessageAttestation object');
      }

      // Check message hash
      const hashMatches = attestation.messageHash === expectedMessageHash;

      // Verify signature if present
      let signatureValid = true;
      if (attestation.signature) {
        try {
          signatureValid = await verifySignature(attestation);
        } catch (error) {
          signatureValid = false;
        }
      }

      // Check if auditor is trusted
      let auditorTrusted = false;
      if (this.trust && attestation.auditorId) {
        try {
          const trusted = await this.trust.isTrusted(attestation.auditorId);
          auditorTrusted = trusted;
        } catch (error) {
          auditorTrusted = false;
        }
      }

      return {
        valid: hashMatches && signatureValid,
        messageHash: attestation.messageHash,
        auditorId: attestation.auditorId,
        verifiedAt: new Date().toISOString(),
        signatureValid,
        hashMatches,
        auditorTrusted,
        attestation
      };
    } catch (error) {
      console.error('[AttestationManager] Error verifying attestation:', error);
      return {
        valid: false,
        error: error.message,
        verifiedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Get audit trail for a message
   *
   * @param {string} messageHash - Message hash
   * @returns {Promise<Array>} Chronological audit trail
   */
  async getAuditTrail(messageHash) {
    const attestations = await this.getAttestationsForMessage(messageHash);

    // Sort by timestamp
    attestations.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return attestations;
  }

  /**
   * Sync attestations for a topic
   *
   * @param {string} topicId - Topic ID
   * @returns {Promise<Array>} Synced attestations
   */
  async syncAttestations(topicId) {
    if (!this.channelManager) {
      return [];
    }

    try {
      // Force sync of the topic channel
      await this.channelManager.syncChannel(topicId);

      // Get updated attestations
      const attestations = await this.getAttestationsForTopic(topicId);

      // Update cache for each message
      for (const attestation of attestations) {
        this.addToCache(attestation.messageHash, attestation);
      }

      console.log(`[AttestationManager] Synced ${attestations.length} attestations for topic`);
      return attestations;
    } catch (error) {
      console.error('[AttestationManager] Error syncing attestations:', error);
      return [];
    }
  }

  /**
   * Store attestation (for testing)
   */
  async storeAttestation(attestation) {
    const { storeObject } = await import('@refinio/one.core/lib/storage.js');
    const result = await storeObject(attestation);
    const hash = result.idHash || result;

    this.addToCache(attestation.messageHash, attestation);

    return {
      hash,
      linkedTo: attestation.messageHash,
      version: attestation.messageVersion
    };
  }

  /**
   * Add attestation to cache
   *
   * @private
   */
  addToCache(messageHash, attestation) {
    if (!this.attestationCache.has(messageHash)) {
      this.attestationCache.set(messageHash, []);
    }
    this.attestationCache.get(messageHash).push(attestation);
  }

  /**
   * Clear attestation cache
   */
  clearCache() {
    this.attestationCache.clear();
    console.log('[AttestationManager] Cache cleared');
  }
}

export default AttestationManager;