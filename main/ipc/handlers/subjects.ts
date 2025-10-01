/**
 * IPC Handler for Subject Service
 * Provides browser access to SubjectService via IPC
 */

import { SubjectService } from '../../services/subjects/SubjectService.js'
import type { IpcMainInvokeEvent } from 'electron';

// Initialize service
const subjectService = new SubjectService()

interface CreateSubjectParams {
  name: string;
  createdBy: string;
  confidence: number;
  references: any[];
}

interface AttachSubjectParams {
  subjectName: string;
  contentHash: string;
  attachedBy: string;
  confidence: number;
  context: any;
}

interface GetForContentParams {
  contentHash: string;
}

interface SearchParams {
  query: string;
  limit: number;
}

interface ResonanceParams {
  subjectNames: string[];
  topK: number;
}

interface ExtractParams {
  text: string;
  extractor: string;
  minConfidence: number;
}

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  subject?: any;
  attachment?: any;
  subjects?: any[];
  results?: any[];
  resonance?: any;
}

/**
 * Subject IPC handlers
 */
const subjectHandlers = {
  /**
   * Create or update a subject
   */
  'subjects:create': async (event: IpcMainInvokeEvent, { name, createdBy, confidence, references }: CreateSubjectParams): Promise<IpcResponse> => {
    try {
      const subject = await subjectService.createSubject(name, createdBy, confidence, references)
      return { success: true, subject }
    } catch (error) {
      console.error('[SubjectHandler] Error creating subject:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  /**
   * Attach subject to content
   */
  'subjects:attach': async (event: IpcMainInvokeEvent, { subjectName, contentHash, attachedBy, confidence, context }: AttachSubjectParams): Promise<IpcResponse> => {
    try {
      const attachment = await subjectService.attachSubject(
        subjectName,
        contentHash,
        attachedBy,
        confidence,
        context
      )
      return { success: true, attachment }
    } catch (error) {
      console.error('[SubjectHandler] Error attaching subject:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  /**
   * Get subjects for content
   */
  'subjects:getForContent': async (event: IpcMainInvokeEvent, { contentHash }: GetForContentParams): Promise<IpcResponse> => {
    try {
      const subjects = subjectService.getContentSubjects(contentHash)
      return { success: true, subjects }
    } catch (error) {
      console.error('[SubjectHandler] Error getting subjects:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  /**
   * Get all subjects
   */
  'subjects:getAll': async (event: IpcMainInvokeEvent): Promise<IpcResponse> => {
    try {
      const subjects = subjectService.getAllSubjects()
      return { success: true, subjects }
    } catch (error) {
      console.error('[SubjectHandler] Error getting all subjects:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  /**
   * Search subjects
   */
  'subjects:search': async (event: IpcMainInvokeEvent, { query, limit }: SearchParams): Promise<IpcResponse> => {
    try {
      // Search functionality not yet implemented in SubjectService
      const results: any[] = []
      return { success: true, results }
    } catch (error) {
      console.error('[SubjectHandler] Error searching subjects:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  /**
   * Get subject resonance
   */
  'subjects:getResonance': async (event: IpcMainInvokeEvent, { subjectNames, topK }: ResonanceParams): Promise<IpcResponse> => {
    try {
      const resonance = subjectService.calculateResonance(subjectNames[0])
      return { success: true, resonance }
    } catch (error) {
      console.error('[SubjectHandler] Error calculating resonance:', error)
      return { success: false, error: (error as Error).message }
    }
  },

  /**
   * Extract subjects from text
   */
  'subjects:extract': async (event: IpcMainInvokeEvent, { text, extractor, minConfidence }: ExtractParams): Promise<IpcResponse> => {
    try {
      const subjects = subjectService.extractSubjectsFromText(text)
      return { success: true, subjects }
    } catch (error) {
      console.error('[SubjectHandler] Error extracting subjects:', error)
      return { success: false, error: (error as Error).message }
    }
  }
}

export { subjectHandlers, subjectService }