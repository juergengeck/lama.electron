/**
 * Audit IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to AuditHandler methods.
 * Business logic lives in ../../../lama.core/handlers/AuditHandler.ts
 */

import { AuditHandler } from '@lama/core/handlers/AuditHandler.js';
import qrGenerator from '../../core/qr-generation.js';
import { AttestationManager } from '../../core/attestation-manager.js';
import { TopicExporter } from '../../core/topic-export.js';
import nodeOneCore from '../../core/node-one-core.js';
import type { IpcMainInvokeEvent } from 'electron';

// Service instances
let attestationManager: AttestationManager | null = null;
let topicExporter: TopicExporter | null = null;
let auditHandler: AuditHandler | null = null;

/**
 * Get or create attestation manager
 */
function getAttestationManager(): AttestationManager | null {
  if (!attestationManager && nodeOneCore.initialized) {
    attestationManager = new AttestationManager(
      nodeOneCore.channelManager,
      (nodeOneCore as any).trust,
      nodeOneCore.leuteModel
    );
  }
  return attestationManager;
}

/**
 * Get or create topic exporter
 */
function getTopicExporter(): TopicExporter | null {
  if (!topicExporter) {
    topicExporter = new TopicExporter(
      nodeOneCore.channelManager,
      getAttestationManager()
    );
  }
  return topicExporter;
}

/**
 * Get handler instance (creates on first use)
 */
function getHandler(): AuditHandler {
  if (!auditHandler) {
    auditHandler = new AuditHandler(
      qrGenerator,
      getAttestationManager(),
      getTopicExporter()
    );
  }
  return auditHandler;
}

const auditHandlers = {
  /**
   * Generate QR code for message/topic attestation
   */
  async generateQR(event: IpcMainInvokeEvent, params: any) {
    return await getHandler().generateQR(params);
  },

  /**
   * Create attestation for a message
   */
  async createAttestation(event: IpcMainInvokeEvent, params: any) {
    return await getHandler().createAttestation(params);
  },

  /**
   * Get attestations for message/topic/auditor
   */
  async getAttestations(event: IpcMainInvokeEvent, params: any) {
    return await getHandler().getAttestations(params);
  },

  /**
   * Export topic with attestations
   */
  async exportTopic(event: IpcMainInvokeEvent, params: any) {
    return await getHandler().exportTopic(params);
  },

  /**
   * Verify attestation
   */
  async verifyAttestation(event: IpcMainInvokeEvent, params: any) {
    return await getHandler().verifyAttestation(params);
  },

  /**
   * Generate batch QR codes for multiple messages
   */
  async generateBatchQR(event: IpcMainInvokeEvent, params: any) {
    return await getHandler().generateBatchQR(params);
  },

  /**
   * Parse scanned QR code
   */
  async parseQR(event: IpcMainInvokeEvent, params: any) {
    return await getHandler().parseQR(params);
  },

  /**
   * Get attestation status for UI display
   */
  async getAttestationStatus(event: IpcMainInvokeEvent, params: any) {
    return await getHandler().getAttestationStatus(params);
  }
};

export default auditHandlers;