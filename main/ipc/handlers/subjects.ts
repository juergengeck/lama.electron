/**
 * IPC Handler for Subjects
 * Thin adapter that delegates to lama.core SubjectsHandler
 */

import { SubjectsHandler } from '@lama/core/handlers/SubjectsHandler.js';
import type { IpcMainInvokeEvent } from 'electron';

// Initialize handler
const subjectsHandler = new SubjectsHandler();

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
    const response = await subjectsHandler.createSubject({ name, createdBy, confidence, references });
    return { success: response.success, subject: response.subject, error: response.error };
  },

  /**
   * Attach subject to content
   */
  'subjects:attach': async (event: IpcMainInvokeEvent, { subjectName, contentHash, attachedBy, confidence, context }: AttachSubjectParams): Promise<IpcResponse> => {
    const response = await subjectsHandler.attachSubject({ subjectName, contentHash, attachedBy, confidence, context });
    return { success: response.success, attachment: response.attachment, error: response.error };
  },

  /**
   * Get subjects for content
   */
  'subjects:getForContent': async (event: IpcMainInvokeEvent, { contentHash }: GetForContentParams): Promise<IpcResponse> => {
    const response = await subjectsHandler.getForContent({ contentHash });
    return { success: response.success, subjects: response.subjects, error: response.error };
  },

  /**
   * Get all subjects
   */
  'subjects:getAll': async (event: IpcMainInvokeEvent): Promise<IpcResponse> => {
    const response = await subjectsHandler.getAll({});
    return { success: response.success, subjects: response.subjects, error: response.error };
  },

  /**
   * Search subjects
   */
  'subjects:search': async (event: IpcMainInvokeEvent, { query, limit }: SearchParams): Promise<IpcResponse> => {
    const response = await subjectsHandler.search({ query, limit });
    return { success: response.success, results: response.results, error: response.error };
  },

  /**
   * Get subject resonance
   */
  'subjects:getResonance': async (event: IpcMainInvokeEvent, { subjectNames, topK }: ResonanceParams): Promise<IpcResponse> => {
    const response = await subjectsHandler.getResonance({ subjectNames, topK });
    return { success: response.success, resonance: response.resonance, error: response.error };
  },

  /**
   * Extract subjects from text
   */
  'subjects:extract': async (event: IpcMainInvokeEvent, { text, extractor, minConfidence }: ExtractParams): Promise<IpcResponse> => {
    const response = await subjectsHandler.extract({ text, extractor, minConfidence });
    return { success: response.success, subjects: response.subjects, error: response.error };
  }
}

export { subjectHandlers, subjectsHandler }