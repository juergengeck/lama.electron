/**
 * SubjectService - Browser proxy that uses IPC to access Node.js SubjectService
 * 
 * Subjects are the semantic tags that create identity, memory, and resonance patterns.
 * They bridge the gap between cryptographic hashes and human/AI understanding.
 */

/**
 * Subject with metadata and one-way references
 */
export interface Subject {
  name: string              // The subject/tag name (lowercase, no #)
  createdAt: Date          // When first used
  createdBy: string        // Contact ID (human or LLM)
  lastUsedAt: Date         // Most recent use
  usageCount: number       // Total times used (demand)
  associations: Map<string, number> // Related subjects and their co-occurrence count
  contexts: string[]       // Conversation/topic IDs where used
  confidence?: number      // Average confidence for auto-tagged subjects
  
  // One-way references (content-addressed)
  references?: string[]    // Subject names this Subject references
  profileRefs?: string[]   // Profile IDs this Subject references
}

/**
 * Subject attachment - links a subject to content
 */
export interface SubjectAttachment {
  subjectName: string
  contentHash: string      // SHA256 of attached content
  attachedAt: Date
  attachedBy: string       // Contact ID
  confidence?: number      // AI confidence (0-1)
  context?: string         // Conversation/topic ID
}

/**
 * Subject resonance - measures subject importance
 */
export interface SubjectResonance {
  subject: string
  resonance: number        // 0-1 score based on usage patterns
  momentum: 'rising' | 'stable' | 'falling'
  relatedSubjects: Array<{ name: string; correlation: number }>
}

/**
 * SubjectService - Browser proxy using IPC
 */
class SubjectService {
  /**
   * Create or update a subject
   */
  async createSubject(
    name: string,
    createdBy: string,
    confidence?: number,
    references?: string[]
  ): Promise<Subject> {
    const result = await window.electronAPI.invoke('subjects:create', {
      name,
      createdBy,
      confidence,
      references
    })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create subject')
    }
    
    return result.subject
  }
  
  /**
   * Attach subject to content
   */
  async attachSubject(
    subjectName: string,
    contentHash: string,
    attachedBy: string,
    confidence?: number,
    context?: string
  ): Promise<SubjectAttachment> {
    const result = await window.electronAPI.invoke('subjects:attach', {
      subjectName,
      contentHash,
      attachedBy,
      confidence,
      context
    })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to attach subject')
    }
    
    return result.attachment
  }
  
  /**
   * Get subjects for content
   */
  async getContentSubjects(contentHash: string): Promise<SubjectAttachment[]> {
    const result = await window.electronAPI.invoke('subjects:getForContent', {
      contentHash
    })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get subjects')
    }
    
    return result.subjects
  }
  
  /**
   * Get all subjects with metadata
   */
  async getAllSubjects(): Promise<Subject[]> {
    const result = await window.electronAPI.invoke('subjects:getAll')
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to get all subjects')
    }
    
    return result.subjects
  }
  
  /**
   * Search subjects by prefix or pattern
   */
  async searchSubjects(query: string, limit: number = 10): Promise<Subject[]> {
    const result = await window.electronAPI.invoke('subjects:search', {
      query,
      limit
    })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to search subjects')
    }
    
    return result.results
  }
  
  /**
   * Calculate resonance for subjects
   */
  async calculateResonance(
    subjectNames?: string[],
    topK: number = 10
  ): Promise<SubjectResonance[]> {
    const result = await window.electronAPI.invoke('subjects:getResonance', {
      subjectNames,
      topK
    })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to calculate resonance')
    }
    
    return result.resonance
  }
  
  /**
   * Extract subjects from text (using AI if available)
   */
  async extractSubjects(
    text: string,
    extractor: string = 'manual',
    minConfidence: number = 0.5
  ): Promise<Array<{ name: string; confidence: number }>> {
    const result = await window.electronAPI.invoke('subjects:extract', {
      text,
      extractor,
      minConfidence
    })
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to extract subjects')
    }
    
    return result.subjects
  }
}

// Export singleton instance
export const subjectService = new SubjectService()