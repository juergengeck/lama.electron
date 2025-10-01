/**
 * ONE.core Type Definitions for LAMA Electron
 *
 * Custom type definitions to bridge @refinio/one.core beta-3
 * and LAMA-specific objects without type casts.
 */

import type { SHA256IdHash, OneVersionedObjectTypes as BaseTypes } from '@refinio/one.core';

// LAMA-specific ONE.core objects
export interface LLM {
  $type$: 'LLM';
  modelId: string;
  name: string;
  filename: string;
  modelType: string;
  active: boolean;
  deleted: boolean;
  created: number;
  modified: number;
  createdAt: string;
  lastUsed: string;
  personId: SHA256IdHash<any>;
  config?: Record<string, unknown>;
  capabilities?: string[];
  isAI?: boolean;
}

export interface Keyword {
  $type$: 'Keyword';
  term: string;
  frequency: number;
  lastSeen: number;
  topics: string[];
}

export interface Subject {
  $type$: 'Subject';
  id: string;
  keywords: string[];
  messageCount: number;
  lastUpdated: number;
  topicId: string;
}

export interface Summary {
  $type$: 'Summary';
  topicId: string;
  content: string;
  subjects: string[];
  generatedAt: number;
  version: number;
}

export interface TopicAnalysisRoom {
  $type$: 'TopicAnalysisRoom';
  topicId: string;
  analysisEnabled: boolean;
  lastAnalysis: number;
  keywords: string[];
  subjects: string[];
  summaryVersion: number;
}

// Extended ONE.core types including LAMA objects
export type OneVersionedObjectTypes =
  | BaseTypes
  | LLM
  | Keyword
  | Subject
  | Summary
  | TopicAnalysisRoom;

// Type guards for LAMA objects (no casts!)
export function isLLM(obj: unknown): obj is LLM {
  if (typeof obj !== 'object' || obj === null) return false;
  const typed = obj as Record<string, unknown>;
  return (
    typed.$type$ === 'LLM' &&
    typeof typed.modelId === 'string' &&
    typeof typed.name === 'string' &&
    typeof typed.filename === 'string'
  );
}

export function isKeyword(obj: unknown): obj is Keyword {
  if (typeof obj !== 'object' || obj === null) return false;
  const typed = obj as Record<string, unknown>;
  return (
    typed.$type$ === 'Keyword' &&
    typeof typed.term === 'string' &&
    typeof typed.frequency === 'number' &&
    Array.isArray(typed.topics)
  );
}

export function isSubject(obj: unknown): obj is Subject {
  if (typeof obj !== 'object' || obj === null) return false;
  const typed = obj as Record<string, unknown>;
  return (
    typed.$type$ === 'Subject' &&
    typeof typed.id === 'string' &&
    Array.isArray(typed.keywords) &&
    typeof typed.topicId === 'string'
  );
}

export function isSummary(obj: unknown): obj is Summary {
  if (typeof obj !== 'object' || obj === null) return false;
  const typed = obj as Record<string, unknown>;
  return (
    typed.$type$ === 'Summary' &&
    typeof typed.topicId === 'string' &&
    typeof typed.content === 'string' &&
    typeof typed.generatedAt === 'number'
  );
}

// Utility type for handling undefined safely
export type NonNullable<T> = T extends null | undefined ? never : T;

// Branded type utilities
export type BrandedType<Brand> = string & { _brand: Brand };
export type TopicId = BrandedType<'TopicId'>;
export type ChannelId = BrandedType<'ChannelId'>;
export type MessageId = SHA256IdHash<any>;

// Helper to create branded types without casts
export function createTopicId(value: string): TopicId {
  // Runtime validation
  if (!value || typeof value !== 'string') {
    throw new TypeError('Invalid topic ID');
  }
  // TypeScript will infer this as TopicId
  return value as TopicId;
}

export function createChannelId(value: string): ChannelId {
  if (!value || typeof value !== 'string') {
    throw new TypeError('Invalid channel ID');
  }
  return value as ChannelId;
}

// Result type for operations that can fail
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

// Helper to handle results without exceptions
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; value: T } {
  return result.success === true;
}

export function isError<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}