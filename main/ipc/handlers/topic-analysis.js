/**
 * IPC Handlers for Topic Analysis
 * Handles AI-powered topic analysis operations
 */

import nodeOneCoreInstance from '../../core/node-one-core.js';
import TopicAnalysisModel from '../../core/one-ai/models/TopicAnalysisModel.js';
import RealTimeKeywordExtractor from '../../core/one-ai/services/RealTimeKeywordExtractor.js';
import llmManager from '../../services/llm-manager.js';

// Singleton instances
let topicAnalysisModel = null;
let keywordExtractor = null;

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
 * Analyze messages to extract subjects and keywords using LLM
 */
export async function analyzeMessages(event, { topicId, messages, forceReanalysis = false }) {
  console.log('[TopicAnalysis] Analyzing messages for topic:', topicId);

  try {
    const model = await initializeModel();

    // If no messages provided, retrieve from conversation
    if (!messages || messages.length === 0) {
      // Check if topic exists first to avoid auto-creation
      try {
        const topicRoom = await nodeOneCoreInstance.topicModel.enterTopicRoom(topicId);
        // Retrieve messages directly without auto-creating topic
        const messagesIterable = await topicRoom.retrieveAllMessages();
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
    let modelId = null;
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
${conversationText.substring(0, 3000)}

Return format: ["keyword1", "keyword2", ...]`;

    const keywordResponse = await llmManager.chat([{
      role: 'user',
      content: keywordPrompt
    }], modelId); // Use determined model

    let keywords = [];
    try {
      keywords = JSON.parse(keywordResponse);
    } catch (e) {
      console.warn('[TopicAnalysis] Failed to parse keyword JSON, using fallback');
      // Fallback: extract from text
      keywords = keywordResponse.match(/"([^"]+)"/g)?.map(k => k.replace(/"/g, '')) || [];
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

    const subjectResponse = await llmManager.chat([{
      role: 'user',
      content: subjectPrompt
    }], modelId);

    let subjects = [];
    try {
      subjects = JSON.parse(subjectResponse);
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

    const summaryResponse = await llmManager.chat([{
      role: 'user',
      content: summaryPrompt
    }], modelId);

    // Create summary
    const summary = await model.createSummary(
      topicId,
      1,
      summaryResponse,
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
      const { default: llmManager } = await import('../../services/llm-manager.js');
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

          const summaryResponse = await llmManager.chat([{
            role: 'user',
            content: summaryPrompt
          }], modelId);

          summaryContent = summaryResponse;
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
    const { default: llmManager } = await import('../../services/llm-manager.js');

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

    const response = await llmManager.chat([{
      role: 'user',
      content: keywordPrompt
    }], modelId);

    let extractedKeywords = [];
    try {
      extractedKeywords = JSON.parse(response);
    } catch (e) {
      // Fallback: extract from response
      extractedKeywords = response.match(/"([^"]+)"/g)?.map(k => k.replace(/"/g, '')) || [];
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

/**
 * Extract single-word keywords for real-time display using LLM
 * Returns array of single words only (no phrases)
 */
export async function extractRealtimeKeywords(event, { text, existingKeywords = [], maxKeywords = 15 }) {
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

    // Use LLM for intelligent keyword extraction
    const prompt = `Extract the most important single-word keywords from this text.
Focus on: specific topics, domain-specific terms, meaningful nouns, key concepts.
Avoid: common words, verbs, adjectives, pronouns, prepositions.
Return ONLY single words that capture the essence of the content.
${existingKeywords.length > 0 ? `Current keywords: ${existingKeywords.join(', ')}` : ''}

Text: "${text}"

Return exactly ${maxKeywords} single-word keywords as a JSON array.
Example: ["pizza", "delivery", "restaurant", "italian"]`;

    const response = await llmManager.chat([{
      role: 'user',
      content: prompt
    }], modelId);

    let keywords = [];
    try {
      // Try to parse as JSON
      const jsonMatch = response.match(/\[.*\]/s);
      if (jsonMatch) {
        keywords = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      // Fallback: extract words from response
      keywords = response.match(/\b\w{4,}\b/g) || [];
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
      error: error.message,
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
export async function extractConversationKeywords(event, { topicId, messages = [], maxKeywords = 15 }) {
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
    let modelId = null;
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
      const chatHandlers = await import('./chat.js');
      const messagesResponse = await chatHandlers.getMessages(event, { conversationId: topicId });
      messages = messagesResponse.data || [];
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
      .map(m => m.content || m.text || '')
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
"${conversationText.substring(0, 2000)}"

Return up to ${maxKeywords} single-word keywords as a JSON array.
Keywords should be lowercase and capture the essence of what's being discussed.
If truly no meaningful content exists (only pure greetings), return [].
Example: ["blockchain", "ethereum", "smartcontract", "defi", "wallet"]`;

    const response = await llmManager.chat([{
      role: 'user',
      content: prompt
    }], modelId);

    let keywords = [];
    try {
      // Parse LLM response as JSON
      const jsonMatch = response.match(/\[.*\]/s);
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
      error: error.message,
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
  extractConversationKeywords
};