/**
 * Common type aliases for ONE.core types used throughout the application
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type {
  Person,
  Group,
  Recipe,
  Instance,
  Access,
  IdAccess,
  Chum
} from '@refinio/one.core/lib/recipes.js';

// ChatMessage is in one.models, not one.core
import type { ChatMessage } from '@refinio/one.models/lib/recipes/ChatRecipes.js';
import type ChannelManager from '@refinio/one.models/lib/models/ChannelManager.js';
type ChannelInfo = any;

// Person ID types
export type PersonId = SHA256IdHash<Person>;
export type PersonIdString = string; // When we need to pass person IDs as strings

// Channel types
export type ChannelId = string;
export type ChannelHash = SHA256Hash<ChannelInfo>;
export type ChannelOwner = PersonId | null | undefined;

// Message types
export type MessageHash = SHA256Hash<ChatMessage>;
export type MessageId = string;

// Group types
export type GroupHash = SHA256IdHash<Group>;

// Object hashes
export type ObjectHash = SHA256Hash<any>;
export type ObjectIdHash = SHA256IdHash<any>;

// Instance types
export type InstanceId = SHA256IdHash<Instance>;

// Access types
export type AccessHash = SHA256IdHash<Access>;
export type IdAccessHash = SHA256IdHash<IdAccess>;

// Recipe types
export type RecipeHash = SHA256IdHash<Recipe>;

// Common return types
export type AsyncResult<T> = Promise<T>;
export type AsyncBoolean = Promise<boolean>;
export type AsyncVoid = Promise<void>;

// Error handling
export interface OneError {
  code: string;
  message: string;
  details?: unknown;
}

// Callback types
export type Callback<T> = (data: T) => void;
export type AsyncCallback<T> = (data: T) => Promise<void>;
export type ErrorCallback = (error: OneError) => void;

// Event types
export interface OneEvent<T = unknown> {
  type: string;
  data: T;
  timestamp: number;
  source?: string;
}

// Storage types
export interface StorageResult {
  hash: ObjectHash;
  idHash?: ObjectIdHash;
  success: boolean;
}

// Channel entry types
export interface ChannelEntry {
  channelEntryHash: ObjectHash;
  dataHash: ObjectHash;
  creationTimeHash: ObjectHash;
  data: unknown;
}

// Connection types
export interface PeerConnection {
  peerId: string;
  personId: PersonId;
  instanceId: InstanceId;
  connected: boolean;
  lastSeen: number;
}