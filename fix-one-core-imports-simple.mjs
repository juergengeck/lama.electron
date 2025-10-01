#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

console.log('Fixing ONE.core and ONE.models imports...\n');

// Focus on main TypeScript files only
const directories = ['./main', './electron-ui/src'];
const tsFiles = [];

function findTsFiles(dir) {
  if (!fs.existsSync(dir)) return;

  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory() && !item.includes('node_modules')) {
      findTsFiles(fullPath);
    } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
      tsFiles.push(fullPath);
    }
  }
}

directories.forEach(findTsFiles);

console.log(`Found ${tsFiles.length} TypeScript files to check\n`);

let fixedCount = 0;

// First, fix main/types/common.ts specifically
const commonTypesFile = './main/types/common.ts';
if (fs.existsSync(commonTypesFile)) {
  let content = fs.readFileSync(commonTypesFile, 'utf8');

  // Fix the imports
  content = `/**
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
import type { ChannelInfo } from '@refinio/one.models/lib/models/ChannelManager.js';

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
}`;

  fs.writeFileSync(commonTypesFile, content);
  console.log('Fixed main/types/common.ts');
  fixedCount++;
}

// Now fix other files
for (const file of tsFiles) {
  if (file === commonTypesFile) continue; // Already fixed

  let content = fs.readFileSync(file, 'utf8');
  let modified = false;

  // Fix getObjectByIdHash - doesn't exist
  if (content.includes('getObjectByIdHash')) {
    content = content.replace(/getObjectByIdHash/g, 'getObjectByHash');
    modified = true;
  }

  // Fix duplicate ChannelManager imports
  if (content.includes('type ChannelManager = ChannelManager')) {
    content = content.replace(
      /type ChannelManager = ChannelManager/g,
      'type ChannelManagerType = ChannelManager'
    );
    modified = true;
  }

  // Fix SomeoneModel import path
  if (content.includes('SomeoneModel') && content.includes('@refinio/one.models')) {
    content = content.replace(
      /'@refinio\/one\.models\/lib\/models\/index\.js'/g,
      "'@refinio/one.models/lib/models/Leute/SomeoneModel.js'"
    );
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(file, content);
    console.log(`Fixed ${path.relative('.', file)}`);
    fixedCount++;
  }
}

// Fix main/types/one-core.ts to remove duplicate type definitions
const oneCoreTypesFile = './main/types/one-core.ts';
if (fs.existsSync(oneCoreTypesFile)) {
  let content = `import type { ChannelManager, ConnectionsModel, LeuteModel } from '@refinio/one.models/lib/models/index.js';
import type { SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js';
import type { Person } from '@refinio/one.core/lib/recipes.js';
import type { Instance } from '../core/instance';
import type { TopicModel } from '../core/topic-model';

// Main NodeOneCore interface
export interface NodeOneCore {
  initialized: boolean;
  instanceName: string;
  ownerId: SHA256IdHash<Person>;
  channelManager: ChannelManager;
  connectionsModel: ConnectionsModel;
  leuteModel: LeuteModel;
  instance: Instance;
  topicModel: TopicModel;

  // Additional properties
  [key: string]: any;
}

// Topic Model interface
export interface TopicModel {
  getMessages(topicId: string, limit: number): Promise<any[]>;
  enterTopicRoom(topicId: string): Promise<TopicRoom | null>;
}

// Topic Room interface
export interface TopicRoom {
  retrieveAllMessages(): Promise<any[]>;
  sendMessage(text: string, author: SHA256IdHash<Person>, channelOwner?: SHA256IdHash<Person> | null): Promise<void>;
  topic: {
    name: string;
  };
}`;

  fs.writeFileSync(oneCoreTypesFile, content);
  console.log('Fixed main/types/one-core.ts');
  fixedCount++;
}

console.log(`\nFixed ${fixedCount} files total`);