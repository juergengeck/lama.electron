/**
 * IPC Type Contracts for LAMA Electron
 *
 * Type-safe interfaces for main/renderer process communication
 */

import type { SHA256IdHash } from '@refinio/one.core';

// Base IPC contract structure
export interface IPCContract<Req, Res> {
  channel: string;
  request: Req;
  response: Promise<Res>;
}

// Core authentication
export interface OneCoreInitRequest {
  credentials: {
    username: string;
    password: string;
  };
}

export interface OneCoreInitResponse {
  success: boolean;
  personId?: SHA256IdHash<any>;
  error?: string;
}

// Topic operations
export interface TopicCreateRequest {
  name: string;
  participants: SHA256IdHash<any>[];
}

export interface TopicCreateResponse {
  topicId: string;
  channelId: string;
}

export interface TopicListRequest {
  filter?: {
    active?: boolean;
  };
}

export interface TopicListResponse {
  topics: Array<{
    id: string;
    name: string;
    lastMessage?: number;
  }>;
}

// Message operations
export interface MessageSendRequest {
  topicId: string;
  content: string;
  analysis?: boolean;
}

export interface MessageSendResponse {
  messageId: SHA256IdHash<any>;
  timestamp: number;
}

export interface MessageRetrieveRequest {
  topicId: string;
  limit?: number;
  offset?: number;
}

export interface MessageRetrieveResponse {
  messages: Array<{
    id: SHA256IdHash<any>;
    content: string;
    sender: SHA256IdHash<any>;
    timestamp: number;
  }>;
}

// Contact operations
export interface ContactListRequest {
  includeAI?: boolean;
}

export interface ContactListResponse {
  contacts: Array<{
    personId: SHA256IdHash<any>;
    name: string;
    isAI?: boolean;
  }>;
}

// Type analysis
export interface TopicAnalysisRequest {
  topicId: string;
  messages: string[];
}

export interface TopicAnalysisResponse {
  keywords: string[];
  subjects: Array<{
    id: string;
    keywords: string[];
  }>;
  summary?: string;
}

// Export operations
export interface ExportHTMLRequest {
  topicId: string;
  includeSignatures?: boolean;
  maxMessages?: number;
}

export interface ExportHTMLResponse {
  html: string;
  metadata: {
    messageCount: number;
    exportDate: string;
    topicName: string;
  };
}

// Type guards for runtime validation (no casts)
export function isOneCoreInitRequest(value: unknown): value is OneCoreInitRequest {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.credentials === 'object' &&
    obj.credentials !== null &&
    typeof (obj.credentials as any).username === 'string' &&
    typeof (obj.credentials as any).password === 'string'
  );
}

export function isTopicCreateRequest(value: unknown): value is TopicCreateRequest {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    Array.isArray(obj.participants) &&
    obj.participants.every((p: unknown) => typeof p === 'string')
  );
}

export function isMessageSendRequest(value: unknown): value is MessageSendRequest {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.topicId === 'string' &&
    typeof obj.content === 'string' &&
    (obj.analysis === undefined || typeof obj.analysis === 'boolean')
  );
}