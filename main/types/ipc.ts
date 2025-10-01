/**
 * Shared IPC type definitions for LAMA Electron
 * These types are used across main process, preload, and renderer
 */

import type { IpcMainInvokeEvent } from 'electron';

// Re-export for convenience
export type { IpcMainInvokeEvent };

// ============================================================================
// Authentication & User Management
// ============================================================================

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface UserInfo {
  name: string;
  personId?: string;
  instanceId?: string;
}

export interface ProvisionResult {
  success: boolean;
  user?: UserInfo;
  error?: string;
}

// ============================================================================
// Contacts & Connections
// ============================================================================

export interface Contact {
  id: string;
  name: string;
  email?: string;
  personId?: string;
  status?: 'pending' | 'connected' | 'blocked';
  lastSeen?: number;
}

export interface ConnectionInfo {
  id: string;
  status: 'connected' | 'disconnected' | 'connecting';
  remotePersonId: string;
  remoteName?: string;
  established?: number;
}

// ============================================================================
// Chat & Messaging
// ============================================================================

export interface Message {
  id: string;
  content: string;
  author: string;
  timestamp: number;
  topicId: string;
  channelId?: string;
  attachments?: Attachment[];
}

export interface Attachment {
  hash: string;
  name: string;
  size: number;
  mimeType: string;
  thumbnailHash?: string;
}

export interface ChatTopic {
  id: string;
  name: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount?: number;
  created: number;
  modified: number;
}

// ============================================================================
// AI & Assistant
// ============================================================================

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

export interface AIResponse {
  content: string;
  keywords?: string[];
  subjects?: string[];
  confidence?: number;
}

export interface TopicAnalysis {
  topicId: string;
  subjects: Subject[];
  keywords: Keyword[];
  summary?: string;
}

export interface Subject {
  id: string;
  keywords: string[];
  description: string;
  confidence: number;
  messageCount: number;
}

export interface Keyword {
  term: string;
  frequency: number;
  score: number;
  category?: string;
}

// ============================================================================
// Devices & Federation
// ============================================================================

export interface Device {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet' | 'server';
  instanceId: string;
  lastSeen?: number;
  isCurrentDevice?: boolean;
}

export interface Invitation {
  code: string;
  expiresAt: number;
  maxUses?: number;
  currentUses?: number;
}

// ============================================================================
// Export & Import
// ============================================================================

export interface ExportOptions {
  format: 'json' | 'html' | 'markdown' | 'pdf';
  includeAttachments?: boolean;
  includeMetadata?: boolean;
  dateRange?: {
    from: number;
    to: number;
  };
}

export interface ExportResult {
  success: boolean;
  data?: string | Buffer;
  filename?: string;
  error?: string;
}

// ============================================================================
// IPC Channel Names (for type safety)
// ============================================================================

export const IPC_CHANNELS = {
  // Auth
  'auth:login': 'auth:login',
  'auth:logout': 'auth:logout',
  'auth:status': 'auth:status',

  // Contacts
  'contacts:list': 'contacts:list',
  'contacts:add': 'contacts:add',
  'contacts:remove': 'contacts:remove',
  'contacts:update': 'contacts:update',

  // Chat
  'chat:listTopics': 'chat:listTopics',
  'chat:createTopic': 'chat:createTopic',
  'chat:sendMessage': 'chat:sendMessage',
  'chat:getMessages': 'chat:getMessages',
  'chat:newMessages': 'chat:newMessages',

  // AI
  'ai:chat': 'ai:chat',
  'ai:analyze': 'ai:analyze',
  'ai:extractKeywords': 'ai:extractKeywords',

  // Devices
  'devices:list': 'devices:list',
  'devices:register': 'devices:register',
  'devices:remove': 'devices:remove',

  // Export
  'export:conversation': 'export:conversation',
  'export:htmlWithMicrodata': 'export:htmlWithMicrodata',

  // System
  'app:clearData': 'app:clearData',
  'instance:info': 'instance:info',
  'connections:info': 'connections:info',
  'connections:status': 'connections:status',
} as const;

export type IPCChannel = keyof typeof IPC_CHANNELS;

// ============================================================================
// IPC Handler Types
// ============================================================================

export type IPCHandler<TRequest = any, TResponse = any> = (
  event: IpcMainInvokeEvent,
  ...args: TRequest[]
) => Promise<TResponse> | TResponse;

export interface IPCHandlerMap {
  [channel: string]: IPCHandler;
}

// ============================================================================
// Error Types
// ============================================================================

export class IPCError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'IPCError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export type AsyncResult<T> = Promise<{
  success: boolean;
  data?: T;
  error?: string;
}>;

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;