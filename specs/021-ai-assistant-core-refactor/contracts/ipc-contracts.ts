/**
 * IPC Contract Definitions
 *
 * CRITICAL: These signatures MUST NOT CHANGE during refactoring.
 * They define the contract between Electron renderer and main process.
 *
 * Any changes to these interfaces constitute breaking changes and require
 * coordinated UI updates.
 */

import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';

/**
 * AI-related IPC handlers
 * Channel prefix: 'ai:'
 */
export interface AIIPCHandlers {
  /**
   * Process a message in an AI topic
   * Channel: 'ai:processMessage'
   */
  'ai:processMessage': {
    request: {
      topicId: string;
      message: string;
      senderId: SHA256IdHash<Person>;
    };
    response: {
      messageId: string;
      response: string | null;
      error?: string;
    };
  };

  /**
   * Check if a topic is an AI topic
   * Channel: 'ai:isAITopic'
   */
  'ai:isAITopic': {
    request: {
      topicId: string;
    };
    response: boolean;
  };

  /**
   * Get model ID for a topic
   * Channel: 'ai:getModelIdForTopic'
   */
  'ai:getModelIdForTopic': {
    request: {
      topicId: string;
    };
    response: string | null;
  };

  /**
   * Ensure default AI chats exist (Hi and LAMA)
   * Channel: 'ai:ensureDefaultChats'
   */
  'ai:ensureDefaultChats': {
    request: void;
    response: {
      success: boolean;
      error?: string;
    };
  };

  /**
   * Get topic display name
   * Channel: 'ai:getTopicDisplayName'
   */
  'ai:getTopicDisplayName': {
    request: {
      topicId: string;
    };
    response: string | undefined;
  };

  /**
   * Set topic display name
   * Channel: 'ai:setTopicDisplayName'
   */
  'ai:setTopicDisplayName': {
    request: {
      topicId: string;
      name: string;
    };
    response: void;
  };

  /**
   * Set default AI model
   * Channel: 'ai:setDefaultModel'
   */
  'ai:setDefaultModel': {
    request: {
      modelId: string;
    };
    response: void;
  };

  /**
   * Get default AI model
   * Channel: 'ai:getDefaultModel'
   */
  'ai:getDefaultModel': {
    request: void;
    response: {
      id: string;
      name: string;
      displayName?: string;
    } | null;
  };
}

/**
 * LLM-related IPC handlers
 * Channel prefix: 'llm:'
 */
export interface LLMIPCHandlers {
  /**
   * Get available LLM models
   * Channel: 'llm:getAvailableModels'
   */
  'llm:getAvailableModels': {
    request: void;
    response: Array<{
      id: string;
      name: string;
      displayName?: string;
      provider: string;
      contextLength: number;
    }>;
  };

  /**
   * Load a model
   * Channel: 'llm:loadModel'
   */
  'llm:loadModel': {
    request: {
      modelId: string;
    };
    response: {
      success: boolean;
      contextId?: string;
      error?: string;
    };
  };

  /**
   * Unload a model
   * Channel: 'llm:unloadModel'
   */
  'llm:unloadModel': {
    request: {
      modelId: string;
    };
    response: {
      success: boolean;
      error?: string;
    };
  };

  /**
   * Check if model is loaded
   * Channel: 'llm:isModelLoaded'
   */
  'llm:isModelLoaded': {
    request: {
      modelId: string;
    };
    response: boolean;
  };
}

/**
 * Chat-related IPC handlers that interact with AI
 * Channel prefix: 'chat:'
 */
export interface ChatIPCHandlers {
  /**
   * Send a message (may trigger AI response if AI topic)
   * Channel: 'chat:sendMessage'
   */
  'chat:sendMessage': {
    request: {
      topicId: string;
      message: string;
      senderId: SHA256IdHash<Person>;
    };
    response: {
      messageId: string;
      success: boolean;
      error?: string;
    };
  };
}

/**
 * Events emitted from main to renderer
 * These are one-way notifications (no response)
 */
export interface AIIPCEvents {
  /**
   * AI is thinking (processing message)
   * Channel: 'message:thinking'
   */
  'message:thinking': {
    conversationId: string;
    messageId: string;
    senderId: SHA256IdHash<Person>;
    isAI: boolean;
  };

  /**
   * AI response chunk (streaming)
   * Channel: 'message:stream'
   */
  'message:stream': {
    conversationId: string;
    messageId: string;
    chunk: string;
    partial: string;
    senderId: SHA256IdHash<Person>;
    isAI: boolean;
  };

  /**
   * Message completed
   * Channel: 'message:updated'
   */
  'message:updated': {
    conversationId: string;
    message: {
      id: string;
      conversationId: string;
      text: string;
      senderId: SHA256IdHash<Person>;
      isAI: boolean;
      timestamp: string;
      status: 'pending' | 'sent' | 'error';
    };
  };

  /**
   * AI error occurred
   * Channel: 'ai:error'
   */
  'ai:error': {
    conversationId: string;
    error: string;
  };

  /**
   * Subjects updated for a topic
   * Channel: 'subjects:updated'
   */
  'subjects:updated': {
    topicId: string;
    subject: {
      id: string;
      name: string;
      description: string;
      keywords: string[];
    };
  };

  /**
   * Keywords updated for a topic
   * Channel: 'keywords:updated'
   */
  'keywords:updated': {
    topicId: string;
  };
}

/**
 * Type-safe IPC handler implementation helper
 *
 * Example usage in lama.electron/main/ipc/handlers/ai.ts:
 *
 * ```typescript
 * import type { AIIPCHandlers } from '@lama/specs/contracts/ipc-contracts';
 * import { AIHandler } from '@lama/core/handlers/AIHandler';
 *
 * type AIHandlerFn<K extends keyof AIIPCHandlers> = (
 *   event: any,
 *   request: AIIPCHandlers[K]['request']
 * ) => Promise<AIIPCHandlers[K]['response']>;
 *
 * const aiHandler = new AIHandler({ ... });
 * await aiHandler.init();
 *
 * export const processMessage: AIHandlerFn<'ai:processMessage'> = async (
 *   event,
 *   { topicId, message, senderId }
 * ) => {
 *   try {
 *     const response = await aiHandler.processMessage(topicId, message, senderId);
 *     return {
 *       messageId: `ai-${Date.now()}`,
 *       response,
 *     };
 *   } catch (error) {
 *     return {
 *       messageId: `ai-${Date.now()}`,
 *       response: null,
 *       error: error.message,
 *     };
 *   }
 * };
 *
 * export const isAITopic: AIHandlerFn<'ai:isAITopic'> = async (
 *   event,
 *   { topicId }
 * ) => {
 *   return aiHandler.isAITopic(topicId);
 * };
 * ```
 */

/**
 * Contract Verification
 *
 * The following tests MUST pass before merging refactoring:
 *
 * ```typescript
 * describe('IPC Contract Verification', () => {
 *   it('ai:processMessage maintains signature', async () => {
 *     const request: AIIPCHandlers['ai:processMessage']['request'] = {
 *       topicId: 'test-topic',
 *       message: 'Hello',
 *       senderId: 'person-123' as any,
 *     };
 *
 *     const response = await ipcHandler.processMessage(null, request);
 *
 *     // Response must match contract exactly
 *     expect(response).toHaveProperty('messageId');
 *     expect(response).toHaveProperty('response');
 *     expect(typeof response.messageId).toBe('string');
 *     expect(typeof response.response === 'string' || response.response === null).toBe(true);
 *   });
 *
 *   // Similar tests for all other IPC handlers...
 * });
 * ```
 */
