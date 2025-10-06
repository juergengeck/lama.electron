/**
 * TypeScript Types for Keyword Detail Preview Feature
 * Matches IPC response structures from keyword-detail.js handlers
 */

/**
 * SHA256Hash type - branded string for type safety
 * Using string as ONE.core types may not be available in renderer
 */
export type SHA256Hash = string;

/**
 * Access state value for keyword permissions
 */
export type AccessStateValue = 'allow' | 'deny' | 'none';

/**
 * Principal type - user or group
 */
export type PrincipalType = 'user' | 'group';

/**
 * Sort options for subject list
 */
export type SubjectSortMode = 'relevance' | 'time' | 'author';

/**
 * Keyword access control state
 */
export interface KeywordAccessState {
  $type$: 'KeywordAccessState';
  keywordTerm: string;
  principalId: SHA256Hash;
  principalType: PrincipalType;
  state: AccessStateValue;
  updatedAt: string; // ISO timestamp
  updatedBy: SHA256Hash;
}

/**
 * Reference to a topic where keyword appears
 */
export interface TopicReference {
  topicId: string;
  topicName: string;
  messageCount: number;
  lastMessageDate: string; // ISO timestamp
  authors: SHA256Hash[];
}

/**
 * Enriched keyword with runtime metadata
 */
export interface EnrichedKeyword {
  $type$: 'Keyword';
  term: string;
  category: string | null;
  frequency: number;
  score: number;
  extractedAt: string; // ISO timestamp
  lastSeen: string; // ISO timestamp
  subjects: SHA256Hash[];

  // Runtime enrichment
  topicReferences: TopicReference[];
}

/**
 * Enriched subject with runtime metadata
 */
export interface EnrichedSubject {
  $type$: 'Subject';
  topicId: string;
  keywordCombination: string;
  description: string;
  confidence: number;
  keywords: SHA256Hash[];
  extractedAt: number;
  firstSeen: string; // ISO timestamp
  lastSeen: string; // ISO timestamp
  messageCount: number;
  archived: boolean;

  // Runtime enrichment
  relevanceScore: number;
  placesMentioned: number;
  authors: SHA256Hash[];
  sortTimestamp: string; // ISO timestamp
}

/**
 * Keyword detail data returned by getKeywordDetails
 */
export interface KeywordDetailData {
  keyword: EnrichedKeyword;
  subjects: EnrichedSubject[];
  accessStates: KeywordAccessState[];
}

/**
 * Response from getKeywordDetails IPC handler
 */
export interface KeywordDetailResponse {
  success: boolean;
  data?: KeywordDetailData;
  error?: string;
}

/**
 * Response from getKeywordsByTopic IPC handler
 */
export interface KeywordsByTopicResponse {
  success: boolean;
  data?: {
    keywords: EnrichedKeyword[];
  };
  error?: string;
}

/**
 * Top topic for a keyword (used in getAllKeywords)
 */
export interface TopTopic {
  topicId: string;
  topicName: string;
  frequency: number;
}

/**
 * Aggregated keyword with statistics (from getAllKeywords)
 */
export interface AggregatedKeyword {
  $type$: 'Keyword';
  term: string;
  category: string | null;
  frequency: number;
  score: number;
  extractedAt: string;
  lastSeen: string;
  subjects: SHA256Hash[];

  // Aggregated statistics
  topicCount: number;
  subjectCount: number;
  topTopics: TopTopic[];

  // Access control summary
  accessControlCount: number;
  hasRestrictions: boolean;
}

/**
 * Response from getAllKeywords IPC handler
 */
export interface AllKeywordsResponse {
  success: boolean;
  data?: {
    keywords: AggregatedKeyword[];
    totalCount: number;
    hasMore: boolean;
  };
  error?: string;
}

/**
 * Response from updateKeywordAccessState IPC handler
 */
export interface UpdateAccessStateResponse {
  success: boolean;
  data?: {
    accessState: KeywordAccessState;
    created: boolean;
  };
  error?: string;
}

/**
 * Response from getKeywordAccessStates IPC handler
 */
export interface AccessStatesResponse {
  success: boolean;
  data?: {
    accessStates: KeywordAccessState[];
  };
  error?: string;
}

/**
 * Principal information for access control UI
 */
export interface PrincipalInfo {
  id: SHA256Hash;
  type: PrincipalType;
  name: string;
  displayName?: string;
}

/**
 * All principals available for access control
 */
export interface AllPrincipals {
  users: PrincipalInfo[];
  groups: PrincipalInfo[];
}

/**
 * IPC channel names for keyword detail handlers
 */
export const KeywordDetailChannels = {
  GET_KEYWORD_DETAILS: 'keywordDetail:getKeywordDetails',
  GET_KEYWORDS_BY_TOPIC: 'keywordDetail:getKeywordsByTopic',
  GET_ALL_KEYWORDS: 'keywordDetail:getAllKeywords',
  UPDATE_KEYWORD_ACCESS_STATE: 'keywordDetail:updateKeywordAccessState',
  GET_KEYWORD_ACCESS_STATES: 'keywordDetail:getKeywordAccessStates'
} as const;

/**
 * Type guard to check if object is a KeywordAccessState
 */
export function isKeywordAccessState(obj: any): obj is KeywordAccessState {
  return obj && obj.$type$ === 'KeywordAccessState';
}

/**
 * Type guard to check if object is an EnrichedKeyword
 */
export function isEnrichedKeyword(obj: any): obj is EnrichedKeyword {
  return obj && obj.$type$ === 'Keyword';
}

/**
 * Type guard to check if object is an EnrichedSubject
 */
export function isEnrichedSubject(obj: any): obj is EnrichedSubject {
  return obj && obj.$type$ === 'Subject';
}
