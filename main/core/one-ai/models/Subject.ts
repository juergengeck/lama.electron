/**
 * Subject Model for ONE.core
 * Represents a distinct discussion topic within a conversation
 * Identified by topic + keyword combination
 */

import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';

/**
 * Create a Subject object using ONE.core versioned storage
 */
export async function createSubject(
  topicId: any,
  keywordCombination: any,
  description: any,
  confidence: any,
  keywords = []
) {
  const subject = {
    $type$: 'Subject' as const,
    topicId,
    keywordCombination,
    description,
    confidence,
    extractedAt: Date.now(),
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    messageCount: 0,
    archived: false,
    keywords // Array of SHA256Hash<Keyword>
  };

  return await storeVersionedObject(subject);
}

/**
 * Helper to generate keyword combination string
 */
export function generateKeywordCombination(keywords: any): any {
  return keywords
    .map((k: any) => typeof k === 'string' ? k : k.term)
    .sort()
    .map((k: any) => k.toLowerCase().replace(/\s+/g, '-'))
    .join('+');
}

/**
 * Update Subject message count
 */
export async function updateSubjectMessageCount(subjectHash: any, increment = 1): Promise<any> {
  // Note: In a real implementation, you'd retrieve the current subject,
  // update its messageCount, and store a new version
  // This is simplified for the example
  console.log(`[Subject] Would increment message count by ${increment} for subject ${subjectHash}`);
}

/**
 * Check if subject matches given keywords
 */
export function subjectMatchesKeywords(subjectData: any, keywords = []): any {
  const normalizedKeywords: any[] = keywords.map(k => (k as any).toLowerCase());
  const keywordCombination = subjectData.keywordCombination.toLowerCase();

  return normalizedKeywords.every(k => keywordCombination.includes(k));
}

/**
 * Check if subject is significant enough to keep
 */
export function isSubjectSignificant(subjectData: any): any {
  return subjectData.messageCount >= 2 && subjectData.keywords.length > 0;
}