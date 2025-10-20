/**
 * AIHandler Interface (lama.core/handlers/AIHandler.ts)
 *
 * Main orchestrator for AI operations. Platform-agnostic business logic
 * that receives dependencies via constructor injection.
 */

import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
import type TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import type LeuteModel from '@refinio/one.models/lib/models/Leute/LeuteModel.js';

/**
 * Dependencies required by AIHandler
 */
export interface AIHandlerDependencies {
  /** ONE.core instance (NodeOneCore in Electron, similar in browser) */
  oneCore: any; // Generic ONE.core interface

  /** Channel manager for message channels */
  channelManager: ChannelManager;

  /** Topic model for chat topics */
  topicModel: TopicModel;

  /** Leute model for contacts */
  leuteModel: LeuteModel;

  /** LLM manager for AI model operations */
  llmManager: any; // LLMManager interface

  /** Optional: State manager for platform-specific state (e.g., Electron window events) */
  stateManager?: any;

  /** Optional: LLM object manager */
  llmObjectManager?: any;

  /** Optional: Context enrichment service */
  contextEnrichmentService?: any;

  /** Optional: Topic analysis model */
  topicAnalysisModel?: any;
}

/**
 * AIHandler public interface
 */
export interface IAIHandler {
  /**
   * Initialize the AI handler and all components
   * @throws Error if initialization fails
   */
  init(): Promise<void>;

  /**
   * Ensure default AI chats exist (Hi and LAMA)
   * Creates topics if they don't exist, registers if they do
   */
  ensureDefaultChats(): Promise<void>;

  /**
   * Scan existing conversations for AI participants and register them
   * Rebuilds topic-to-model mappings from ONE.core storage
   */
  scanExistingConversations(): Promise<void>;

  /**
   * Process a message in an AI topic
   * @param topicId - The topic ID
   * @param message - The message text
   * @param senderId - Person ID of the sender
   * @returns AI response text, or null if not an AI topic or error
   */
  processMessage(
    topicId: string,
    message: string,
    senderId: SHA256IdHash<Person>
  ): Promise<string | null>;

  /**
   * Check if a topic is an AI topic
   * @param topicId - The topic ID to check
   * @returns True if the topic has an AI model mapped to it
   */
  isAITopic(topicId: string): boolean;

  /**
   * Get the model ID for a topic
   * @param topicId - The topic ID
   * @returns Model ID or null if not an AI topic
   */
  getModelIdForTopic(topicId: string): string | null;

  /**
   * Check if a person ID is an AI person
   * @param personId - Person ID to check
   * @returns True if the person is an AI contact
   */
  isAIPerson(personId: SHA256IdHash<Person>): boolean;

  /**
   * Get model ID for a given person ID (reverse lookup)
   * @param personId - Person ID to look up
   * @returns Model ID or null if not an AI person
   */
  getModelIdForPersonId(personId: SHA256IdHash<Person>): string | null;

  /**
   * Ensure an AI contact exists for a specific model
   * Creates Person/Profile/Someone if needed
   * @param modelId - The model ID (e.g., "gpt-oss:20b")
   * @returns Person ID hash
   * @throws Error if contact creation fails
   */
  ensureAIContactForModel(modelId: string): Promise<SHA256IdHash<Person>>;

  /**
   * Set the default AI model
   * @param modelId - The model ID to set as default
   */
  setDefaultModel(modelId: string): Promise<void>;

  /**
   * Get the default AI model
   * @returns Model object or null if no default set
   */
  getDefaultModel(): any | null;

  /**
   * Register an AI topic
   * @param topicId - Topic ID
   * @param modelId - Model ID to associate
   */
  registerAITopic(topicId: string, modelId: string): void;

  /**
   * Get topic display name
   * @param topicId - Topic ID
   * @returns Display name or undefined
   */
  getTopicDisplayName(topicId: string): string | undefined;

  /**
   * Set topic display name
   * @param topicId - Topic ID
   * @param name - Display name to set
   */
  setTopicDisplayName(topicId: string, name: string): void;

  /**
   * Handle a new topic creation by sending a welcome message
   * @param topicId - The topic ID
   */
  handleNewTopic(topicId: string): Promise<void>;

  /**
   * Shutdown the AI handler and clean up resources
   */
  shutdown(): Promise<void>;
}

/**
 * Example usage in lama.electron IPC handler:
 *
 * ```typescript
 * // lama.electron/main/ipc/handlers/ai.ts
 * import { AIHandler } from '@lama/core/handlers/AIHandler.js';
 * import nodeOneCore from '../../core/node-one-core.js';
 * import stateManager from '../../state/manager.js';
 *
 * const aiHandler = new AIHandler({
 *   oneCore: nodeOneCore,
 *   channelManager: nodeOneCore.channelManager,
 *   topicModel: nodeOneCore.topicModel,
 *   leuteModel: nodeOneCore.leuteModel,
 *   llmManager: nodeOneCore.llmManager,
 *   stateManager: stateManager,
 *   llmObjectManager: nodeOneCore.llmObjectManager,
 *   contextEnrichmentService: nodeOneCore.contextEnrichmentService,
 *   topicAnalysisModel: nodeOneCore.topicAnalysisModel
 * });
 *
 * await aiHandler.init();
 *
 * export default {
 *   async processMessage(event: any, params: any) {
 *     const { topicId, message, senderId } = params;
 *     return await aiHandler.processMessage(topicId, message, senderId);
 *   },
 *
 *   async isAITopic(event: any, { topicId }: any) {
 *     return aiHandler.isAITopic(topicId);
 *   }
 * };
 * ```
 */
