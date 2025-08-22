/**
 * SubjectService - Managing Subjects as the abstraction layer between SHA256 and meaning
 * 
 * Subjects are the semantic tags that create identity, memory, and resonance patterns.
 * They bridge the gap between cryptographic hashes and human/AI understanding.
 */

import type { SHA256Hash } from '@refinio/one.core/lib/util/type-checks'
import { storeUnversionedObject, getObjectByIdHash } from '@refinio/one.core/lib/storage-unversioned-objects'
import { calculateIdHashOfObj } from '@refinio/one.core/lib/util/object'

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
 * Subject-based identity signature
 */
export interface SubjectSignature {
  contactId: string
  topSubjects: Array<{ name: string; affinity: number }>
  uniqueSubjects: string[] // Subjects mainly used by this contact
  signature: string        // Hash of the subject pattern
}

/**
 * Someone's Subject-based memory
 * Someone is the identity behind multiple Profiles
 */
export interface SomeoneMemory {
  someoneId: string        // The Someone identity
  memorySubject: string    // Subject that references their memories
  profileSubjects: Map<string, string> // Profile ID -> Subject name
  timestamp: Date          // Last memory update
}

/**
 * SubjectService - Core service for Subject management
 */
export class SubjectService {
  private subjects: Map<string, Subject> = new Map()
  private attachments: Map<string, SubjectAttachment[]> = new Map()
  private signatures: Map<string, SubjectSignature> = new Map()
  private someoneMemories: Map<string, SomeoneMemory> = new Map()
  
  private static instance: SubjectService
  
  static getInstance(): SubjectService {
    if (!SubjectService.instance) {
      SubjectService.instance = new SubjectService()
    }
    return SubjectService.instance
  }
  
  /**
   * Create or update a subject with optional references
   */
  async createSubject(
    name: string,
    createdBy: string,
    confidence?: number,
    references?: string[]
  ): Promise<Subject> {
    const normalized = this.normalizeSubject(name)
    
    let subject = this.subjects.get(normalized)
    if (subject) {
      // Update existing
      subject.usageCount++
      subject.lastUsedAt = new Date()
      if (confidence !== undefined) {
        // Update running average confidence
        const prevTotal = (subject.confidence || 1) * (subject.usageCount - 1)
        subject.confidence = (prevTotal + confidence) / subject.usageCount
      }
    } else {
      // Create new (immutable once created)
      subject = {
        name: normalized,
        createdAt: new Date(),
        createdBy,
        lastUsedAt: new Date(),
        usageCount: 1,
        associations: new Map(),
        contexts: [],
        confidence,
        references: references || [],
        profileRefs: []
      }
      this.subjects.set(normalized, subject)
    }
    
    // Note: In a true content-addressed system, updating would create a new version
    // For now, we're simulating with in-memory updates
    
    // Update creator's signature
    this.updateSignature(createdBy, normalized)
    
    console.log(`[SubjectService] Subject '${normalized}' ${subject.usageCount === 1 ? 'created' : 'updated'} (count: ${subject.usageCount})`)
    
    return subject
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
    const normalized = this.normalizeSubject(subjectName)
    
    // Ensure subject exists
    const subject = await this.createSubject(normalized, attachedBy, confidence)
    
    // Create attachment
    const attachment: SubjectAttachment = {
      subjectName: normalized,
      contentHash,
      attachedAt: new Date(),
      attachedBy,
      confidence,
      context
    }
    
    // Store attachment
    const attachments = this.attachments.get(contentHash) || []
    attachments.push(attachment)
    this.attachments.set(contentHash, attachments)
    
    // Update subject context
    if (context && !subject.contexts.includes(context)) {
      subject.contexts.push(context)
    }
    
    // Update associations with other subjects on same content
    attachments.forEach(att => {
      if (att.subjectName !== normalized) {
        this.associateSubjects(normalized, att.subjectName)
      }
    })
    
    console.log(`[SubjectService] Attached '${normalized}' to ${contentHash.substring(0, 8)}...`)
    
    return attachment
  }
  
  /**
   * Get subjects for content
   */
  getContentSubjects(contentHash: string): SubjectAttachment[] {
    return this.attachments.get(contentHash) || []
  }
  
  /**
   * Get all subjects with metadata
   */
  getAllSubjects(): Subject[] {
    return Array.from(this.subjects.values())
  }
  
  /**
   * Get subject by name
   */
  getSubject(name: string): Subject | undefined {
    return this.subjects.get(this.normalizeSubject(name))
  }
  
  /**
   * Calculate subject resonance (importance/relevance)
   */
  calculateResonance(subjectName: string): SubjectResonance {
    const subject = this.getSubject(subjectName)
    if (!subject) {
      return {
        subject: subjectName,
        resonance: 0,
        momentum: 'stable',
        relatedSubjects: []
      }
    }
    
    // Calculate resonance based on multiple factors
    const allSubjects = this.getAllSubjects()
    const maxUsage = Math.max(...allSubjects.map(s => s.usageCount))
    const avgUsage = allSubjects.reduce((sum, s) => sum + s.usageCount, 0) / allSubjects.length
    
    // Normalized usage score
    const usageScore = subject.usageCount / maxUsage
    
    // Recency score (exponential decay over 30 days)
    const daysSinceUse = (Date.now() - subject.lastUsedAt.getTime()) / (1000 * 60 * 60 * 24)
    const recencyScore = Math.exp(-daysSinceUse / 30)
    
    // Association score (how connected to other subjects)
    const associationScore = Math.min(subject.associations.size / 10, 1)
    
    // Combined resonance
    const resonance = (usageScore * 0.5 + recencyScore * 0.3 + associationScore * 0.2)
    
    // Determine momentum
    let momentum: 'rising' | 'stable' | 'falling' = 'stable'
    if (subject.usageCount > avgUsage * 1.5 && daysSinceUse < 7) {
      momentum = 'rising'
    } else if (subject.usageCount < avgUsage * 0.5 || daysSinceUse > 30) {
      momentum = 'falling'
    }
    
    // Get related subjects
    const relatedSubjects = Array.from(subject.associations.entries())
      .map(([name, count]) => ({
        name,
        correlation: count / subject.usageCount
      }))
      .sort((a, b) => b.correlation - a.correlation)
      .slice(0, 5)
    
    return {
      subject: subject.name,
      resonance,
      momentum,
      relatedSubjects
    }
  }
  
  /**
   * Get subject signature for a contact (identity pattern)
   */
  getSubjectSignature(contactId: string): SubjectSignature | undefined {
    return this.signatures.get(contactId)
  }
  
  /**
   * Find similar contacts based on subject patterns
   */
  findSimilarContacts(contactId: string, threshold: number = 0.5): string[] {
    const signature = this.signatures.get(contactId)
    if (!signature) return []
    
    const similar: Array<{ id: string; similarity: number }> = []
    
    this.signatures.forEach((otherSig, otherId) => {
      if (otherId === contactId) return
      
      // Calculate similarity based on subject overlap
      const mySubjects = new Set(signature.topSubjects.map(s => s.name))
      const otherSubjects = new Set(otherSig.topSubjects.map(s => s.name))
      
      const intersection = new Set([...mySubjects].filter(x => otherSubjects.has(x)))
      const union = new Set([...mySubjects, ...otherSubjects])
      
      const similarity = intersection.size / union.size
      
      if (similarity >= threshold) {
        similar.push({ id: otherId, similarity })
      }
    })
    
    return similar
      .sort((a, b) => b.similarity - a.similarity)
      .map(s => s.id)
  }
  
  /**
   * Extract subjects from text using patterns
   */
  extractSubjectsFromText(text: string): string[] {
    const subjects: Set<string> = new Set()
    
    // Extract hashtags
    const hashtagRegex = /#[\w-]+/g
    const hashtags = text.match(hashtagRegex) || []
    hashtags.forEach(tag => subjects.add(this.normalizeSubject(tag)))
    
    // Extract common patterns (customize based on domain)
    const patterns = [
      /\b(photo|image|picture|screenshot)\b/gi,
      /\b(video|recording|stream)\b/gi,
      /\b(document|pdf|text|note)\b/gi,
      /\b(code|script|program|function)\b/gi,
      /\b(idea|concept|thought|question)\b/gi,
      /\b(work|project|task|meeting)\b/gi,
      /\b(personal|family|friend)\b/gi,
      /\b(music|song|audio|podcast)\b/gi
    ]
    
    patterns.forEach(pattern => {
      const matches = text.match(pattern) || []
      matches.forEach(match => subjects.add(this.normalizeSubject(match)))
    })
    
    return Array.from(subjects)
  }
  
  /**
   * Predict subjects for new content based on context and metadata
   */
  async predictSubjects(
    contentType: string,
    context?: string,
    creatorId?: string,
    metadata?: any
  ): Promise<Array<{ name: string; confidence: number }>> {
    const predictions: Array<{ name: string; confidence: number }> = []
    
    // Metadata-based predictions (highest confidence)
    if (metadata?.subjects) {
      metadata.subjects.forEach((subject: string) => {
        predictions.push({ name: subject, confidence: 0.9 })
      })
    }
    
    // EXIF-based predictions
    if (metadata?.exif) {
      const exif = metadata.exif
      if (exif.dateTimeOriginal) {
        const date = new Date(exif.dateTimeOriginal)
        const year = date.getFullYear().toString()
        predictions.push({ name: year, confidence: 0.8 })
        
        const hour = date.getHours()
        if (hour >= 6 && hour < 12) predictions.push({ name: 'morning', confidence: 0.7 })
        else if (hour >= 17 && hour < 21) predictions.push({ name: 'evening', confidence: 0.7 })
        else if (hour >= 21 || hour < 6) predictions.push({ name: 'night', confidence: 0.7 })
      }
      
      if (exif.gpsLatitude && exif.gpsLongitude) {
        predictions.push({ name: 'geotagged', confidence: 0.85 })
        predictions.push({ name: 'location', confidence: 0.8 })
      }
    }
    
    // Type-based predictions (fallback)
    const typeSubjects: Record<string, string[]> = {
      'image': ['photo', 'image', 'visual'],
      'video': ['video', 'media', 'recording'],
      'audio': ['audio', 'sound', 'music'],
      'document': ['document', 'text', 'file'],
      'code': ['code', 'development', 'programming']
    }
    
    const baseType = contentType.split('/')[0]
    const suggested = typeSubjects[baseType] || []
    suggested.forEach(s => {
      predictions.push({ name: s, confidence: 0.5 })
    })
    
    // Context-based predictions
    if (context) {
      // Find subjects commonly used in this context
      this.subjects.forEach(subject => {
        if (subject.contexts.includes(context)) {
          const contextRatio = subject.contexts.filter(c => c === context).length / subject.contexts.length
          predictions.push({ name: subject.name, confidence: contextRatio })
        }
      })
    }
    
    // Creator-based predictions
    if (creatorId) {
      const signature = this.signatures.get(creatorId)
      if (signature) {
        signature.topSubjects.forEach(s => {
          predictions.push({ name: s.name, confidence: s.affinity * 0.7 })
        })
      }
    }
    
    // Deduplicate and sort by confidence
    const merged = new Map<string, number>()
    predictions.forEach(p => {
      const existing = merged.get(p.name) || 0
      merged.set(p.name, Math.max(existing, p.confidence))
    })
    
    return Array.from(merged.entries())
      .map(([name, confidence]) => ({ name, confidence }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10)
  }
  
  /**
   * Create or update Someone's memory Subject
   */
  async setSomeoneMemory(
    someoneId: string,
    memorySubjectName: string,
    profileSubjects?: Map<string, string>
  ): Promise<SomeoneMemory> {
    const normalized = this.normalizeSubject(memorySubjectName)
    
    // Ensure the memory Subject exists
    const memorySubject = await this.createSubject(normalized, someoneId)
    
    // Note: Subject references Someone's memory, not the other way around
    // Someone points to Subject, Subject doesn't know about Someone
    
    // Create or update Someone memory
    let memory = this.someoneMemories.get(someoneId)
    if (memory) {
      memory.memorySubject = normalized
      memory.timestamp = new Date()
      if (profileSubjects) {
        memory.profileSubjects = profileSubjects
      }
    } else {
      memory = {
        someoneId,
        memorySubject: normalized,
        profileSubjects: profileSubjects || new Map(),
        timestamp: new Date()
      }
      this.someoneMemories.set(someoneId, memory)
    }
    
    // No back-references in content-addressed system
    
    console.log(`[SubjectService] Set memory Subject '${normalized}' for Someone ${someoneId}`)
    
    return memory
  }
  
  /**
   * Get Someone's memory
   */
  getSomeoneMemory(someoneId: string): SomeoneMemory | undefined {
    return this.someoneMemories.get(someoneId)
  }
  
  /**
   * Add Profile reference to Subject
   */
  async addProfileToSubject(
    subjectName: string,
    profileId: string
  ): Promise<void> {
    const subject = this.getSubject(subjectName)
    if (!subject) return
    
    subject.profileRefs = subject.profileRefs || []
    if (!subject.profileRefs.includes(profileId)) {
      subject.profileRefs.push(profileId)
      console.log(`[SubjectService] Added Profile ${profileId} to Subject '${subjectName}'`)
    }
  }
  
  /**
   * Get Subjects referenced by a Subject
   */
  getReferencedSubjects(subjectName: string): Subject[] {
    const subject = this.getSubject(subjectName)
    if (!subject || !subject.references) return []
    
    return subject.references
      .map(name => this.getSubject(name))
      .filter((s): s is Subject => s !== undefined)
  }
  
  /**
   * Find Subjects that reference this Subject (using reverse map)
   * In production, this would be a proper reverse index
   */
  getReferencingSubjects(targetName: string): Subject[] {
    const normalized = this.normalizeSubject(targetName)
    const referencing: Subject[] = []
    
    // Search through all subjects (in production, use reverse map)
    this.subjects.forEach(subject => {
      if (subject.references && subject.references.includes(normalized)) {
        referencing.push(subject)
      }
    })
    
    return referencing
  }
  
  /**
   * Find Someone identities through shared Subjects
   */
  findConnectedSomeones(someoneId: string): Array<{ id: string; sharedSubjects: string[] }> {
    const memory = this.someoneMemories.get(someoneId)
    if (!memory) return []
    
    const connections: Array<{ id: string; sharedSubjects: string[] }> = []
    
    // Find other Someones with overlapping memory Subjects
    this.someoneMemories.forEach((otherMemory, otherId) => {
      if (otherId === someoneId) return
      
      const shared: string[] = []
      
      // Check if they share memory Subjects
      const mySubject = this.getSubject(memory.memorySubject)
      const otherSubject = this.getSubject(otherMemory.memorySubject)
      
      if (mySubject && otherSubject) {
        // Check for shared associations
        mySubject.associations.forEach((_, assocName) => {
          if (otherSubject.associations.has(assocName)) {
            shared.push(assocName)
          }
        })
        
        // Check for reference overlap
        const myRefs = new Set(mySubject.references || [])
        const otherRefs = new Set(otherSubject.references || [])
        myRefs.forEach(name => {
          if (otherRefs.has(name)) {
            shared.push(name)
          }
        })
      }
      
      if (shared.length > 0) {
        connections.push({ id: otherId, sharedSubjects: [...new Set(shared)] })
      }
    })
    
    return connections.sort((a, b) => b.sharedSubjects.length - a.sharedSubjects.length)
  }
  
  /**
   * Build reverse maps for efficient lookups
   * In production, these would be maintained incrementally
   */
  buildReverseMaps(): {
    subjectToReferencing: Map<string, Set<string>>
    profileToSubjects: Map<string, Set<string>>
  } {
    const subjectToReferencing = new Map<string, Set<string>>()
    const profileToSubjects = new Map<string, Set<string>>()
    
    this.subjects.forEach(subject => {
      // Build subject reference reverse map
      if (subject.references) {
        subject.references.forEach(ref => {
          if (!subjectToReferencing.has(ref)) {
            subjectToReferencing.set(ref, new Set())
          }
          subjectToReferencing.get(ref)!.add(subject.name)
        })
      }
      
      // Build profile reference reverse map
      if (subject.profileRefs) {
        subject.profileRefs.forEach(profileId => {
          if (!profileToSubjects.has(profileId)) {
            profileToSubjects.set(profileId, new Set())
          }
          profileToSubjects.get(profileId)!.add(subject.name)
        })
      }
    })
    
    return { subjectToReferencing, profileToSubjects }
  }
  
  /**
   * Normalize subject name
   */
  private normalizeSubject(name: string): string {
    return name
      .toLowerCase()
      .replace(/^#/, '') // Remove leading hashtag
      .replace(/[^a-z0-9-]/g, '') // Keep only alphanumeric and hyphens
      .substring(0, 50) // Limit length
  }
  
  /**
   * Associate two subjects (they appear together)
   */
  private associateSubjects(subject1: string, subject2: string): void {
    const s1 = this.subjects.get(subject1)
    const s2 = this.subjects.get(subject2)
    
    if (s1 && s2) {
      // Update s1's associations
      const count1 = s1.associations.get(subject2) || 0
      s1.associations.set(subject2, count1 + 1)
      
      // Update s2's associations
      const count2 = s2.associations.get(subject1) || 0
      s2.associations.set(subject1, count2 + 1)
    }
  }
  
  /**
   * Update contact's subject signature
   */
  private updateSignature(contactId: string, subjectName: string): void {
    let signature = this.signatures.get(contactId)
    
    if (!signature) {
      signature = {
        contactId,
        topSubjects: [],
        uniqueSubjects: [],
        signature: ''
      }
      this.signatures.set(contactId, signature)
    }
    
    // Update top subjects
    const existing = signature.topSubjects.find(s => s.name === subjectName)
    if (existing) {
      existing.affinity = Math.min(existing.affinity + 0.1, 1)
    } else {
      signature.topSubjects.push({ name: subjectName, affinity: 0.1 })
    }
    
    // Keep top 20 subjects
    signature.topSubjects.sort((a, b) => b.affinity - a.affinity)
    signature.topSubjects = signature.topSubjects.slice(0, 20)
    
    // Update signature hash
    const pattern = signature.topSubjects.map(s => `${s.name}:${s.affinity}`).join(',')
    signature.signature = calculateIdHashOfObj({ pattern }) as string
    
    // Find unique subjects (used mainly by this contact)
    const allAttachments = Array.from(this.attachments.values()).flat()
    const contactAttachments = allAttachments.filter(a => a.attachedBy === contactId)
    const contactSubjectCounts = new Map<string, number>()
    contactAttachments.forEach(a => {
      const count = contactSubjectCounts.get(a.subjectName) || 0
      contactSubjectCounts.set(a.subjectName, count + 1)
    })
    
    signature.uniqueSubjects = Array.from(contactSubjectCounts.entries())
      .filter(([subject, count]) => {
        const totalCount = this.subjects.get(subject)?.usageCount || 0
        return count / totalCount > 0.5 // This contact uses it >50% of the time
      })
      .map(([subject]) => subject)
  }
}

// Export singleton
export const subjectService = SubjectService.getInstance()