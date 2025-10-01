/**
 * Audit IPC Handlers
 *
 * Handles IPC requests for audit operations including:
 * - QR code generation for attestations
 * - Creating attestations for messages/topics
 * - Retrieving attestations
 * - Exporting topics with attestations
 * - Verifying attestations
 */
import qrGenerator from '../../core/qr-generation.js';
import { AttestationManager } from '../../core/attestation-manager.js';
import { TopicExporter } from '../../core/topic-export.js';
import nodeOneCore from '../../core/node-one-core.js';
// Manager instances (initialized on first use)
let attestationManager = null;
let topicExporter = null;
/**
 * Get or create attestation manager
 */
function getAttestationManager() {
    if (!attestationManager && nodeOneCore.initialized) {
        attestationManager = new AttestationManager(nodeOneCore.channelManager, nodeOneCore.trust, nodeOneCore.leuteModel);
    }
    return attestationManager;
}
/**
 * Get or create topic exporter
 */
function getTopicExporter() {
    if (!topicExporter) {
        topicExporter = new TopicExporter(nodeOneCore.channelManager, getAttestationManager());
    }
    return topicExporter;
}
const auditHandlers = {
    /**
     * Generate QR code for message/topic attestation
     * Compatible with ONE.core contact invites
     */
    async generateQR(event, params) {
        console.log('[AuditHandler] Generate QR:', params);
        try {
            const { messageHash, messageVersion, topicId, attestationType = 'message' } = params;
            if (!messageHash && attestationType === 'message') {
                throw new Error('Message hash required for message QR');
            }
            let result;
            if (attestationType === 'topic' && topicId) {
                // Generate QR for topic
                result = await qrGenerator.generateQRForTopic({
                    topicId,
                    topicHash: messageHash || topicId // Use topicId as fallback
                });
            }
            else {
                // Generate QR for message
                result = await qrGenerator.generateQRForMessage({
                    messageHash,
                    messageVersion,
                    topicId,
                    attestationType
                });
            }
            return {
                success: true,
                qrDataUrl: result.qrDataUrl,
                qrText: result.qrText,
                metadata: result.metadata
            };
        }
        catch (error) {
            console.error('[AuditHandler] Error generating QR:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    /**
     * Create attestation for a message
     */
    async createAttestation(event, params) {
        console.log('[AuditHandler] Create attestation:', params);
        try {
            const manager = getAttestationManager();
            if (!manager) {
                throw new Error('Attestation manager not available - ONE.core not initialized');
            }
            const result = await manager.createAttestation(params);
            return {
                success: true,
                attestation: result.attestation,
                certificateHash: result.certificateHash,
                hash: result.hash
            };
        }
        catch (error) {
            console.error('[AuditHandler] Error creating attestation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    /**
     * Get attestations for message/topic/auditor
     */
    async getAttestations(event, params) {
        console.log('[AuditHandler] Get attestations:', params);
        try {
            const manager = getAttestationManager();
            if (!manager) {
                return {
                    success: true,
                    attestations: []
                };
            }
            const { messageHash, topicId, auditorId } = params;
            let attestations = [];
            if (messageHash) {
                attestations = await manager.getAttestationsForMessage(messageHash);
            }
            else if (topicId) {
                attestations = await manager.getAttestationsForTopic(topicId);
            }
            else if (auditorId) {
                attestations = await manager.getAttestationsByAuditor(auditorId);
            }
            return {
                success: true,
                attestations
            };
        }
        catch (error) {
            console.error('[AuditHandler] Error getting attestations:', error);
            return {
                success: false,
                error: error.message,
                attestations: []
            };
        }
    },
    /**
     * Export topic with attestations
     */
    async exportTopic(event, params) {
        console.log('[AuditHandler] Export topic:', params);
        try {
            const exporter = getTopicExporter();
            if (!exporter) {
                throw new Error('Topic exporter not available');
            }
            const result = await exporter.exportTopicWithAttestations(params);
            return {
                success: true,
                exportData: result.data,
                format: result.format,
                metadata: result.metadata
            };
        }
        catch (error) {
            console.error('[AuditHandler] Error exporting topic:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    /**
     * Verify attestation
     */
    async verifyAttestation(event, params) {
        console.log('[AuditHandler] Verify attestation:', params);
        try {
            const manager = getAttestationManager();
            if (!manager) {
                throw new Error('Attestation manager not available');
            }
            const { attestationHash, messageHash } = params;
            const verification = await manager.verifyAttestation(attestationHash, messageHash);
            return {
                success: true,
                verification
            };
        }
        catch (error) {
            console.error('[AuditHandler] Error verifying attestation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    /**
     * Generate batch QR codes for multiple messages
     */
    async generateBatchQR(event, params) {
        console.log('[AuditHandler] Generate batch QR codes');
        try {
            const { messages } = params;
            if (!messages || !Array.isArray(messages)) {
                throw new Error('Messages array required');
            }
            const results = await qrGenerator.generateBatchQRCodes(messages);
            const successCount = results.filter((r) => r.success).length;
            console.log(`[AuditHandler] Generated ${successCount}/${messages.length} QR codes`);
            return {
                success: true,
                results,
                summary: {
                    total: messages.length,
                    successful: successCount,
                    failed: messages.length - successCount
                }
            };
        }
        catch (error) {
            console.error('[AuditHandler] Error in batch QR generation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    /**
     * Parse scanned QR code
     */
    async parseQR(event, params) {
        console.log('[AuditHandler] Parse QR code');
        try {
            const { qrText } = params;
            if (!qrText) {
                throw new Error('QR text required');
            }
            const parsed = qrGenerator.parseQRData(qrText);
            return {
                success: true,
                parsed
            };
        }
        catch (error) {
            console.error('[AuditHandler] Error parsing QR:', error);
            return {
                success: false,
                error: error.message
            };
        }
    },
    /**
     * Get attestation status for UI display
     */
    async getAttestationStatus(event, params) {
        console.log('[AuditHandler] Get attestation status');
        try {
            const manager = getAttestationManager();
            if (!manager) {
                return {
                    success: true,
                    status: {
                        hasAttestations: false,
                        attestationCount: 0,
                        fullyAttested: false,
                        partiallyAttested: false,
                        pendingSync: false,
                        auditors: [],
                        signaturesComplete: true,
                        missingSignatures: []
                    }
                };
            }
            const { messageHash } = params;
            const attestations = await manager.getAttestationsForMessage(messageHash);
            // Build status object
            const status = {
                hasAttestations: attestations.length > 0,
                attestationCount: attestations.length,
                fullyAttested: attestations.length >= 2, // Consider fully attested with 2+ attestations
                partiallyAttested: attestations.length === 1,
                pendingSync: false, // Would check sync status in real implementation
                auditors: attestations.map((att) => ({
                    id: att.auditorId,
                    name: att.auditorName || 'Unknown',
                    attestedAt: att.timestamp,
                    trustLevel: 3 // Would fetch from trust manager
                })),
                signaturesComplete: attestations.every((att) => att.signature),
                missingSignatures: attestations
                    .filter((att) => !att.signature)
                    .map((att) => att.auditorId)
            };
            return {
                success: true,
                status
            };
        }
        catch (error) {
            console.error('[AuditHandler] Error getting status:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
};
export default auditHandlers;
