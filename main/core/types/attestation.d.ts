/**
 * Type definitions for Message Attestation system
 */

/**
 * Message Attestation object stored in Topic
 */
export interface MessageAttestation {
  $type$: 'MessageAttestation';
  messageHash: string;          // SHA256 hash of the message version
  messageVersion: number;        // Version number of the message
  attestedContent: string;       // The content that was attested
  auditorId: string;            // Person ID of the auditor
  auditorName?: string;         // Display name of auditor
  timestamp: string;            // ISO 8601 timestamp
  signature?: any;              // SignatureObject from ONE.core

  // Attestation metadata
  attestationType: 'content-authenticity' | 'version-match' | 'reproduction-correct';
  attestationClaim: string;     // Human-readable claim
  attestationMethod?: string;   // How attestation was performed
}

/**
 * QR Code data structure for audit
 */
export interface AuditQRCode {
  version: '1.0.0';
  type: 'audit';
  messageHash: string;
  topicId?: string;
  timestamp: string;
  url: string;  // one://audit/{messageHash}
}

/**
 * Topic export with attestations
 */
export interface AuditedTopicExport {
  $type$: 'AuditedTopic';
  topicId: string;
  topicName: string;
  exportedAt: string;
  exportedBy: string;

  messages: Array<{
    hash: string;
    version: number;
    content: string;
    timestamp: string;
    sender: string;
    attestations: MessageAttestation[];
  }>;

  // Microdata schema reference
  schemaVersion: '1.0.0';
  schemaUrl: 'https://one.core/schemas/audited-topic';
}

/**
 * Attestation verification result
 */
export interface AttestationVerification {
  valid: boolean;
  messageHash: string;
  auditorId: string;
  verifiedAt: string;

  // Verification details
  signatureValid: boolean;
  hashMatches: boolean;
  auditorTrusted: boolean;

  // Error info if invalid
  error?: string;
  details?: string;
}

/**
 * Attestation status for UI display
 */
export interface AttestationStatus {
  hasAttestations: boolean;
  attestationCount: number;
  fullyAttested: boolean;
  partiallyAttested: boolean;
  pendingSync: boolean;

  // List of auditors who attested
  auditors: Array<{
    id: string;
    name: string;
    attestedAt: string;
    trustLevel: number;
  }>;

  // Signature completeness
  signaturesComplete: boolean;
  missingSignatures: string[];
}

/**
 * Request/Response types for IPC handlers
 */
export interface GenerateQRRequest {
  messageId: string;
  messageHash: string;
  messageVersion: number;
  topicId?: string;
}

export interface GenerateQRResponse {
  success: boolean;
  qrDataUrl?: string;  // Data URL for QR image
  qrText?: string;     // Raw QR content
  error?: string;
}

export interface CreateAttestationRequest {
  messageHash: string;
  messageVersion: number;
  attestedContent: string;
  attestationType: MessageAttestation['attestationType'];
  attestationClaim: string;
}

export interface CreateAttestationResponse {
  success: boolean;
  attestation?: MessageAttestation;
  certificateHash?: string;
  error?: string;
}

export interface GetAttestationsRequest {
  messageHash?: string;
  topicId?: string;
  auditorId?: string;
}

export interface GetAttestationsResponse {
  success: boolean;
  attestations?: MessageAttestation[];
  error?: string;
}

export interface ExportTopicRequest {
  topicId: string;
  includeAttestations: boolean;
  format: 'html' | 'json' | 'microdata';
}

export interface ExportTopicResponse {
  success: boolean;
  exportData?: string;
  exportUrl?: string;
  error?: string;
}

export interface VerifyAttestationRequest {
  attestationHash: string;
  messageHash: string;
}

export interface VerifyAttestationResponse {
  success: boolean;
  verification?: AttestationVerification;
  error?: string;
}