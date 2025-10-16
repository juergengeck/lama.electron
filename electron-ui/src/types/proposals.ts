/**
 * TypeScript type definitions for Proposal System
 * Used by UI components
 */

export interface Proposal {
  id: string;
  pastSubject: string; // SHA256IdHash<Subject>
  currentSubject: string; // SHA256IdHash<Subject>
  matchedKeywords: string[];
  relevanceScore: number;
  sourceTopicId: string;
  pastSubjectName: string;
  createdAt: number;
}

export interface ProposalConfig {
  userEmail: string;
  matchWeight: number;
  recencyWeight: number;
  recencyWindow: number;
  minJaccard: number;
  maxProposals: number;
  updated: number;
}

export interface GetProposalsResponse {
  proposals: Proposal[];
  count: number;
  cached: boolean;
  computeTimeMs: number;
}

export interface UpdateConfigResponse {
  success: boolean;
  config: ProposalConfig;
  versionHash?: string;
}

export interface GetConfigResponse {
  config: ProposalConfig;
  isDefault: boolean;
}

export interface DismissProposalResponse {
  success: boolean;
  remainingCount: number;
}

export interface SharedContent {
  subjectName: string;
  keywords: string[];
  messages?: any[];
}

export interface ShareProposalResponse {
  success: boolean;
  sharedContent: SharedContent;
}
