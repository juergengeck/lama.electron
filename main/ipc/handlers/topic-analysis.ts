import type { ChannelManager } from '@refinio/one.models/lib/models/index.js';
/**
 * IPC Handlers for Topic Analysis
 * Handles AI-powered topic analysis operations
 */

import nodeOneCoreInstance from '../../core/node-one-core.js';
import TopicAnalysisModel from '../../core/one-ai/models/TopicAnalysisModel.js';
import RealTimeKeywordExtractor from '../../core/one-ai/services/RealTimeKeywordExtractor.js';
import llmManager from '../../services/llm-manager.js';
import type { IpcMainInvokeEvent } from 'electron';

// Singleton instances
let topicAnalysisModel: TopicAnalysisModel | null = null;
let keywordExtractor: RealTimeKeywordExtractor | null = null;

interface Message {
  sender?: string;
  content?: string;
  text?: string;
  [key: string]: any;
}

interface AnalyzeParams {
  topicId: string;
  messages?: Message[];
  forceReanalysis?: boolean;
}

interface SubjectsParams {
  topicId: string;
  includeArchived?: boolean;
}

interface SummaryParams {
  topicId: string;
  version?: number;
  includeHistory?: boolean;
}

interface RestartContextParams {
  topicId: string;
}

interface UpdateSummaryParams {
  topicId: string;
  content?: string;
  changeReason?: string;
  autoGenerate?: boolean;
}

interface ExtractKeywordsParams {
  text: string;
  limit?: number;
}

interface MergeSubjectsParams {
  topicId: string;
  subjectId1: string;
  subjectId2: string;
}

interface RealtimeKeywordsParams {
  text: string;
  existingKeywords?: string[];
  maxKeywords?: number;
}

interface ConversationKeywordsParams {
  topicId: string;
  messages?: Message[];
  maxKeywords?: number;
}

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Initialize model instance
 */
async function initializeModel(): Promise<TopicAnalysisModel> {
  // Return existing model if already initialized
  if (topicAnalysisModel) {
    const state = topicAnalysisModel.state.currentState;
    if (state === 'Initialised') {
      return topicAnalysisModel;
    }
    // If it's initializing, wait a bit
    if (state === 'Initialising' as any) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return initializeModel(); // Retry after wait
    }
  }

  if (!nodeOneCoreInstance?.initialized) {
    throw new Error('ONE.core not initialized');
  }

  const channelManager: ChannelManager = nodeOneCoreInstance.channelManager;
  if (!channelManager) {
    throw new Error('ChannelManager not available');
  }

  const topicModel = nodeOneCoreInstance.topicModel;
  if (!topicModel) {
    throw new Error('TopicModel not available');
  }

  // Create new model if doesn't exist
  if (!topicAnalysisModel) {
    topicAnalysisModel = new TopicAnalysisModel(channelManager, topicModel);
  }

  // Initialize only if uninitialised
  if (topicAnalysisModel.state.currentState === 'Uninitialised') {
    await topicAnalysisModel.init();
  }

  return topicAnalysisModel;
}

/**
 * Get node ONE.core instance (helper function)
 */
function getNodeOneCoreInstance(): any {
  return nodeOneCoreInstance;
}

/**
 * Analyze messages to extract subjects and keywords using LLM
 */
export async function analyzeMessages(event: IpcMainInvokeEvent, { topicId, messages, forceReanalysis = false }: AnalyzeParams): Promise<IpcResponse> {
  console.log('[TopicAnalysis] Analyzing messages for topic:', topicId);

  try {
    const model: any = await initializeModel();

    // If no messages provided, retrieve from conversation
    if (!messages || messages.length === 0) {
      // Check if topic exists first to avoid auto-creation
      try {
        const topicRoom: any = await nodeOneCoreInstance.topicModel.enterTopicRoom(topicId);
        // Retrieve messages directly without auto-creating topic
        const messagesIterable: any = await topicRoom.retrieveAllMessages();
        messages = [];
        for await (const msg of messagesIterable) {
          messages.push(msg);
        }
        await topicRoom.leave();
      } catch (error) {
        console.log('[TopicAnalysis] Topic does not exist, skipping analysis:', topicId);
        return {
          success: true,
          data: {
            subjects: [],
            keywords: [],
            summary: null
          }
        };
      }
    }

    if (messages.length === 0) {
      return {
        success: true,
        data: {
          subjects: [],
          keywords: [],
          summary: null
        }
      };
    }

    // Get LLM manager singleton
    const { default: llmManager } = await import('../../services/llm-manager.js');
    if (!llmManager) {
      throw new Error('LLM Manager not available');
    }

    // Get model ID from AI assistant model (source of truth)
    let modelId: string | null = null;
    if (nodeOneCoreInstance.aiAssistantModel) {
      modelId = nodeOneCoreInstance.aiAssistantModel.getModelIdForTopic(topicId);
    }

    if (!modelId) {
      throw new Error('No AI model configured for this topic');
    }

    // Prepare conversation context for analysis
    const conversationText = messages
      .map(msg => `${msg.sender || 'Unknown'}: ${msg.content || msg.text || ''}`)
      .join('\n');

    // Extract keywords using LLM
    console.log('[TopicAnalysis] Extracting keywords with LLM using model:', modelId);
    const keywordPrompt = `Analyze this conversation and extract the most important keywords (single words or short phrases).
Return ONLY a JSON array of keywords, no explanation.
Focus on: main topics, technical terms, product names, important concepts.
Limit to 15 most relevant keywords.

Conversation:
${String(conversationText).substring(0, 3000)}

Return format: ["keyword1", "keyword2", ...]`;

    const keywordResponse: any = await llmManager.chat([{
      role: 'user',
      content: keywordPrompt
    }], modelId); // Use determined model

    // Identify subjects using LLM (subjects contain keywords)
    console.log('[TopicAnalysis] Identifying subjects with LLM...');
    const subjectPrompt = `Analyze this conversation and identify the main subjects/themes being discussed.
For each subject, provide:
1. A list of 2-3 keywords that define it
2. A brief description (one sentence)

Return ONLY a JSON array with this format:
[{"keywords": ["keyword1", "keyword2"], "description": "Brief description"}]

Conversation:
${String(conversationText).substring(0, 3000)}`;

    const subjectResponse: any = await llmManager.chat([{
      role: 'user',
      content: subjectPrompt
    }], modelId);

    let subjects: Array<{ keywords: string[]; description: string }> = [];
    try {
      subjects = JSON.parse(subjectResponse);
    } catch (e) {
      console.warn('[TopicAnalysis] Failed to parse subject JSON, extracting keywords for fallback');
      // Extract keywords for fallback
      let fallbackKeywords: string[] = [];
      try {
        fallbackKeywords = JSON.parse(keywordResponse);
      } catch (e2) {
        fallbackKeywords = String(keywordResponse).match(/"([^"]+)"/g)?.map(k => k.replace(/"/g, '')) || [];
      }
      subjects = [{
        keywords: fallbackKeywords.slice(0, 3),
        description: 'Main conversation topic'
      }];
    }

    // Store subjects first, then create keywords with subject references
    const subjectsToStore = [];
    for (const subject of subjects.slice(0, 5)) {
      const subjectId = subject.keywords.join('+');
      const createdSubject = await model.createSubject(
        topicId,
        subject.keywords,
        subjectId,
        subject.description,
        0.8
      );
      // Store the ID HASH, not the string ID
      subjectsToStore.push({ idHash: createdSubject.idHash, keywords: subject.keywords });
    }

    // Now create keywords with subject ID hashes
    for (const subject of subjectsToStore) {
      for (const keywordTerm of subject.keywords) {
        await model.addKeywordToSubject(topicId, keywordTerm, subject.idHash);
      }
    }

    // Generate summary using LLM
    console.log('[TopicAnalysis] Generating summary with LLM...');
    const summaryPrompt = `Create a concise summary of this conversation.
Include: main topics discussed, key decisions or conclusions, important points.
Keep it under 150 words.

Conversation:
${String(conversationText).substring(0, 3000)}`;

    const summaryResponse: any = await llmManager.chat([{
      role: 'user',
      content: summaryPrompt
    }], modelId);

    // Create summary
    const summary: any = await model.createSummary(
      topicId,
      1,
      summaryResponse,
      [],
      'AI-generated analysis',
      null
    );

    // Get the created subjects for return
    const createdSubjects: any = await model.getSubjects(topicId);
    const createdKeywords: any = await model.getKeywords(topicId);

    console.log('[TopicAnalysis] Analysis complete:', {
      topicId,
      subjectsCreated: createdSubjects.length,
      keywordsCreated: createdKeywords.length,
      summaryCreated: !!summary
    });

    return {
      success: true,
      data: {
        subjects: createdSubjects,
        keywords: createdKeywords.map((k: any) => k.term),
        summary: summary
      }
    };
  } catch (error) {
    console.error('[TopicAnalysis] Error analyzing messages:', error);
    return {
      success: false,
      error: (error as Error).message,
      data: {
        subjects: [],
        keywords: [],
        summary: null
      }
    };
  }
}

/**
 * Get all subjects for a topic
 */
export async function getSubjects(event: IpcMainInvokeEvent, { topicId, includeArchived = false }: SubjectsParams): Promise<IpcResponse> {
  console.log('[TopicAnalysis] Getting subjects for topic:', topicId);

  try {
    const model: any = await initializeModel();
    const subjects: any = await model.getSubjects(topicId);

    console.log('[TopicAnalysis] Retrieved subjects:', {
      topicId,
      totalSubjects: subjects.length,
      subjects: subjects.map((s: any) => ({
        keywords: s.keywords,
        combination: s.keywordCombination
      }))
    });

    // Get all keywords to resolve ID hashes to terms
    const allKeywords: any = await model.getKeywords(topicId);
    console.log('[TopicAnalysis] 🔍 Retrieved keywords for resolution:', {
      topicId,
      keywordCount: allKeywords.length,
      sampleKeywords: allKeywords.slice(0, 3).map((k: any) => k.term)
    });

    // Create a map of keyword ID hash -> keyword term
    const { calculateIdHashOfObj } = await import('@refinio/one.core/lib/util/object.js');
    const keywordHashToTerm = new Map<string, string>();

    for (const keyword of allKeywords) {
      if (keyword.term) {
        // Calculate the ID hash for this keyword to match against subjects
        const keywordIdObj = {
          $type$: 'Keyword' as const,
          term: keyword.term.toLowerCase().trim()
        };
        const idHash = await calculateIdHashOfObj(keywordIdObj as any);
        keywordHashToTerm.set(idHash, keyword.term);
        console.log('[TopicAnalysis] 🔍 Keyword hash mapping:', {
          term: keyword.term,
          idHash: idHash.substring(0, 16) + '...'
        });
      }
    }

    console.log('[TopicAnalysis] 🔍 Created hash->term map with', keywordHashToTerm.size, 'entries');

    // Resolve keyword ID hashes to terms in each subject
    const resolvedSubjects = subjects.map((subject: any) => {
      console.log('[TopicAnalysis] 🔍 Resolving keywords for subject:', {
        subjectId: subject.id,
        keywordHashes: (subject.keywords || []).map((h: string) => h.substring(0, 16) + '...')
      });

      const resolvedKeywords = (subject.keywords || []).map((keywordHash: string) => {
        const term = keywordHashToTerm.get(keywordHash);
        if (!term) {
          console.warn('[TopicAnalysis] ⚠️  Could not resolve keyword hash:', {
            hash: keywordHash.substring(0, 16) + '...',
            fullHash: keywordHash,
            availableHashes: Array.from(keywordHashToTerm.keys()).map(h => h.substring(0, 16) + '...')
          });
        } else {
          console.log('[TopicAnalysis] ✅ Resolved keyword hash to term:', {
            hash: keywordHash.substring(0, 16) + '...',
            term
          });
        }
        return term || keywordHash; // Fall back to hash if resolution fails
      });

      console.log('[TopicAnalysis] 🔍 Resolved subject keywords:', {
        subjectId: subject.id,
        resolvedKeywords
      });

      return {
        ...subject,
        keywords: resolvedKeywords // Replace ID hashes with actual terms
      };
    });

    const filteredSubjects = includeArchived
      ? resolvedSubjects
      : resolvedSubjects.filter((s: any) => !s.archived);

    console.log('[TopicAnalysis] ✅ Resolved subjects with keyword terms:', {
      topicId,
      subjectCount: filteredSubjects.length,
      sampleSubject: filteredSubjects[0] ? {
        id: filteredSubjects[0].id,
        keywords: filteredSubjects[0].keywords
      } : null
    });

    return {
      success: true,
      data: {
        subjects: filteredSubjects
      }
    };
  } catch (error) {
    console.error('[TopicAnalysis] Error getting subjects:', error);
    return {
      success: false,
      error: (error as Error).message,
      data: {
        subjects: []
      }
    };
  }
}

/**
 * Get summary for a topic
 */
export async function getSummary(event: IpcMainInvokeEvent, { topicId, version, includeHistory = false }: SummaryParams): Promise<IpcResponse> {
  console.log('[TopicAnalysis] Getting summary for topic:', topicId);

  try {
    const model: any = await initializeModel();
    const current: any = await model.getCurrentSummary(topicId);

    console.log('[TopicAnalysis] Retrieved summary:', {
      topicId,
      found: !!current,
      version: current?.version,
      content: current?.content?.substring(0, 50)
    });

    let history: any[] = [];
    if (includeHistory) {
      const allSummaries: any = await model.getSummaries(topicId);
      history = allSummaries.sort((a: any, b: any) => b.version - a.version);
    }

    return {
      success: true,
      data: {
        current: current,
        history: history
      }
    };
  } catch (error) {
    console.error('[TopicAnalysis] Error getting summary:', error);
    return {
      success: false,
      error: (error as Error).message,
      data: {
        current: null,
        history: []
      }
    };
  }
}

/**
 * Generate conversation restart context for LLM continuity
 */
export async function getConversationRestartContext(event: IpcMainInvokeEvent, { topicId }: RestartContextParams): Promise<IpcResponse> {
  console.log('[TopicAnalysis] Getting conversation restart context for topic:', topicId);

  try {
    const model: any = await initializeModel();

    // Get current summary
    const summary: any = await model.getCurrentSummary(topicId);

    // Get active subjects and keywords
    const subjects: any = await model.getSubjects(topicId);
    const keywords: any = await model.getKeywords(topicId);

    // Build restart context
    let restartContext = '';

    if (summary) {
      restartContext = `Continuing conversation from previous context:\n\n${summary.content}\n\n`;
    }

    if (subjects.length > 0) {
      const activeSubjects = subjects.filter((s: any) => !s.archived).slice(0, 5);
      const subjectDescriptions: any[] = activeSubjects.map((s: any) =>
        `- ${s.keywordCombination}: ${s.description || 'Active subject'}`
      ).join('\n');
      restartContext += `Active subjects:\n${subjectDescriptions}\n\n`;
    }

    if (keywords.length > 0) {
      const topKeywords = keywords
        .sort((a: any, b: any) => (b.frequency || 0) - (a.frequency || 0))
        .slice(0, 15)
        .map((k: any) => k.term);
      restartContext += `Key concepts: ${topKeywords.join(', ')}\n\n`;
    }

    restartContext += 'Please maintain continuity with the established discussion and context.';

    console.log('[TopicAnalysis] Generated restart context:', {
      topicId,
      contextLength: restartContext.length,
      hasSummary: !!summary,
      subjectCount: subjects.length,
      keywordCount: keywords.length
    });

    return {
      success: true,
      data: {
        context: restartContext,
        summary: summary,
        subjects: subjects.filter((s: any) => !s.archived),
        keywords: keywords.slice(0, 15)
      }
    };
  } catch (error) {
    console.error('[TopicAnalysis] Error getting restart context:', error);
    return {
      success: false,
      error: (error as Error).message,
      data: {
        context: 'Continuing previous conversation. Please maintain context.',
        summary: null,
        subjects: [],
        keywords: []
      }
    };
  }
}

/**
 * Update or create summary for a topic
 */
export async function updateSummary(event: IpcMainInvokeEvent, { topicId, content, changeReason, autoGenerate = false }: UpdateSummaryParams): Promise<IpcResponse> {
  console.log('[TopicAnalysis] Updating summary for topic:', topicId);

  try {
    const model: any = await initializeModel();

    const currentSummary: any = await model.getCurrentSummary(topicId);
    const newVersion = currentSummary ? currentSummary.version + 1 : 1;

    let summaryContent = content;
    let modelId: string | null = null;

    // Get model ID from AI assistant model (source of truth)
    if (nodeOneCoreInstance.aiAssistantModel) {
      modelId = nodeOneCoreInstance.aiAssistantModel.getModelIdForTopic(topicId);
    }

    // If autoGenerate is true, use LLM to create a new summary
    if (autoGenerate && !content) {
      const { default: llmManager } = await import('../../services/llm-manager.js');
      if (llmManager && modelId) {
        // Get recent messages for context
        const chatHandlers: any = await import('./chat.js');
        const messagesResponse: any = await chatHandlers.default.getMessages(event, {
          conversationId: topicId,
          limit: 50
        });
        const messages = messagesResponse.data || [];

        if (messages.length > 0) {
          const conversationText = messages
            .map((msg: any) => `${msg.sender || 'Unknown'}: ${msg.content || msg.text || ''}`)
            .join('\n');

          const summaryPrompt = `Create an updated summary of this conversation.
${currentSummary ? `Previous summary: ${currentSummary.content}\n\n` : ''}
Focus on: recent developments, new topics, changes in discussion.
Keep it under 150 words.

Recent conversation:
${String(conversationText).substring(0, 3000)}`;

          const summaryResponse: any = await llmManager.chat([{
            role: 'user',
            content: summaryPrompt
          }], modelId);

          summaryContent = summaryResponse;
          changeReason = changeReason || 'AI-generated update based on new messages';
        }
      }
    }

    const newSummary: any = await model.createSummary(
      topicId,
      newVersion,
      summaryContent || content || '',
      [],
      changeReason || 'Manual update',
      currentSummary ? currentSummary.id : null
    );

    return {
      success: true,
      data: {
        summary: newSummary
      }
    };
  } catch (error) {
    console.error('[TopicAnalysis] Error updating summary:', error);
    return {
      success: false,
      error: (error as Error).message,
      data: {
        summary: null
      }
    };
  }
}

/**
 * Extract keywords from text using LLM
 */
export async function extractKeywords(event: IpcMainInvokeEvent, { text, limit = 10 }: ExtractKeywordsParams): Promise<IpcResponse> {
  console.log('[TopicAnalysis] Extracting keywords from text');

  try {
    const model: any = await initializeModel();
    const { default: llmManager } = await import('../../services/llm-manager.js');

    if (!llmManager) {
      // Fallback to simple extraction
      const words = text.toLowerCase().split(/\s+/);
      const wordMap = new Map<string, number>();

      words.forEach(word => {
        if (word.length > 4) {
          wordMap.set(word, (wordMap.get(word) || 0) + 1);
        }
      });

      const keywords = Array.from(wordMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([word, freq]) => ({
          term: word,
          frequency: freq,
          score: freq / words.length
        }));

      return {
        success: true,
        data: { keywords }
      };
    }

    // Get model ID for LLM processing
    let modelId: string | null = null;
    if (nodeOneCoreInstance.aiAssistantModel) {
      // Try to get from a default topic - this might need improvement
      const aiContacts = nodeOneCoreInstance.aiAssistantModel.getAllContacts();
      if (aiContacts.length > 0) {
        modelId = aiContacts[0].modelId;
      }
    }

    if (!modelId) {
      throw new Error('No AI model available for keyword extraction');
    }

    // Use LLM for intelligent keyword extraction
    const keywordPrompt = `Extract the ${limit} most important keywords from this text.
Focus on: key concepts, technical terms, main topics, entities.
Return ONLY a JSON array of keywords, no explanation.

Text:
${String(text).substring(0, 2000)}

Return format: ["keyword1", "keyword2", ...]`;

    const response: any = await llmManager.chat([{
      role: 'user',
      content: keywordPrompt
    }], modelId);

    let extractedKeywords: string[] = [];
    try {
      extractedKeywords = JSON.parse(response);
    } catch (e) {
      // Fallback: extract from response
      extractedKeywords = String(response).match(/"([^"]+)"/g)?.map(k => k.replace(/"/g, '')) || [];
    }

    const keywords: any[] = extractedKeywords.slice(0, limit).map((term, index) => ({
      term,
      frequency: limit - index, // Higher frequency for more important keywords
      score: (limit - index) / limit
    }));

    return {
      success: true,
      data: {
        keywords
      }
    };
  } catch (error) {
    console.error('[TopicAnalysis] Error extracting keywords:', error);
    return {
      success: false,
      error: (error as Error).message,
      data: {
        keywords: []
      }
    };
  }
}

/**
 * Merge two subjects into one
 */
export async function mergeSubjects(event: IpcMainInvokeEvent, { topicId, subjectId1, subjectId2 }: MergeSubjectsParams): Promise<IpcResponse> {
  console.log('[TopicAnalysis] Merging subjects:', subjectId1, subjectId2);

  try {
    // This would need to be implemented in the model
    // For now, return success
    return {
      success: true,
      data: {
        merged: true
      }
    };
  } catch (error) {
    console.error('[TopicAnalysis] Error merging subjects:', error);
    return {
      success: false,
      error: (error as Error).message,
      data: {
        merged: false
      }
    };
  }
}

/**
 * Extract single-word keywords for real-time display using LLM
 * Returns array of single words only (no phrases)
 */
export async function extractRealtimeKeywords(event: IpcMainInvokeEvent, { text, existingKeywords = [], maxKeywords = 15 }: RealtimeKeywordsParams): Promise<IpcResponse> {
  console.log('[TopicAnalysis] Extracting realtime keywords with LLM');

  try {
    // Get LLM manager
    const { default: llmManager } = await import('../../services/llm-manager.js');

    if (!llmManager) {
      console.error('[TopicAnalysis] LLM Manager not available - cannot extract keywords');
      return {
        success: false,
        error: 'LLM not available for keyword extraction',
        data: {
          keywords: existingKeywords // Keep existing keywords if LLM unavailable
        }
      };
    }

    // Get model ID
    let modelId: string | null = null;
    if (nodeOneCoreInstance.aiAssistantModel) {
      const aiContacts = nodeOneCoreInstance.aiAssistantModel.getAllContacts();
      if (aiContacts.length > 0) {
        modelId = aiContacts[0].modelId;
      }
    }

    if (!modelId) {
      throw new Error('No AI model available for keyword extraction');
    }

    // Use LLM for intelligent keyword extraction
    const prompt = `Extract the most important single-word keywords from this text.
Focus on: specific topics, domain-specific terms, meaningful nouns, key concepts.
Avoid: common words, verbs, adjectives, pronouns, prepositions.
Return ONLY single words that capture the essence of the content.
${existingKeywords.length > 0 ? `Current keywords: ${existingKeywords.join(', ')}` : ''}

Text: "${text}"

Return exactly ${maxKeywords} single-word keywords as a JSON array.
Example: ["pizza", "delivery", "restaurant", "italian"]`;

    const response: any = await llmManager.chat([{
      role: 'user',
      content: prompt
    }], modelId);

    let keywords: string[] = [];
    try {
      // Try to parse as JSON
      const jsonMatch = String(response).match(/\[.*\]/s);
      if (jsonMatch) {
        keywords = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Fallback: extract words from response
      keywords = String(response).match(/\b\w{4,}\b/g) || [];
    }

    // Ensure single words only
    keywords = keywords
      .filter(k => typeof k === 'string' && !k.includes(' ') && k.length >= 4)
      .slice(0, maxKeywords);

    // Merge with existing keywords intelligently
    const mergedSet = new Set([...keywords, ...existingKeywords]);
    const finalKeywords = Array.from(mergedSet).slice(0, maxKeywords);

    return {
      success: true,
      data: {
        keywords: finalKeywords
      }
    };
  } catch (error) {
    console.error('[TopicAnalysis] Error extracting realtime keywords:', error);
    return {
      success: false,
      error: (error as Error).message,
      data: {
        keywords: existingKeywords
      }
    };
  }
}

/**
 * Extract keywords from all messages in a conversation using LLM
 * Returns single words only for real-time display
 */
export async function extractConversationKeywords(event: IpcMainInvokeEvent, { topicId, messages = [], maxKeywords = 15 }: ConversationKeywordsParams): Promise<IpcResponse> {
  console.log('[TopicAnalysis] Extracting conversation keywords with LLM for topic:', topicId);

  try {
    // Get LLM manager
    const { default: llmManager } = await import('../../services/llm-manager.js');

    if (!llmManager) {
      console.error('[TopicAnalysis] LLM Manager not available');
      return {
        success: false,
        error: 'LLM not available for keyword extraction',
        data: {
          keywords: []
        }
      };
    }

    // Get model ID from AI assistant model (source of truth)
    const nodeOneCoreInstance = getNodeOneCoreInstance();
    let modelId: string | null = null;
    if (nodeOneCoreInstance && nodeOneCoreInstance.aiAssistantModel) {
      modelId = nodeOneCoreInstance.aiAssistantModel.getModelIdForTopic(topicId);
    }

    if (!modelId) {
      console.error('[TopicAnalysis] No AI model configured for topic:', topicId);
      return {
        success: false,
        error: 'No AI model configured for this topic',
        data: {
          keywords: []
        }
      };
    }

    // If no messages provided, get them from conversation
    if (!messages || messages.length === 0) {
      const chatHandlers: any = await import('./chat.js');
      const messagesResponse: any = await chatHandlers.default.getMessages(event, { conversationId: topicId });
      messages = messagesResponse.messages || [];
    }

    if (messages.length === 0) {
      return {
        success: true,
        data: {
          keywords: []
        }
      };
    }

    // Prepare conversation text for LLM
    const conversationText = messages
      .slice(-20) // Last 20 messages for context
      .map((m: any) => m.content || m.text || '')
      .join('\n');

    // Don't try to extract keywords from empty content
    if (!conversationText.trim()) {
      return {
        success: true,
        data: {
          keywords: []
        }
      };
    }

    // Use LLM to extract meaningful keywords
    const prompt = `Analyze this conversation and extract the most important single-word keywords.

IMPORTANT: Even short messages can contain critical information. Focus on CONTEXT and MEANING, not length.
For example: "deploy production" -> ["deploy", "production"]
"bitcoin crashed" -> ["bitcoin", "crashed"]

Extract keywords for:
- Technical terms, commands, or operations mentioned
- Product names, systems, or services discussed
- Important events, actions, or states
- Domain-specific vocabulary
- Critical concepts regardless of message length

Skip keywords only if the conversation is PURELY social pleasantries with zero informational content.
Examples to skip: "Hi, how are you?" "Good thanks, you?" "Great!"

Conversation:
"${String(conversationText).substring(0, 2000)}"

Return up to ${maxKeywords} single-word keywords as a JSON array.
Keywords should be lowercase and capture the essence of what's being discussed.
If truly no meaningful content exists (only pure greetings), return [].
Example: ["blockchain", "ethereum", "smartcontract", "defi", "wallet"]`;

    const response: any = await llmManager.chat([{
      role: 'user',
      content: prompt
    }], modelId);

    let keywords: string[] = [];
    try {
      // Parse LLM response as JSON
      const jsonMatch = String(response).match(/\[.*\]/s);
      if (jsonMatch) {
        keywords = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('[TopicAnalysis] Failed to parse LLM response as JSON, extracting keywords from text');
      // Fallback: extract meaningful words from response
      keywords = response
        .toLowerCase()
        .match(/\b[a-z]{4,}\b/g) || [];
    }

    // Ensure we have single words only, no phrases
    keywords = keywords
      .filter(k => typeof k === 'string' && !k.includes(' ') && k.length >= 4)
      .map(k => k.toLowerCase())
      .slice(0, maxKeywords);

    console.log('[TopicAnalysis] LLM extracted keywords:', keywords);

    return {
      success: true,
      data: {
        keywords: keywords
      }
    };
  } catch (error) {
    console.error('[TopicAnalysis] Error extracting conversation keywords:', error);
    return {
      success: false,
      error: (error as Error).message,
      data: {
        keywords: []
      }
    };
  }
}

/**
 * Get all keywords for a topic
 */
async function getKeywords(event: IpcMainInvokeEvent, params: { topicId: string; limit?: number }): Promise<any> {
  try {
    console.log('[TopicAnalysis] 🔍 Getting keywords for topic:', params.topicId, 'limit:', params.limit);

    const model: any = await initializeModel();
    const keywords: any = await model.getKeywords(params.topicId);

    console.log('[TopicAnalysis] 🔍 Raw keywords from model:', keywords.length, 'keywords');
    if (keywords.length > 0) {
      console.log('[TopicAnalysis] 🔍 First few keywords:', keywords.slice(0, 3).map((k: any) => k.term || k));
    }

    // Keywords come ONLY from LLM responses via chatWithAnalysis()
    // Never extract keywords on-demand - that's wasteful and wrong
    // If no keywords exist, return empty array

    // Apply limit if specified
    const limitedKeywords = params.limit ? keywords.slice(0, params.limit) : keywords;

    console.log('[TopicAnalysis] ✅ Retrieved keywords:', {
      topicId: params.topicId,
      keywordCount: limitedKeywords.length,
      limit: params.limit,
      keywords: limitedKeywords.map((k: any) => k.term || k)
    });

    return {
      success: true,
      data: {
        keywords: limitedKeywords
      }
    };
  } catch (error) {
    console.error('[TopicAnalysis] Error getting keywords:', error);
    return {
      success: false,
      error: (error as Error).message,
      data: {
        keywords: []
      }
    };
  }
}

// Export all handlers
export default {
  analyzeMessages,
  getSubjects,
  getSummary,
  updateSummary,
  extractKeywords,
  mergeSubjects,
  getConversationRestartContext,
  extractRealtimeKeywords,
  extractConversationKeywords,
  getKeywords
};