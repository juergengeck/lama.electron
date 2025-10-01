import type { ChannelManager, ConnectionsModel, LeuteModel } from '@refinio/one.models/lib/models/index.js';
import type TopicModel from '@refinio/one.models/lib/models/Chat/TopicModel.js';
import type TopicRoom from '@refinio/one.models/lib/models/Chat/TopicRoom.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';

// LLM Manager type (local service, not from ONE.core)
export interface LLMManager {
  getAvailableModels(): any[];
  chat(messages: any[], modelId: string): Promise<string>;
  chatWithAnalysis?(messages: any[], modelId: string, options?: any): Promise<any>;
  registerPrivateVariantForModel?(modelId: string): void;
  getModel?(modelId: string): any;
}

// Main NodeOneCore interface
export interface NodeOneCore {
  initialized: boolean;
  instanceName: string;
  ownerId: SHA256IdHash<Person>;
  channelManager: ChannelManager;
  connectionsModel: ConnectionsModel;
  leuteModel: LeuteModel;
  instance: any; // Instance type from one.core
  topicModel: TopicModel;

  // Additional properties for backward compatibility
  [key: string]: any;
}

// Topic Group Manager interface
export interface TopicGroupManager {
  createTopicGroup(name: string, participants: SHA256IdHash<Person>[]): Promise<any>;
  getTopicGroups(): Promise<any[]>;
  getTopicGroup(groupId: string): Promise<any>;
  addParticipantToGroup(groupId: string, participantId: SHA256IdHash<Person>): Promise<void>;
  removeParticipantFromGroup(groupId: string, participantId: SHA256IdHash<Person>): Promise<void>;
}

// Re-export the actual TopicModel and TopicRoom from one.models
export type { TopicModel, TopicRoom };