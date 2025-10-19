/**
 * Chat IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to ChatHandler methods.
 * Business logic lives in ../../../lama.core/handlers/ChatHandler.ts
 */

import { ChatHandler } from '@lama/core/handlers/ChatHandler.js';
import nodeOneCore from '../../core/node-one-core.js';
import stateManager from '../../state/manager.js';
import { MessageVersionManager } from '../../core/message-versioning.js';
import { MessageAssertionManager } from '../../core/message-assertion-certificates.js';
import type { IpcMainInvokeEvent } from 'electron';
import electron from 'electron';
const { BrowserWindow } = electron;

// Message managers
let messageVersionManager: MessageVersionManager | null = null;
let messageAssertionManager: MessageAssertionManager | null = null;

// Create handler instance with Electron-specific dependencies
const chatHandler = new ChatHandler(
  nodeOneCore,
  stateManager,
  messageVersionManager,
  messageAssertionManager
);

// Initialize message managers when nodeOneCore is ready
if (nodeOneCore.initialized) {
  if (!messageVersionManager) {
    messageVersionManager = new MessageVersionManager(nodeOneCore);
    console.log('[ChatAdapter] MessageVersionManager initialized');
  }
  if (!messageAssertionManager) {
    messageAssertionManager = new MessageAssertionManager(nodeOneCore.leuteModel.trust, nodeOneCore.leuteModel);
    console.log('[ChatAdapter] MessageAssertionManager initialized');
  }
  chatHandler.setMessageManagers(messageVersionManager, messageAssertionManager);
}

/**
 * Thin IPC adapter - maps ipcMain.handle() calls to handler methods
 */
const chatHandlers = {
  /**
   * Initialize default chats
   */
  async initializeDefaultChats(event: IpcMainInvokeEvent) {
    return await chatHandler.initializeDefaultChats({});
  },

  /**
   * UI ready signal
   */
  async uiReady(event: IpcMainInvokeEvent) {
    // Platform-specific: Update PeerMessageListener with main window
    if (nodeOneCore.peerMessageListener) {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        nodeOneCore.peerMessageListener.setMainWindow(mainWindow);
        console.log('[ChatAdapter] Updated PeerMessageListener with current window');
      }
    }
    return await chatHandler.uiReady({});
  },

  /**
   * Send a message
   */
  async sendMessage(
    event: IpcMainInvokeEvent,
    params: { conversationId: string; text: string; attachments?: any[] }
  ) {
    return await chatHandler.sendMessage(params);
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(
    event: IpcMainInvokeEvent,
    params: { conversationId: string; limit?: number; offset?: number }
  ) {
    return await chatHandler.getMessages(params);
  },

  /**
   * Create a new conversation
   */
  async createConversation(
    event: IpcMainInvokeEvent,
    params: { type?: string; participants?: any[]; name?: string | null }
  ) {
    return await chatHandler.createConversation(params);
  },

  /**
   * Get all conversations
   */
  async getConversations(
    event: IpcMainInvokeEvent,
    params: { limit?: number; offset?: number } = {}
  ) {
    return await chatHandler.getConversations(params);
  },

  /**
   * Get a single conversation
   */
  async getConversation(
    event: IpcMainInvokeEvent,
    params: { conversationId: string }
  ) {
    return await chatHandler.getConversation(params);
  },

  /**
   * Get current user
   */
  async getCurrentUser(event: IpcMainInvokeEvent) {
    return await chatHandler.getCurrentUser({});
  },

  /**
   * Add participants to a conversation
   */
  async addParticipants(
    event: IpcMainInvokeEvent,
    params: { conversationId: string; participantIds: string[] }
  ) {
    return await chatHandler.addParticipants(params);
  },

  /**
   * Clear a conversation
   */
  async clearConversation(
    event: IpcMainInvokeEvent,
    params: { conversationId: string }
  ) {
    return await chatHandler.clearConversation(params);
  },

  /**
   * Edit a message
   */
  async editMessage(
    event: IpcMainInvokeEvent,
    params: { messageId: string; conversationId: string; newText: string; editReason?: string }
  ) {
    // Ensure message managers are initialized
    if (!messageVersionManager) {
      messageVersionManager = new MessageVersionManager(nodeOneCore);
      chatHandler.setMessageManagers(messageVersionManager, messageAssertionManager!);
    }
    return await chatHandler.editMessage(params);
  },

  /**
   * Delete a message
   */
  async deleteMessage(
    event: IpcMainInvokeEvent,
    params: { messageId: string; conversationId: string; reason?: string }
  ) {
    // Ensure message managers are initialized
    if (!messageVersionManager) {
      messageVersionManager = new MessageVersionManager(nodeOneCore);
      chatHandler.setMessageManagers(messageVersionManager, messageAssertionManager!);
    }
    return await chatHandler.deleteMessage(params);
  },

  /**
   * Get message history
   */
  async getMessageHistory(
    event: IpcMainInvokeEvent,
    params: { messageId: string }
  ) {
    // Ensure message managers are initialized
    if (!messageVersionManager) {
      messageVersionManager = new MessageVersionManager(nodeOneCore);
      chatHandler.setMessageManagers(messageVersionManager, messageAssertionManager!);
    }
    return await chatHandler.getMessageHistory(params);
  },

  /**
   * Export message credential
   */
  async exportMessageCredential(
    event: IpcMainInvokeEvent,
    params: { messageId: string }
  ) {
    // Ensure message managers are initialized
    if (!messageAssertionManager) {
      messageAssertionManager = new MessageAssertionManager(nodeOneCore.leuteModel.trust, nodeOneCore.leuteModel);
      chatHandler.setMessageManagers(messageVersionManager!, messageAssertionManager);
    }
    return await chatHandler.exportMessageCredential(params);
  },

  /**
   * Verify message assertion
   */
  async verifyMessageAssertion(
    event: IpcMainInvokeEvent,
    params: { certificateHash: string; messageHash: string }
  ) {
    // Ensure message managers are initialized
    if (!messageAssertionManager) {
      messageAssertionManager = new MessageAssertionManager(nodeOneCore.leuteModel.trust, nodeOneCore.leuteModel);
      chatHandler.setMessageManagers(messageVersionManager!, messageAssertionManager);
    }
    return await chatHandler.verifyMessageAssertion(params);
  }
};

export default chatHandlers;
