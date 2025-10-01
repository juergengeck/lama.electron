// ChannelManager import
// ConnectionsModel import
/**
 * Extended type definitions for ONE.core and application-specific types
 */

import type { SHA256Hash, SHA256IdHash } from '@refinio/one.core/lib/util/type-checks.js'
import type { Person } from '@refinio/one.core/lib/recipes.js'

// Attestation types
export interface MessageAttestation {
  $type$: 'MessageAttestation'
  messageHash: string
  messageVersion: number
  attestedContent: string
  attestationType: string
  attestationClaim: string
  attestationMethod: string
  topicId: string
  auditorId?: string
  auditorName?: string
  timestamp: string
}

export interface AttestationCertificate {
  data: SHA256Hash
  signature: string
}

// Trust Manager types
export interface TrustManager {
  certify(type: string, params: { data: SHA256Hash<any> }): Promise<string>
  isTrusted(entity: SHA256IdHash<Person> | string): Promise<boolean>
}

// Topic Group Manager types
export interface TopicGroupManager {
  createGroup(name: string, members: SHA256IdHash<Person>[]): Promise<string>
  getGroup(groupId: string): Promise<TopicGroup | null>
  addMember(groupId: string, member: SHA256IdHash<Person>): Promise<void>
  removeMember(groupId: string, member: SHA256IdHash<Person>): Promise<void>
  getGroups(): Promise<TopicGroup[]>
  hasGroup(groupId: string): boolean
}

export interface TopicGroup {
  id: string
  name: string
  members: SHA256IdHash<Person>[]
  created: number
  modified: number
}

// AI Assistant Model types
export interface AIAssistantModel {
  initialize(): Promise<void>
  createAIContact(name: string, description?: string): Promise<SHA256IdHash<Person>>
  getAIContacts(): Promise<AIContact[]>
  isAIContact(personId: SHA256IdHash<Person>): boolean
  handleMessage(message: any, topicId: string): Promise<void>
}

export interface AIContact {
  personId: SHA256IdHash<Person>
  name: string
  description?: string
  modelId?: string
  created: number
}

// LLM Object Manager types
export interface LLMObjectManager {
  storeLLM(llm: any): Promise<SHA256Hash<any>>
  getLLM(hash: SHA256Hash<any>): Promise<any>
  getAllLLMs(): Promise<any[]>
  deleteLLM(hash: SHA256Hash<any>): Promise<void>
  createLLMObject(params: any): any
}

// Extended Channel types
export interface ExtendedChannelInfo {
  id: string
  owner?: SHA256IdHash<Person>
  participants?: SHA256IdHash<Person>[]
  created: number
}

// Contact types
export interface Contact {
  id: SHA256IdHash<Person>
  name: string
  email?: string
  status: 'active' | 'pending' | 'blocked'
  trust?: number
  isAI?: boolean
}

// Settings types
export interface Settings {
  theme?: 'light' | 'dark'
  notifications?: boolean
  autoConnect?: boolean
  defaultLLM?: string
  [key: string]: any
}

// Export/Import types
export interface ExportOptions {
  format: 'html' | 'json' | 'markdown'
  includeAttachments?: boolean
  includeSignatures?: boolean
  maxMessages?: number
  dateRange?: {
    start: Date
    end: Date
  }
}

export interface ImportOptions {
  format: 'html' | 'json' | 'markdown'
  mergeExisting?: boolean
  skipDuplicates?: boolean
}

// API Server types
export interface APIServerOptions {
  port?: number
  host?: string
  secure?: boolean
  cors?: boolean
}

export interface QuicVCServerOptions {
  quicTransport?: any
  port?: number
  host?: string
}

// Instance types
export interface InstanceOptions {
  name: string
  id?: string
  storage?: 'file' | 'memory'
  path?: string
}

// Clean end of file