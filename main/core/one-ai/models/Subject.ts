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
  const now = Date.now();
  const subject = {
    $type$: 'Subject' as const,
    id: keywordCombination, // Required: Use keyword combination as ID
    topic: topicId, // Required: Parent topic reference
    keywords, // Required: Array of SHA256Hash<Keyword>
    timeRanges: [
      {
        start: now,
        end: now // Initially start = end, will be updated when subject is seen again
      }
    ], // Required: Temporal ranges when subject was discussed
    messageCount: 0, // Required: Message count
    createdAt: now, // Required: Creation timestamp
    lastSeenAt: now, // Required: Last seen timestamp
    archived: false // Optional: Archive flag
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