/**
 * Message Assertion Certificates
 *
 * Creates and manages AffirmationCertificates for messages to enable
 * verifiable credential exports and audit trails.
 *
 * Each message gets an AffirmationCertificate that:
 * - Affirms the content is authentic and unmodified
 * - Links to the message via content-addressed hash
 * - Is signed by the sender's keys
 * - Can be exported as a verifiable credential
 */

/**
 * Message Assertion Manager
 * Handles certificate generation and verification for messages
 */
export class MessageAssertionManager {
  public trust: any;
  public leuteModel: any;
  public certificateCache: any;

  constructor(trustedKeysManager: any, leuteModel: any) {

    this.trust = trustedKeysManager;
    this.leuteModel = leuteModel;
    this.certificateCache = new Map(); // messageId -> certificate hash
}

  /**
   * Create an AffirmationCertificate for a message
   *
   * @param {Object} message - The message to certify
   * @param {string} messageHash - SHA256 hash of the stored message
   * @returns {Promise<Object>} Certificate details
   */
  async createMessageAssertion(message: any, messageHash: any): Promise<any> {
    try {
      console.log('[MessageAssertion] Creating assertion certificate for message:', message.id);

      // Import required ONE.core functions
      const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
      // Import certificate functionality from ONE.models
      const { AffirmationLicense } = await import('@refinio/one.models/lib/recipes/Certificates/AffirmationCertificate.js');
      const TrustedKeysManager = await import('@refinio/one.models/lib/models/Leute/TrustedKeysManager.js');

      // Create assertion data that will be certified
      const assertionData = {
        $type$: 'MessageAssertion' as const,
        messageId: message.id,
        messageHash: messageHash,
        text: message.text,
        timestamp: message.timestamp || new Date().toISOString(),
        sender: message.sender || message.senderId,
        subjects: message.subjects || [],
        keywords: message.keywords || [],
        version: message.version || 1,

        // Add integrity metadata
        assertedAt: new Date().toISOString(),
        assertionType: 'content-authenticity',
        assertionVersion: '1.0.0'
      };

      // Store the assertion data
      const assertionResult = await storeVersionedObject(assertionData);
      const assertionHash = assertionResult.idHash || assertionResult;

      console.log('[MessageAssertion] Stored assertion data:', String(assertionHash).substring(0, 8));

      // Create AffirmationCertificate using TrustedKeysManager
      // This will automatically sign with our keys and add proper license
      const certificateHash = await this.trust.certify('AffirmationCertificate', {
        data: assertionHash  // Reference to the assertion data
      });

      console.log('[MessageAssertion] Created AffirmationCertificate:', String(certificateHash).substring(0, 8));

      // Cache the certificate
      this.certificateCache.set(message.id, certificateHash);

      return {
        certificateHash,
        assertionHash,
        assertionData,
        messageHash
      };
    } catch (error) {
      console.error('[MessageAssertion] Error creating assertion:', error);
      throw error;
    }
  }

  /**
   * Verify an AffirmationCertificate for a message
   *
   * @param {string} certificateHash - Hash of the certificate to verify
   * @param {string} expectedMessageHash - Expected message hash
   * @returns {Promise<Object>} Verification result
   */
  async verifyMessageAssertion(certificateHash: any, expectedMessageHash: any): Promise<any> {
    try {
      console.log('[MessageAssertion] Verifying certificate:', String(certificateHash).substring(0, 8));

      const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');

      // Get certificate using TrustedKeysManager - it handles certificate verification properly
      const certificates = await this.trust.getCertificates(certificateHash);
      const affirmationCert = certificates.find((cert: any) => cert.certificate.$type$ === 'AffirmationCertificate');

      if (!affirmationCert) {
        throw new Error('No AffirmationCertificate found');
      }

      const certificate = affirmationCert.certificate;
      const signature = affirmationCert.signature;

      // Retrieve the assertion data
      const assertionDataResult = await getObjectByIdHash(certificate.data);
      const assertionData = assertionDataResult.obj as any; // Cast to MessageAssertion interface

      if (assertionData.$type$ !== 'MessageAssertion') {
        throw new Error('Certificate does not reference MessageAssertion data');
      }

      // Verify the message hash matches
      const hashMatches = assertionData.messageHash === expectedMessageHash;

      // Verify the signature using TrustedKeysManager - use the trusted flag from certificate data
      const signatureValid = affirmationCert.trusted;

      // Get signer identity from signature
      let signerIdentity = null;
      if (signature && signature.issuer) {
        try {
          const signerResult = await getObjectByIdHash(signature.issuer);
          signerIdentity = signerResult.obj;
        } catch (e: any) {
          console.warn('[MessageAssertion] Could not retrieve signer identity:', e);
        }
      }

      return {
        valid: hashMatches && signatureValid,
        hashMatches,
        signatureValid,
        assertionData,
        certificate,
        signerIdentity
      };
    } catch (error) {
      console.error('[MessageAssertion] Error verifying assertion:', error);
      return {
        valid: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Export message with assertion as verifiable credential
   *
   * @param {string} messageId - ID of the message to export
   * @returns {Promise<Object>} Verifiable credential
   */
  async exportAsVerifiableCredential(messageId: any): Promise<any> {
    try {
      const certificateHash = this.certificateCache.get(messageId);

      if (!certificateHash) {
        throw new Error('No certificate found for message');
      }

      const { getObjectByIdHash } = await import('@refinio/one.core/lib/storage-versioned-objects.js');

      // Get certificate and assertion data using TrustedKeysManager
      const certificates = await this.trust.getCertificates(certificateHash);
      const affirmationCert = certificates.find((cert: any) => cert.certificate.$type$ === 'AffirmationCertificate');

      if (!affirmationCert) {
        throw new Error('No AffirmationCertificate found');
      }

      const certificate = affirmationCert.certificate;
      const signature = affirmationCert.signature;
      const assertionDataResult = await getObjectByIdHash(certificate.data);
      const assertionData = assertionDataResult.obj as any; // Cast to MessageAssertion interface

      // Get our identity for issuer info
      const me = await this.leuteModel.me();
      const mainProfile = await me.mainProfile();

      // Create W3C Verifiable Credential format
      const verifiableCredential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://one.core/contexts/message-assertion/v1'
        ],
        type: ['VerifiableCredential', 'MessageAssertionCredential'],

        // Credential metadata
        id: `urn:one:cert:${certificateHash}`,
        issuer: {
          id: `urn:one:person:${me.personId}`,
          name: mainProfile?.name || 'Unknown',
          type: 'ONE.core Identity'
        },
        issuanceDate: assertionData.assertedAt,

        // The actual claim
        credentialSubject: {
          id: `urn:one:msg:${assertionData.messageId}`,
          messageHash: assertionData.messageHash,
          content: assertionData.text,
          timestamp: assertionData.timestamp,
          sender: assertionData.sender,
          subjects: assertionData.subjects,
          keywords: assertionData.keywords,
          version: assertionData.version
        },

        // Proof (ONE.core signature)
        proof: {
          type: 'ONE.coreSignature2024',
          created: assertionData.assertedAt,
          proofPurpose: 'assertionMethod',
          verificationMethod: `urn:one:keys:${signature?.issuer}`,
          certificateHash: certificateHash,
          assertionHash: certificate.data
        }
      };

      return verifiableCredential;
    } catch (error) {
      console.error('[MessageAssertion] Error exporting verifiable credential:', error);
      throw error;
    }
  }

  /**
   * Batch create assertions for multiple messages
   *
   * @param {Array} messages - Array of messages with their hashes
   * @returns {Promise<Array>} Array of certificate results
   */
  async createBatchAssertions(messages: any): Promise<any> {
    console.log(`[MessageAssertion] Creating batch assertions for ${messages.length} messages`);

    const results = [];
    for (const { message, hash } of messages) {
      try {
        const result = await this.createMessageAssertion(message, hash);
        results.push({ success: true, messageId: message.id, ...result });
      } catch (error) {
        console.error(`[MessageAssertion] Failed for message ${message.id}:`, error);
        results.push({ success: false, messageId: message.id, error: (error as Error).message });
      }
    }

    return results;
  }

  /**
   * Get certificate for a message
   *
   * @param {string} messageId - Message ID
   * @returns {string|null} Certificate hash or null
   */
  getCertificateForMessage(messageId: any): any {
    return this.certificateCache.get(messageId) || null;
  }

  /**
   * Clear certificate cache
   */
  clearCache(): any {
    this.certificateCache.clear();
    console.log('[MessageAssertion] Certificate cache cleared');
  }
}

/**
 * Export for use in chat handlers
 */
export default {
  MessageAssertionManager
};