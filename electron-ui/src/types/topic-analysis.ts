/**
 * TypeScript Types for Topic Analysis Feature
 * Matches IPC contracts from /specs/005-we-must-change/contracts/ipc-handlers.json
 */

/**
 * Subject represents a distinct discussion topic within a conversation
 * Identified by topic + keyword combination
 */
export interface Subject {
  $type$: 'Subject';
  id: string;           // Format: `${topicId}:${sortedKeywords.join('-')}`
  name: string;         // Human-readable 1-2 word name (e.g., "Pizza Delivery")
  topic: string;        // Hash reference to parent Topic
  keywords: string[];   // Sorted array of keywords identifying this subject
  messageCount: number; // Number of messages related to this subject
  timestamp: number;    // Unix timestamp from latest source message
  archived?: boolean;   // Whether subject is archived (optional)
}

/**
 * Keyword extracted from message content
 */
export interface Keyword {
  $type$?: 'Keyword';
  id?: string;          // Hash of the keyword text
  term?: string;        // The actual keyword term (from backend)
  text?: string;        // The actual keyword text (alternative field)
  frequency?: number;   // How often it appears
  subjects?: string[];  // Subject IDs this keyword belongs to
  score?: number;       // Relevance score
}

/**
 * Summary of a topic conversation
 * Supports versioning with previousVersion linking
 */
export interface Summary {
  $type$: 'Summary';
  id: string;              // Same as topic ID for current summary
  topic: string;           // Reference to parent Topic
  content: string;         // The actual summary text
  subjects: string[];      // Subject IDs referenced in this summary
  keywords: string[];      // All keywords from all subjects
  version: number;         // Version number (increments on update)
  previousVersion?: string; // Hash of previous summary version (if exists)
  createdAt: number;       // Unix timestamp of creation
  updatedAt: number;       // Unix timestamp of last update
  changeReason?: string;   // Why this version was created (optional)
}

/**
 * Request to analyze messages and extract topics
 */
export interface AnalyzeMessagesRequest {
  topicId: string;
  messages?: Array<{
    id: string;
    text: string;
    sender: string;
    timestamp: number;
  }>;
  forceReanalysis?: boolean;
}

/**
 * Response from message analysis
 */
export interface AnalyzeMessagesResponse {
  success: boolean;
  data?: {
    subjects: Subject[];
    keywords: Keyword[];
    summaryId: string;
  };
  error?: string;
}

/**
 * Request to get subjects for a topic
 */
export interface GetSubjectsRequest {
  topicId: string;
  includeArchived?: boolean;
}

/**
 * Response with subjects
 */
export interface GetSubjectsResponse {
  success: boolean;
  data?: {
    subjects: Subject[];
  };
  error?: string;
}

/**
 * Request to get summary
 */
export interface GetSummaryRequest {
  topicId: string;
  version?: number;
  includeHistory?: boolean;
}

/**
 * Response with summary
 */
export interface GetSummaryResponse {
  success: boolean;
  data?: {
    current: Summary;
    history?: Summary[];
  };
  error?: string;
}

/**
 * Request to update summary
 */
export interface UpdateSummaryRequest {
  topicId: string;
  content: string;
  changeReason?: string;
}

/**
 * Response from summary update
 */
export interface UpdateSummaryResponse {
  success: boolean;
  data?: {
    summary: Summary;
    previousVersion?: string;
  };
  error?: string;
}

/**
 * Request to extract keywords
 */
export interface ExtractKeywordsRequest {
  text: string;
  maxKeywords?: number;
  existingKeywords?: string[];
}

/**
 * Response with extracted keywords
 */
export interface ExtractKeywordsResponse {
  success: boolean;
  data?: {
    keywords: string[];
    scores?: Record<string, number>;
  };
  error?: string;
}

/**
 * Request to merge subjects
 */
export interface MergeSubjectsRequest {
  topicId: string;
  subjectId1: string;
  subjectId2: string;
  newKeywords?: string[];
}

/**
 * Response from subject merge
 */
export interface MergeSubjectsResponse {
  success: boolean;
  data?: {
    mergedSubject: Subject;
    archivedSubjects: string[];
  };
  error?: string;
}

/**
 * IPC channel names for topic analysis
 */
export const TopicAnalysisChannels = {
  ANALYZE_MESSAGES: 'topicAnalysis:analyzeMessages',
  GET_SUBJECTS: 'topicAnalysis:getSubjects',
  GET_SUMMARY: 'topicAnalysis:getSummary',
  UPDATE_SUMMARY: 'topicAnalysis:updateSummary',
  EXTRACT_KEYWORDS: 'topicAnalysis:extractKeywords',
  MERGE_SUBJECTS: 'topicAnalysis:mergeSubjects'
} as const;

/**
 * Type guard to check if object is a Subject
 */
export function isSubject(obj: any): obj is Subject {
  return obj && obj.$type$ === 'Subject';
}

/**
 * Type guard to check if object is a Keyword
 */
export function isKeyword(obj: any): obj is Keyword {
  return obj && obj.$type$ === 'Keyword';
}

/**
 * Type guard to check if object is a Summary
 */
export function isSummary(obj: any): obj is Summary {
  return obj && obj.$type$ === 'Summary';
}