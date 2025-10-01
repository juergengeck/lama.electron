import type { ChannelManager } from '@refinio/one.models/lib/models/index.js';
/**
 * Message Versioning System for ONE.core
 *
 * Implements immutable, versioned messages where:
 * - Edits create new versions linked to the original
 * - Subjects and Keywords are SHA256 references to ONE objects
 * - Version metadata is stored in attachments
 * - All versions are preserved in the content-addressed storage
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { ChatMessage } from '@refinio/one.models/lib/recipes/ChatRecipes.js';
import type { OneUnversionedObjectTypes } from '@refinio/one.core/lib/recipes.js';

/**
 * Extended ChatMessage with versioning support
 * Subjects and keywords are SHA256 references to ONE objects
 * Version metadata goes in attachments
 */
export interface VersionedChatMessage extends Omit<ChatMessage, 'attachments'> {
  // ChatMessage already has: text, author, timestamp
  subjects?: SHA256Hash<any>[];  // References to Subject ONE objects
  keywords?: SHA256Hash<any>[];  // References to Keyword ONE objects
  attachments: Array<SHA256Hash | {
    type: string;
    data: any;
    hash?: SHA256Hash<any>;
  }>;
}

/**
 * Version metadata stored in attachments
 */
export interface VersionMetadata {
  type: 'version-metadata';
  version: number;
  previousVersion?: SHA256Hash<ChatMessage>;
  editedAt?: string;
  editReason?: string;
  isRetracted?: boolean;
  retractedAt?: string;
  retractReason?: string;
}

export class VersionedMessage {
  message: VersionedChatMessage;
  versionMetadata: VersionMetadata;
  id: any
  version: any
  versionId: any
  format: any
  subjects: any
  keywords: any
  attachments: any
  author: any
  timestamp: any
  trustLevel: any

  constructor(data: any) {
    // Extract version metadata from attachments if it exists
    const attachments = data.attachments || [];
    const versionAttachment = attachments.find((a: any) => a.type === 'version-metadata');

    this.versionMetadata = versionAttachment?.data || {
      type: 'version-metadata',
      version: data.version || 1,
      previousVersion: data.previousVersion,
      editedAt: data.editedAt,
      editReason: data.editReason,
      isRetracted: data.isRetracted || false,
      retractedAt: data.retractedAt,
      retractReason: data.retractReason
    };

    this.message = {
      text: data.text,
      author: data.author,
      timestamp: data.timestamp || Date.now(),
      subjects: data.subjects || [],
      keywords: data.keywords || [],
      attachments: attachments
    } as unknown as VersionedChatMessage;
  }

  /**
   * Create an edited version of this message
   */
  createEditedVersion(newText: string, editReason: string | null = null): VersionedMessage {
    return new VersionedMessage({
      id: this.id, // Keep original ID
      versionId: generateVersionId(),
      version: this.version + 1,
      previousVersion: this.versionId, // Link to current version

      text: newText,
      format: this.format,
      subjects: this.subjects,
      keywords: this.keywords,
      attachments: this.attachments,

      author: this.author,
      timestamp: this.timestamp, // Keep original timestamp
      editedAt: new Date().toISOString(),
      editReason,

      isRetracted: false, // Edits clear retraction
      trustLevel: this.trustLevel
    });
  }

  /**
   * Create a retraction marker for this message
   */
  createRetraction(reason: string | null = null): VersionedMessage {
    return new VersionedMessage({
      id: this.id,
      versionId: generateVersionId(),
      version: this.version + 1,
      previousVersion: this.versionId,

      text: '[Message retracted]',
      format: 'plain',
      subjects: [],
      keywords: [],
      attachments: [], // Attachments not included in retraction

      author: this.author,
      timestamp: this.timestamp,

      isRetracted: true,
      retractedAt: new Date().toISOString(),
      retractReason: reason,

      trustLevel: this.trustLevel
    });
  }
}

/**
 * Message Version Manager
 * Handles version chains and retrieval
 */
export class MessageVersionManager {
  public channelManager: any;
  versionCache: Map<string, any[]>;
  latestVersions: Map<string, SHA256Hash<ChatMessage>>;

  constructor(channelManager: any) {
    this.channelManager = channelManager;
    this.versionCache = new Map(); // messageId -> version chain
    this.latestVersions = new Map(); // messageId -> latest version hash
  }

  /**
   * Store a new message or version
   */
  async storeMessage(message: any): Promise<any> {
    // Store in ONE.core using dynamic import
    const { storeUnversionedObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
    const result = await storeUnversionedObject(message as unknown as OneUnversionedObjectTypes);
    const hash = result.hash as SHA256Hash<ChatMessage>;

    // Update version tracking
    if (!this.versionCache.has(message.id)) {
      this.versionCache.set(message.id, []);
    }

    this.versionCache.get(message.id)!.push({
      hash,
      version: message.version,
      timestamp: message.editedAt || message.timestamp,
      isRetracted: message.isRetracted
    });

    // Update latest version
    this.latestVersions.set(message.id, hash);

    console.log(`[MessageVersioning] Stored message ${message.id} v${message.version}: ${hash.toString().substring(0, 8)}...`);

    return hash;
  }

  /**
   * Get the latest version of a message
   */
  async getLatestVersion(messageId: any): Promise<any> {
    const latestHash = this.latestVersions.get(messageId);
    if (!latestHash) {
      return null;
    }

    try {
      const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
      const message = await getObject(latestHash);
      return message;
    } catch (error) {
      console.error(`[MessageVersioning] Failed to get message ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Get all versions of a message
   */
  async getVersionHistory(messageId: any): Promise<any> {
    const versionChain = this.versionCache.get(messageId);
    if (!versionChain) {
      return [];
    }

    const { getObject } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
    const versions = [];

    for (const versionInfo of versionChain) {
      try {
        const message = await getObject(versionInfo.hash);
        versions.push({
          ...message,
          hash: versionInfo.hash
        });
      } catch (error) {
        console.warn(`[MessageVersioning] Could not retrieve version ${versionInfo.hash}:`, error);
      }
    }

    return versions.sort((a, b) => ((a as any).version || 0) - ((b as any).version || 0));
  }

  /**
   * Edit a message (creates new version)
   */
  async editMessage(messageId: any, newText: any, editReason = null): Promise<unknown> {
    const currentMessage = await this.getLatestVersion(messageId);
    if (!currentMessage) {
      throw new Error(`Message ${messageId} not found`);
    }

    if (currentMessage.isRetracted) {
      throw new Error('Cannot edit a retracted message');
    }

    // Create edited version
    const editedMessage = currentMessage.createEditedVersion(newText, editReason);

    // Store new version
    const hash = await this.storeMessage(editedMessage);

    // Notify listeners
    this.notifyVersionChange(messageId, editedMessage, 'edited');

    return {
      hash,
      message: editedMessage
    };
  }

  /**
   * Retract a message (soft delete)
   */
  async retractMessage(messageId: any, reason = null): Promise<unknown> {
    const currentMessage = await this.getLatestVersion(messageId);
    if (!currentMessage) {
      throw new Error(`Message ${messageId} not found`);
    }

    if (currentMessage.isRetracted) {
      console.warn(`Message ${messageId} is already retracted`);
      return null;
    }

    // Create retraction marker
    const retraction = currentMessage.createRetraction(reason);

    // Store retraction
    const hash = await this.storeMessage(retraction);

    // Notify listeners
    this.notifyVersionChange(messageId, retraction, 'retracted');

    return {
      hash,
      message: retraction
    };
  }

  /**
   * Build version chain from channel data
   */
  async buildVersionChain(channelId: any): Promise<any> {
    console.log(`[MessageVersioning] Building version chain for channel ${channelId}`);

    // Get all messages from channel
    const messages = await this.channelManager.getChannelMessages(channelId);

    // Group by message ID
    const messageGroups = new Map();

    for (const msg of messages) {
      if (!messageGroups.has(msg.id)) {
        messageGroups.set(msg.id, []);
      }
      messageGroups.get(msg.id).push(msg);
    }

    // Build chains
    for (const [messageId, versions] of messageGroups) {
      // Sort by version number
      versions.sort((a: any, b: any) => a.version - b.version);

      // Cache the chain
      this.versionCache.set(messageId, versions.map((v: any) => ({
        hash: v.hash,
        version: v.version,
        timestamp: v.editedAt || v.timestamp,
        isRetracted: v.isRetracted
      })));

      // Set latest version
      const latest = versions[versions.length - 1];
      this.latestVersions.set(messageId, latest.hash);
    }

    console.log(`[MessageVersioning] Built ${messageGroups.size} message chains`);
  }

  /**
   * Notify listeners of version changes
   * TODO: Implement IPC-based notification to UI if needed
   */
  notifyVersionChange(messageId: any, newVersion: any, changeType: any): any {
    // Main process cannot dispatch window events - would need IPC here
    // For now, just log
    console.log('[MessageVersioning] Version change:', { messageId, newVersion, changeType });
  }

  /**
   * Get display version of message (handles retraction)
   */
  async getDisplayMessage(messageId: any): Promise<any> {
    const message = await this.getLatestVersion(messageId);

    if (!message) {
      return null;
    }

    if (message.isRetracted) {
      // Return sanitized retracted message
      return {
        ...message,
        text: `[Message retracted${message.retractReason ? ': ' + message.retractReason : ''}]`,
        attachments: [],
        subjects: [],
        keywords: []
      };
    }

    return message;
  }
}

/**
 * Generate unique version ID
 */
function generateVersionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Export for use in chat handlers
 */
export default {
  VersionedMessage,
  MessageVersionManager
};