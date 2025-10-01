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
    trust;
    leuteModel;
    certificateCache;
    constructor(trustedKeysManager, leuteModel) {
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
    async createMessageAssertion(message, messageHash) {
        try {
            console.log('[MessageAssertion] Creating assertion certificate for message:', message.id);
            // Import required ONE.core functions
            const { storeObject } = await import('@refinio/one.core/lib/storage.js');
            const { createSignature } = await import('@refinio/one.core/lib/signatures.js');
            // Create assertion data that will be certified
            const assertionData = {
                $type$: 'MessageAssertion',
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
            const assertionResult = await storeObject(assertionData);
            const assertionHash = assertionResult.idHash || assertionResult;
            console.log('[MessageAssertion] Stored assertion data:', String(assertionHash).substring(0, 8));
            // Create AffirmationCertificate using TrustedKeysManager
            // This will automatically sign with our keys
            const certificateHash = await this.trust.certify('AffirmationCertificate', {
                data: assertionHash // Reference to the assertion data
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
        }
        catch (error) {
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
    async verifyMessageAssertion(certificateHash, expectedMessageHash) {
        try {
            console.log('[MessageAssertion] Verifying certificate:', String(certificateHash).substring(0, 8));
            const { getObject } = await import('@refinio/one.core/lib/storage.js');
            const { verifySignature } = await import('@refinio/one.core/lib/signatures.js');
            // Retrieve the certificate
            const certificate = await getObject(certificateHash);
            if (certificate.$type$ !== 'AffirmationCertificate') {
                throw new Error('Not an AffirmationCertificate');
            }
            // Retrieve the assertion data
            const assertionData = await getObject(certificate.data);
            if (assertionData.$type$ !== 'MessageAssertion') {
                throw new Error('Certificate does not reference MessageAssertion data');
            }
            // Verify the message hash matches
            const hashMatches = assertionData.messageHash === expectedMessageHash;
            // Verify the signature
            const signatureValid = await verifySignature(certificate);
            // Get signer identity
            let signerIdentity = null;
            if (certificate.signature && certificate.signature.issuer) {
                try {
                    const signer = await getObject(certificate.signature.issuer);
                    signerIdentity = signer;
                }
                catch (e) {
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
        }
        catch (error) {
            console.error('[MessageAssertion] Error verifying assertion:', error);
            return {
                valid: false,
                error: error.message
            };
        }
    }
    /**
     * Export message with assertion as verifiable credential
     *
     * @param {string} messageId - ID of the message to export
     * @returns {Promise<Object>} Verifiable credential
     */
    async exportAsVerifiableCredential(messageId) {
        try {
            const certificateHash = this.certificateCache.get(messageId);
            if (!certificateHash) {
                throw new Error('No certificate found for message');
            }
            const { getObject } = await import('@refinio/one.core/lib/storage.js');
            // Get certificate and assertion data
            const certificate = await getObject(certificateHash);
            const assertionData = await getObject(certificate.data);
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
                    verificationMethod: `urn:one:keys:${certificate.signature?.issuer}`,
                    certificateHash: certificateHash,
                    assertionHash: certificate.data
                }
            };
            return verifiableCredential;
        }
        catch (error) {
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
    async createBatchAssertions(messages) {
        console.log(`[MessageAssertion] Creating batch assertions for ${messages.length} messages`);
        const results = [];
        for (const { message, hash } of messages) {
            try {
                const result = await this.createMessageAssertion(message, hash);
                results.push({ success: true, messageId: message.id, ...result });
            }
            catch (error) {
                console.error(`[MessageAssertion] Failed for message ${message.id}:`, error);
                results.push({ success: false, messageId: message.id, error: error.message });
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
    getCertificateForMessage(messageId) {
        return this.certificateCache.get(messageId) || null;
    }
    /**
     * Clear certificate cache
     */
    clearCache() {
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
