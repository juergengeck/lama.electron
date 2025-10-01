/**
 * IPC Handler for Subject Service
 * Provides browser access to SubjectService via IPC
 */
import { SubjectService } from '../../services/subjects/SubjectService.js';
// Initialize service
const subjectService = new SubjectService();
/**
 * Subject IPC handlers
 */
const subjectHandlers = {
    /**
     * Create or update a subject
     */
    'subjects:create': async (event, { name, createdBy, confidence, references }) => {
        try {
            const subject = await subjectService.createSubject(name, createdBy, confidence, references);
            return { success: true, subject };
        }
        catch (error) {
            console.error('[SubjectHandler] Error creating subject:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Attach subject to content
     */
    'subjects:attach': async (event, { subjectName, contentHash, attachedBy, confidence, context }) => {
        try {
            const attachment = await subjectService.attachSubject(subjectName, contentHash, attachedBy, confidence, context);
            return { success: true, attachment };
        }
        catch (error) {
            console.error('[SubjectHandler] Error attaching subject:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Get subjects for content
     */
    'subjects:getForContent': async (event, { contentHash }) => {
        try {
            const subjects = subjectService.getContentSubjects(contentHash);
            return { success: true, subjects };
        }
        catch (error) {
            console.error('[SubjectHandler] Error getting subjects:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Get all subjects
     */
    'subjects:getAll': async (event) => {
        try {
            const subjects = subjectService.getAllSubjects();
            return { success: true, subjects };
        }
        catch (error) {
            console.error('[SubjectHandler] Error getting all subjects:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Search subjects
     */
    'subjects:search': async (event, { query, limit }) => {
        try {
            const results = subjectService.searchSubjects(query, limit);
            return { success: true, results };
        }
        catch (error) {
            console.error('[SubjectHandler] Error searching subjects:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Get subject resonance
     */
    'subjects:getResonance': async (event, { subjectNames, topK }) => {
        try {
            const resonance = subjectService.calculateResonance(subjectNames, topK);
            return { success: true, resonance };
        }
        catch (error) {
            console.error('[SubjectHandler] Error calculating resonance:', error);
            return { success: false, error: error.message };
        }
    },
    /**
     * Extract subjects from text
     */
    'subjects:extract': async (event, { text, extractor, minConfidence }) => {
        try {
            const subjects = await subjectService.extractSubjects(text, extractor, minConfidence);
            return { success: true, subjects };
        }
        catch (error) {
            console.error('[SubjectHandler] Error extracting subjects:', error);
            return { success: false, error: error.message };
        }
    }
};
export { subjectHandlers, subjectService };
