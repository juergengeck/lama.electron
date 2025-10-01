/**
 * IPC Type Contracts for LAMA Electron
 *
 * These contracts define the type-safe interface between main and renderer processes.
 * All IPC handlers must implement these contracts to ensure type safety.
 */

import type { SHA256IdHash, OneVersionedObjectTypes, VersionedObjectResult } from '@refinio/one.core';

// Base IPC contract interface
export interface IPCContract<Req, Res> {
  channel: string;
  request: Req;
  response: Promise<Res>;
}

// ONE.core initialization
export interface OneCoreInitContract extends IPCContract<
  { credentials: { username: string; password: string } },
  { success: boolean; personId?: SHA256IdHash<any> }
> {
  channel: 'onecore:initializeNode';
}

// Topic operations
export interface TopicCreateContract extends IPCContract<
  { name: string; participants: SHA256IdHash<any>[] },
  { topicId: string; channelId: string }
> {
  channel: 'topics:create';
}

export interface TopicListContract extends IPCContract<
  { filter?: { active?: boolean } },
  Array<{ id: string; name: string; lastMessage?: number }>
> {
  channel: 'topics:list';
}

// Message operations
export interface MessageSendContract extends IPCContract<
  { topicId: string; content: string; analysis?: boolean },
  { messageId: SHA256IdHash<any>; timestamp: number }
> {
  channel: 'messages:send';
}

export interface MessageRetrieveContract extends IPCContract<
  { topicId: string; limit?: number; offset?: number },
  Array<{
    id: SHA256IdHash<any>;
    content: string;
    sender: SHA256IdHash<any>;
    timestamp: number;
  }>
> {
  channel: 'messages:retrieve';
}

// Contact operations
export interface ContactListContract extends IPCContract<
  { includeAI?: boolean },
  Array<{
    personId: SHA256IdHash<any>;
    name: string;
    isAI?: boolean;
  }>
> {
  channel: 'contacts:list';
}

// Type analysis operations
export interface TopicAnalysisContract extends IPCContract<
  { topicId: string; messages: string[] },
  {
    keywords: string[];
    subjects: Array<{ id: string; keywords: string[] }>;
    summary?: string;
  }
> {
  channel: 'topicAnalysis:analyze';
}

// Export operations
export interface ExportHTMLContract extends IPCContract<
  {
    topicId: string;
    includeSignatures?: boolean;
    maxMessages?: number;
  },
  {
    html: string;
    metadata: {
      messageCount: number;
      exportDate: string;
      topicName: string;
    };
  }
> {
  channel: 'export:htmlWithMicrodata';
}

// Type guards for runtime validation (no casts!)
export function isOneCoreInitRequest(value: unknown): value is OneCoreInitContract['request'] {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.credentials === 'object' &&
    obj.credentials !== null &&
    typeof (obj.credentials as any).username === 'string' &&
    typeof (obj.credentials as any).password === 'string'
  );
}

export function isTopicCreateRequest(value: unknown): value is TopicCreateContract['request'] {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    Array.isArray(obj.participants) &&
    obj.participants.every((p: unknown) => typeof p === 'string')
  );
}

export function isMessageSendRequest(value: unknown): value is MessageSendContract['request'] {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.topicId === 'string' &&
    typeof obj.content === 'string' &&
    (obj.analysis === undefined || typeof obj.analysis === 'boolean')
  );
}

// Export all contracts
export type AllIPCContracts =
  | OneCoreInitContract
  | TopicCreateContract
  | TopicListContract
  | MessageSendContract
  | MessageRetrieveContract
  | ContactListContract
  | TopicAnalysisContract
  | ExportHTMLContract;