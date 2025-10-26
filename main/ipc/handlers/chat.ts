/**
 * Chat IPC Handlers
 * Thin adapter that delegates to chat.core ChatHandler
 */

import type { IpcMainInvokeEvent } from 'electron';
import { ChatHandler } from '@chat/core/handlers/ChatHandler.js';
import stateManager from '../../state/manager.js';
import nodeProvisioning from '../../services/node-provisioning.js';
import nodeOneCore from '../../core/node-one-core.js';
import { MessageVersionManager } from '../../core/message-versioning.js';
import { MessageAssertionManager } from '../../core/message-assertion-certificates.js';
import electron from 'electron';
const { BrowserWindow } = electron;

// Message version manager instance
let messageVersionManager: MessageVersionManager | null = null;

// Message assertion manager instance
let messageAssertionManager: MessageAssertionManager | null = null;

// Initialize ChatHandler with dependencies
const chatHandler = new ChatHandler(nodeOneCore, stateManager, messageVersionManager, messageAssertionManager);

// Initialize message managers when they become available
function initializeMessageManagers() {
  if (!messageVersionManager && nodeOneCore.channelManager) {
    messageVersionManager = new MessageVersionManager(nodeOneCore.channelManager);
  }
  if (!messageAssertionManager && nodeOneCore.leuteModel && nodeOneCore.leuteModel.trust) {
    messageAssertionManager = new MessageAssertionManager(nodeOneCore.leuteModel.trust, nodeOneCore.leuteModel);
  }
  if (messageVersionManager && messageAssertionManager) {
    chatHandler.setMessageManagers(messageVersionManager, messageAssertionManager);
  }
}

// IPC parameter interfaces
interface SendMessageParams {
  conversationId: string;
  text: string;
  attachments?: any[];
}

interface GetMessagesParams {
  conversationId: string;
  limit?: number;
  offset?: number;
}

interface CreateConversationParams {
  type?: string;
  participants?: any[];
  name?: string | null;
}

interface GetConversationsParams {
  limit?: number;
  offset?: number;
}

interface GetConversationParams {
  conversationId: string;
}

interface AddParticipantsParams {
  conversationId: string;
  participantIds: string[];
}

interface ClearConversationParams {
  conversationId: string;
}

interface EditMessageParams {
  messageId: string;
  conversationId: string;
  newText: string;
  editReason?: string;
}

interface DeleteMessageParams {
  messageId: string;
  conversationId: string;
  reason?: string;
}

interface GetMessageHistoryParams {
  messageId: string;
}

interface ExportMessageCredentialParams {
  messageId: string;
}

interface VerifyMessageAssertionParams {
  certificateHash: string;
  messageHash: string;
}

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  messages?: any[];
  total?: number;
  hasMore?: boolean;
  message?: string;
  [key: string]: any;
}

const chatHandlers = {
  async initializeDefaultChats(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    const response = await chatHandler.initializeDefaultChats({});
    return { success: response.success, error: response.error };
  },

  async uiReady(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    // Platform-specific: Update PeerMessageListener with current window
    if (nodeOneCore.peerMessageListener) {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        nodeOneCore.peerMessageListener.setMainWindow(mainWindow);
        console.log('[ChatHandler] Updated PeerMessageListener with current window');
      }
    }

    const response = await chatHandler.uiReady({});
    return { success: response.success, error: response.error };
  },

  async sendMessage(event: IpcMainInvokeEvent, { conversationId, text, attachments = [] }: SendMessageParams): Promise<IpcResponse> {
    const response = await chatHandler.sendMessage({
      conversationId,
      content: text,  // Map 'text' to 'content'
      attachments
    });
    return {
      success: response.success,
      data: response.data,
      error: response.error
    };
  },

  async getMessages(event: IpcMainInvokeEvent, { conversationId, limit = 50, offset = 0 }: GetMessagesParams): Promise<IpcResponse> {
    const response = await chatHandler.getMessages({ conversationId, limit, offset });
    return {
      success: response.success,
      messages: response.messages,
      total: response.total,
      hasMore: response.hasMore,
      error: response.error
    };
  },

  async createConversation(event: IpcMainInvokeEvent, { type = 'direct', participants = [], name = null }: CreateConversationParams): Promise<IpcResponse> {
    const response = await chatHandler.createConversation({ type, participants, name });
    return {
      success: response.success,
      data: response.data,
      error: response.error
    };
  },

  async getConversations(event: IpcMainInvokeEvent, { limit = 20, offset = 0 }: GetConversationsParams = {}): Promise<IpcResponse> {
    const response = await chatHandler.getConversations({ limit, offset });
    return {
      success: response.success,
      data: response.data,
      error: response.error
    };
  },

  async getConversation(event: IpcMainInvokeEvent, { conversationId }: GetConversationParams): Promise<any> {
    const response = await chatHandler.getConversation({ conversationId });
    return {
      success: response.success,
      data: response.data,
      error: response.error
    };
  },

  async getCurrentUser(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    const response = await chatHandler.getCurrentUser({});
    return {
      success: response.success,
      user: response.user,
      error: response.error
    };
  },

  async addParticipants(event: IpcMainInvokeEvent, { conversationId, participantIds }: AddParticipantsParams): Promise<IpcResponse> {
    const response = await chatHandler.addParticipants({ conversationId, participantIds });
    return {
      success: response.success,
      data: response.data,
      error: response.error
    };
  },

  async clearConversation(event: IpcMainInvokeEvent, { conversationId }: ClearConversationParams): Promise<IpcResponse> {
    // Initialize message managers if needed
    initializeMessageManagers();

    const response = await chatHandler.clearConversation({ conversationId });
    return {
      success: response.success,
      error: response.error
    };
  },

  async editMessage(event: IpcMainInvokeEvent, { messageId, conversationId, newText, editReason }: EditMessageParams): Promise<IpcResponse> {
    // Initialize message managers if needed
    initializeMessageManagers();

    const response = await chatHandler.editMessage({ messageId, conversationId, newText, editReason });
    return {
      success: response.success,
      data: response.data,
      error: response.error
    };
  },

  async deleteMessage(event: IpcMainInvokeEvent, { messageId, conversationId, reason }: DeleteMessageParams): Promise<IpcResponse> {
    // Initialize message managers if needed
    initializeMessageManagers();

    const response = await chatHandler.deleteMessage({ messageId, conversationId, reason });
    return {
      success: response.success,
      error: response.error
    };
  },

  async getMessageHistory(event: IpcMainInvokeEvent, { messageId }: GetMessageHistoryParams): Promise<IpcResponse> {
    // Initialize message managers if needed
    initializeMessageManagers();

    const response = await chatHandler.getMessageHistory({ messageId });
    return {
      success: response.success,
      history: response.history,
      error: response.error
    };
  },

  async exportMessageCredential(event: IpcMainInvokeEvent, { messageId }: ExportMessageCredentialParams): Promise<IpcResponse> {
    // Initialize message managers if needed
    initializeMessageManagers();

    const response = await chatHandler.exportMessageCredential({ messageId });
    return {
      success: response.success,
      credential: response.credential,
      error: response.error
    };
  },

  async verifyMessageAssertion(event: IpcMainInvokeEvent, { certificateHash, messageHash }: VerifyMessageAssertionParams): Promise<IpcResponse> {
    // Initialize message managers if needed
    initializeMessageManagers();

    const response = await chatHandler.verifyMessageAssertion({ certificateHash, messageHash });
    return {
      success: response.success,
      valid: response.valid,
      error: response.error
    };
  }
};

export { chatHandlers, chatHandler };
