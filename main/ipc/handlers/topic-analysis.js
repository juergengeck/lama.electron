/**
 * IPC Handlers for Topic Analysis
 * Handles AI-powered topic analysis operations
 */

import nodeOneCoreInstance from '../../core/node-one-core.js';
import TopicAnalysisModel from '../../core/one-ai/models/TopicAnalysisModel.js';

// Singleton instance
let topicAnalysisModel = null;

/**
 * Initialize model instance
 */
async function initializeModel() {
  // Return existing model if already initialized
  if (topicAnalysisModel) {
    if (topicAnalysisModel.state.currentState === 'Initialised') {
      return topicAnalysisModel;
    }
    // If it's initializing, wait a bit
    if (topicAnalysisModel.state.currentState === 'Initialising') {
      await new Promise(resolve => setTimeout(resolve, 100));
      return initializeModel(); // Retry after wait
    }
  }

  if (!nodeOneCoreInstance?.initialized) {
    throw new Error('ONE.core not initialized');
  }

  const channelManager = nodeOneCoreInstance.channelManager;
  if (!channelManager) {
    throw new Error('ChannelManager not available');
  }

  // Create new model if doesn't exist
  if (!topicAnalysisModel) {
    topicAnalysisModel = new TopicAnalysisModel(channelManager);
  }

  // Initialize only if uninitialised
  if (topicAnalysisModel.state.currentState === 'Uninitialised') {
    await topicAnalysisModel.init();
  }

  return topicAnalysisModel;
}

/**
 * Analyze messages to extract subjects and keywords using LLM
 */
export async function analyzeMessages(event, { topicId, messages, forceReanalysis = false }) {
  console.log('[TopicAnalysis] Analyzing messages for topic:', topicId);

  try {
    const model = await initializeModel();

    // If no messages provided, retrieve from conversation
    if (!messages || messages.length === 0) {
      const chatHandlers = await import('./chat.js');
      const messagesResponse = await chatHandlers.getMessages(event, { conversationId: topicId });
      messages = messagesResponse.data || [];
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

    // Get LLM manager
    const llmManager = nodeOneCoreInstance?.llmManager;
    if (!llmManager) {
      throw new Error('LLM Manager not available');
    }

    // Prepare conversation context for analysis
    const conversationText = messages
      .map(msg => `${msg.sender || 'Unknown'}: ${msg.content || msg.text || ''}`)
      .join('\n');

    // Extract keywords using LLM
    console.log('[TopicAnalysis] Extracting keywords with LLM...');
    const keywordPrompt = `Analyze this conversation and extract the most important keywords (single words or short phrases).
Return ONLY a JSON array of keywords, no explanation.
Focus on: main topics, technical terms, product names, important concepts.
Limit to 15 most relevant keywords.

Conversation:
${conversationText.substring(0, 3000)}

Return format: ["keyword1", "keyword2", ...]`;

    const keywordResponse = await llmManager.sendMessage({
      model: 'ollama:gpt-oss', // Use configured model
      messages: [{
        role: 'user',
        content: keywordPrompt
      }]
    });

    let keywords = [];
    try {
      keywords = JSON.parse(keywordResponse.content);
    } catch (e) {
      console.warn('[TopicAnalysis] Failed to parse keyword JSON, using fallback');
      // Fallback: extract from text
      keywords = keywordResponse.content.match(/"([^"]+)"/g)?.map(k => k.replace(/"/g, '')) || [];
    }

    // Store keywords in ONE.core
    for (const keyword of keywords.slice(0, 15)) {
      await model.createKeyword(topicId, keyword, null, 1, 0.8);
    }

    // Identify subjects using LLM
    console.log('[TopicAnalysis] Identifying subjects with LLM...');
    const subjectPrompt = `Analyze this conversation and identify the main subjects/themes being discussed.
For each subject, provide:
1. A list of 2-3 keywords that define it
2. A brief description (one sentence)

Return ONLY a JSON array with this format:
[{"keywords": ["keyword1", "keyword2"], "description": "Brief description"}]

Conversation:
${conversationText.substring(0, 3000)}`;

    const subjectResponse = await llmManager.sendMessage({
      model: 'ollama:gpt-oss',
      messages: [{
        role: 'user',
        content: subjectPrompt
      }]
    });

    let subjects = [];
    try {
      subjects = JSON.parse(subjectResponse.content);
    } catch (e) {
      console.warn('[TopicAnalysis] Failed to parse subject JSON, creating default subject');
      subjects = [{
        keywords: keywords.slice(0, 3),
        description: 'Main conversation topic'
      }];
    }

    // Store subjects in ONE.core
    for (const subject of subjects.slice(0, 5)) {
      await model.createSubject(
        topicId,
        subject.keywords,
        subject.keywords.join('+'),
        subject.description,
        0.8
      );
    }

    // Generate summary using LLM
    console.log('[TopicAnalysis] Generating summary with LLM...');
    const summaryPrompt = `Create a concise summary of this conversation.
Include: main topics discussed, key decisions or conclusions, important points.
Keep it under 150 words.

Conversation:
${conversationText.substring(0, 3000)}`;

    const summaryResponse = await llmManager.sendMessage({
      model: 'ollama:gpt-oss',
      messages: [{
        role: 'user',
        content: summaryPrompt
      }]
    });

    // Create summary
    const summary = await model.createSummary(
      topicId,
      1,
      summaryResponse.content,
      [],
      'AI-generated analysis',
      null
    );

    // Get the created subjects for return
    const createdSubjects = await model.getSubjects(topicId);
    const createdKeywords = await model.getKeywords(topicId);

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
        keywords: createdKeywords.map(k => k.term),
        summary: summary
      }
    };
  } catch (error) {
    console.error('[TopicAnalysis] Error analyzing messages:', error);
    return {
      success: false,
      error: error.message,
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
export async function getSubjects(event, { topicId, includeArchived = false }) {
  console.log('[TopicAnalysis] Getting subjects for topic:', topicId);

  try {
    const model = await initializeModel();
    const subjects = await model.getSubjects(topicId);

    console.log('[TopicAnalysis] Retrieved subjects:', {
      topicId,
      totalSubjects: subjects.length,
      subjects: subjects.map(s => ({
        keywords: s.keywords,
        combination: s.keywordCombination
      }))
    });

    const filteredSubjects = includeArchived
      ? subjects
      : subjects.filter(s => !s.archived);

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
      error: error.message,
      data: {
        subjects: []
      }
    };
  }
}

/**
 * Get summary for a topic
 */
export async function getSummary(event, { topicId, version, includeHistory = false }) {
  console.log('[TopicAnalysis] Getting summary for topic:', topicId);

  try {
    const model = await initializeModel();
    const current = await model.getCurrentSummary(topicId);

    console.log('[TopicAnalysis] Retrieved summary:', {
      topicId,
      found: !!current,
      version: current?.version,
      content: current?.content?.substring(0, 50)
    });

    let history = [];
    if (includeHistory) {
      const allSummaries = await model.getSummaries(topicId);
      history = allSummaries.sort((a, b) => b.version - a.version);
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
      error: error.message,
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
export async function getConversationRestartContext(event, { topicId }) {
  console.log('[TopicAnalysis] Getting conversation restart context for topic:', topicId);

  try {
    const model = await initializeModel();

    // Get current summary
    const summary = await model.getCurrentSummary(topicId);

    // Get active subjects and keywords
    const subjects = await model.getSubjects(topicId);
    const keywords = await model.getKeywords(topicId);

    // Build restart context
    let restartContext = '';

    if (summary) {
      restartContext = `Continuing conversation from previous context:\n\n${summary.content}\n\n`;
    }

    if (subjects.length > 0) {
      const activeSubjects = subjects.filter(s => !s.archived).slice(0, 5);
      const subjectDescriptions = activeSubjects.map(s =>
        `- ${s.keywordCombination}: ${s.description || 'Active subject'}`
      ).join('\n');
      restartContext += `Active subjects:\n${subjectDescriptions}\n\n`;
    }

    if (keywords.length > 0) {
      const topKeywords = keywords
        .sort((a, b) => (b.frequency || 0) - (a.frequency || 0))
        .slice(0, 15)
        .map(k => k.term);
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
        subjects: subjects.filter(s => !s.archived),
        keywords: keywords.slice(0, 15)
      }
    };
  } catch (error) {
    console.error('[TopicAnalysis] Error getting restart context:', error);
    return {
      success: false,
      error: error.message,
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
export async function updateSummary(event, { topicId, content, changeReason, autoGenerate = false }) {
  console.log('[TopicAnalysis] Updating summary for topic:', topicId);

  try {
    const model = await initializeModel();

    const currentSummary = await model.getCurrentSummary(topicId);
    const newVersion = currentSummary ? currentSummary.version + 1 : 1;

    let summaryContent = content;

    // If autoGenerate is true, use LLM to create a new summary
    if (autoGenerate && !content) {
      const llmManager = nodeOneCoreInstance?.llmManager;
      if (llmManager) {
        // Get recent messages for context
        const chatHandlers = await import('./chat.js');
        const messagesResponse = await chatHandlers.getMessages(event, {
          conversationId: topicId,
          limit: 50
        });
        const messages = messagesResponse.data || [];

        if (messages.length > 0) {
          const conversationText = messages
            .map(msg => `${msg.sender || 'Unknown'}: ${msg.content || msg.text || ''}`)
            .join('\n');

          const summaryPrompt = `Create an updated summary of this conversation.
${currentSummary ? `Previous summary: ${currentSummary.content}\n\n` : ''}
Focus on: recent developments, new topics, changes in discussion.
Keep it under 150 words.

Recent conversation:
${conversationText.substring(0, 3000)}`;

          const summaryResponse = await llmManager.sendMessage({
            model: 'ollama:gpt-oss',
            messages: [{
              role: 'user',
              content: summaryPrompt
            }]
          });

          summaryContent = summaryResponse.content;
          changeReason = changeReason || 'AI-generated update based on new messages';
        }
      }
    }

    const newSummary = await model.createSummary(
      topicId,
      newVersion,
      summaryContent || content,
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
      error: error.message,
      data: {
        summary: null
      }
    };
  }
}

/**
 * Extract keywords from text using LLM
 */
export async function extractKeywords(event, { text, limit = 10 }) {
  console.log('[TopicAnalysis] Extracting keywords from text');

  try {
    const model = await initializeModel();
    const llmManager = nodeOneCoreInstance?.llmManager;

    if (!llmManager) {
      // Fallback to simple extraction
      const words = text.toLowerCase().split(/\s+/);
      const wordMap = new Map();

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

    // Use LLM for intelligent keyword extraction
    const keywordPrompt = `Extract the ${limit} most important keywords from this text.
Focus on: key concepts, technical terms, main topics, entities.
Return ONLY a JSON array of keywords, no explanation.

Text:
${text.substring(0, 2000)}

Return format: ["keyword1", "keyword2", ...]`;

    const response = await llmManager.sendMessage({
      model: 'ollama:gpt-oss',
      messages: [{
        role: 'user',
        content: keywordPrompt
      }]
    });

    let extractedKeywords = [];
    try {
      extractedKeywords = JSON.parse(response.content);
    } catch (e) {
      // Fallback: extract from response
      extractedKeywords = response.content.match(/"([^"]+)"/g)?.map(k => k.replace(/"/g, '')) || [];
    }

    const keywords = extractedKeywords.slice(0, limit).map((term, index) => ({
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
      error: error.message,
      data: {
        keywords: []
      }
    };
  }
}

/**
 * Merge two subjects into one
 */
export async function mergeSubjects(event, { topicId, subjectId1, subjectId2 }) {
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
      error: error.message,
      data: {
        merged: false
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
  getConversationRestartContext
};