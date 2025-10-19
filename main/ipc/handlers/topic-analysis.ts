/**
 * Topic Analysis IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to TopicAnalysisHandler methods.
 * Business logic lives in ../../../lama.core/handlers/TopicAnalysisHandler.ts
 */

import { TopicAnalysisHandler } from '@lama/core/handlers/TopicAnalysisHandler.js';
import nodeOneCoreInstance from '../../core/node-one-core.js';
import llmManager from '../../services/llm-manager.js';
import type { IpcMainInvokeEvent } from 'electron';

// Create handler instance
const topicAnalysisHandler = new TopicAnalysisHandler(
  nodeOneCoreInstance.topicAnalysisModel as any,
  nodeOneCoreInstance.topicModel as any,
  llmManager,
  nodeOneCoreInstance
);

// Initialize handler with models after nodeOneCore is ready
if (nodeOneCoreInstance.initialized && nodeOneCoreInstance.topicAnalysisModel) {
  topicAnalysisHandler.setModels(
    nodeOneCoreInstance.topicAnalysisModel as any,
    nodeOneCoreInstance.topicModel as any,
    llmManager,
    nodeOneCoreInstance
  );
}

/**
 * Thin IPC adapter - maps ipcMain.handle() calls to handler methods
 */
const topicAnalysisHandlers = {
  /**
   * Analyze messages to extract subjects and keywords
   */
  async analyzeMessages(
    event: IpcMainInvokeEvent,
    { topicId, messages, forceReanalysis = false }: {
      topicId: string;
      messages?: any[];
      forceReanalysis?: boolean;
    }
  ) {
    return await topicAnalysisHandler.analyzeMessages({
      topicId,
      messages,
      forceReanalysis
    });
  },

  /**
   * Get all subjects for a topic
   */
  async getSubjects(
    event: IpcMainInvokeEvent,
    { topicId, includeArchived = false }: {
      topicId: string;
      includeArchived?: boolean;
    }
  ) {
    return await topicAnalysisHandler.getSubjects({
      topicId,
      includeArchived
    });
  },

  /**
   * Get summary for a topic
   */
  async getSummary(
    event: IpcMainInvokeEvent,
    { topicId, version, includeHistory = false }: {
      topicId: string;
      version?: number;
      includeHistory?: boolean;
    }
  ) {
    return await topicAnalysisHandler.getSummary({
      topicId,
      version,
      includeHistory
    });
  },

  /**
   * Generate conversation restart context for LLM continuity
   */
  async getConversationRestartContext(
    event: IpcMainInvokeEvent,
    { topicId }: { topicId: string }
  ) {
    return await topicAnalysisHandler.getConversationRestartContext({
      topicId
    });
  },

  /**
   * Update or create summary for a topic
   */
  async updateSummary(
    event: IpcMainInvokeEvent,
    { topicId, content, changeReason, autoGenerate = false }: {
      topicId: string;
      content?: string;
      changeReason?: string;
      autoGenerate?: boolean;
    }
  ) {
    // Helper function to get messages for auto-generate
    const chatHandlerGetMessages = async (params: { conversationId: string; limit?: number }) => {
      const chatHandlers = await import('./chat.js');
      return await chatHandlers.default.getMessages(event, params);
    };

    return await topicAnalysisHandler.updateSummary(
      { topicId, content, changeReason, autoGenerate },
      chatHandlerGetMessages
    );
  },

  /**
   * Extract keywords from text using LLM
   */
  async extractKeywords(
    event: IpcMainInvokeEvent,
    { text, limit = 10 }: {
      text: string;
      limit?: number;
    }
  ) {
    return await topicAnalysisHandler.extractKeywords({
      text,
      limit
    });
  },

  /**
   * Merge two subjects into one
   */
  async mergeSubjects(
    event: IpcMainInvokeEvent,
    { topicId, subjectId1, subjectId2 }: {
      topicId: string;
      subjectId1: string;
      subjectId2: string;
    }
  ) {
    return await topicAnalysisHandler.mergeSubjects({
      topicId,
      subjectId1,
      subjectId2
    });
  },

  /**
   * Extract single-word keywords for real-time display
   */
  async extractRealtimeKeywords(
    event: IpcMainInvokeEvent,
    { text, existingKeywords = [], maxKeywords = 15 }: {
      text: string;
      existingKeywords?: string[];
      maxKeywords?: number;
    }
  ) {
    return await topicAnalysisHandler.extractRealtimeKeywords({
      text,
      existingKeywords,
      maxKeywords
    });
  },

  /**
   * Extract keywords from all messages in a conversation
   */
  async extractConversationKeywords(
    event: IpcMainInvokeEvent,
    { topicId, messages = [], maxKeywords = 15 }: {
      topicId: string;
      messages?: any[];
      maxKeywords?: number;
    }
  ) {
    // Helper function to get messages
    const chatHandlerGetMessages = async (params: { conversationId: string }) => {
      const chatHandlers = await import('./chat.js');
      return await chatHandlers.default.getMessages(event, params);
    };

    return await topicAnalysisHandler.extractConversationKeywords(
      { topicId, messages, maxKeywords },
      chatHandlerGetMessages
    );
  },

  /**
   * Get all keywords for a topic
   */
  async getKeywords(
    event: IpcMainInvokeEvent,
    params: { topicId: string; limit?: number }
  ) {
    return await topicAnalysisHandler.getKeywords({
      topicId: params.topicId,
      limit: params.limit
    });
  }
};

// Export handlers
export const {
  analyzeMessages,
  getSubjects,
  getSummary,
  getConversationRestartContext,
  updateSummary,
  extractKeywords,
  mergeSubjects,
  extractRealtimeKeywords,
  extractConversationKeywords
} = topicAnalysisHandlers;

export default topicAnalysisHandlers;
