/**
 * Attestation Manager for Message Audit
 *
 * Manages creation, storage, and retrieval of attestations
 * Attestations are stored as Topic objects and synced via ONE.core
 */

import type { ChannelManager, LeuteModel } from '@refinio/one.models/lib/models/index.js'
import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks.js'
import type { TrustManager, MessageAttestation } from '../types/extended-types.js'

/**
 * Attestation Manager
 */
export class AttestationManager {

  channelManager: ChannelManager;
  trust: TrustManager | null;
  leuteModel: LeuteModel;
  attestationCache: Map<string, MessageAttestation[]>;

  constructor(channelManager: ChannelManager, trustedKeysManager: TrustManager | null, leuteModel: LeuteModel) {
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
  async createAttestation(params: any): Promise<any> {
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
      const auditorId = (me as any).personId;
      const auditorName = (profile as any)?.name || 'Unknown Auditor';

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
      const { storeUnversionedObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
      const result = await storeUnversionedObject(attestation as any);
      const attestationHash = result.hash;

      console.log('[AttestationManager] Created attestation:', String(attestationHash).substring(0, 8));

      // Create AffirmationCertificate if trust manager available
      let certificateHash = null;
      if (this.trust) {
        try {
          certificateHash = await this.trust.certify('AffirmationCertificate', {
            data: attestationHash
          });
          console.log('[AttestationManager] Created certificate:', String(certificateHash).substring(0, 8));
        } catch (error) {
          console.warn('[AttestationManager] Could not create certificate:', (error as Error).message);
        }
      }

      // Store in Topic structure via ChannelManager if available
      if (this.channelManager && topicId) {
        try {
          await this.storeInTopic(topicId, attestation, attestationHash);
        } catch (error) {
          console.warn('[AttestationManager] Could not store in topic:', (error as Error).message);
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
  async storeInTopic(topicId: any, attestation: any, attestationHash: any): Promise<any> {
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
      await (this.channelManager as any).addToChannel(topicId, channelEntry);

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
  async getAttestationsForMessage(messageHash: any): Promise<any> {
    // Check cache first
    if (this.attestationCache.has(messageHash)) {
      return (this.attestationCache as any)?.get(messageHash);
    }

    try {
      const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
      const { getAllEntries } = await import('@refinio/one.core/lib/reverse-map-query.js');

      // Query for attestations by message hash
      // Note: MessageAttestation is a custom type, so we cast it
      const attestationHashes = await getAllEntries(messageHash, 'MessageAttestation' as any);
      const attestations: MessageAttestation[] = [];

      for (const hash of attestationHashes) {
        try {
          const attestation = await getObject(hash);
          if ((attestation as any).messageHash === messageHash) {
            attestations.push(attestation as MessageAttestation);
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
  async getAttestationsForTopic(topicId: any): Promise<any> {
    if (!this.channelManager) {
      return [];
    }

    try {
      // Get all channel entries for the topic
      const entries = await (this.channelManager as any).getChannelEntries(topicId);

      // Filter for attestation entries
      const attestations = entries
        .filter((entry: any) => entry.data?.$type$ === 'MessageAttestation')
        .map((entry: any) => entry.data);

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
  async getAttestationsByAuditor(auditorId: any): Promise<any> {
    try {
      const { getAllEntries } = await import('@refinio/one.core/lib/reverse-map-query.js');
      const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');

      // Query for attestations by auditor
      // Note: MessageAttestation is a custom type, so we cast it
      const attestationHashes = await getAllEntries(auditorId, 'MessageAttestation' as any);
      const attestations: MessageAttestation[] = [];

      for (const hash of attestationHashes) {
        try {
          const attestation = await getObject(hash);
          if ((attestation as any).auditorId === auditorId) {
            attestations.push(attestation as MessageAttestation);
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
  async verifyAttestation(attestationHash: any, expectedMessageHash: any): Promise<any> {
    try {
      const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
      const { signatureVerify } = await import('@refinio/one.core/lib/crypto/sign.js');

      // Retrieve attestation
      const attestation = await getObject(attestationHash);

      if ((attestation as any).$type$ !== 'MessageAttestation') {
        throw new Error('Not a MessageAttestation object');
      }

      // Check message hash
      const hashMatches = (attestation as any).messageHash === expectedMessageHash;

      // Verify signature if present
      let signatureValid = true;
      if ((attestation as any).signature) {
        try {
          // Note: signatureVerify needs the data, signature, and public key separately
          // This is a placeholder - actual implementation needs proper signature verification
          signatureValid = false; // TODO: Implement proper signature verification
        } catch (error) {
          signatureValid = false;
        }
      }

      // Check if auditor is trusted
      let auditorTrusted = false;
      if (this.trust && (attestation as any).auditorId) {
        try {
          const trusted = await this.trust.isTrusted((attestation as any).auditorId);
          auditorTrusted = trusted;
        } catch (error) {
          auditorTrusted = false;
        }
      }

      return {
        valid: hashMatches && signatureValid,
        messageHash: (attestation as any).messageHash,
        auditorId: (attestation as any).auditorId,
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
        error: (error as Error).message,
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
  async getAuditTrail(messageHash: any): Promise<any> {
    const attestations = await this.getAttestationsForMessage(messageHash);

    // Sort by timestamp
    attestations.sort((a: any, b: any) =>
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
  async syncAttestations(topicId: any): Promise<any> {
    if (!this.channelManager) {
      return [];
    }

    try {
      // Force sync of the topic channel
      await (this.channelManager as any).syncChannel(topicId);

      // Get updated attestations
      const attestations = await this.getAttestationsForTopic(topicId);

      // Update cache for each message
      for (const attestation of attestations) {
        this.addToCache(attestation.messageHash, attestation);
      }

      console.log(`[AttestationManager] Synced ${(attestations as any)?.length} attestations for topic`);
      return attestations;
    } catch (error) {
      console.error('[AttestationManager] Error syncing attestations:', error);
      return [];
    }
  }

  /**
   * Store attestation (for testing)
   */
  async storeAttestation(attestation: any): Promise<any> {
    const { storeUnversionedObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
    const result = await storeUnversionedObject(attestation);
    const hash = (result as any)?.idHash || result;

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
  addToCache(messageHash: any, attestation: any): any {
    if (!this.attestationCache.has(messageHash)) {
      this.attestationCache.set(messageHash, []);
    }
    const cache = this.attestationCache.get(messageHash);
    if (cache) {
      cache.push(attestation as MessageAttestation);
    }
  }

  /**
   * Clear attestation cache
   */
  clearCache(): any {
    this.attestationCache.clear();
    console.log('[AttestationManager] Cache cleared');
  }
}

export default AttestationManager;