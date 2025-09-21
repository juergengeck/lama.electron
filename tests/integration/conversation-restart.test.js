/**
 * Tests for conversation restart functionality
 * Verifies context window management and summary-based continuation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AIAssistantModel from '../../main/core/ai-assistant-model.js';

describe('Conversation Restart with Summaries', () => {
  let aiModel;
  let mockNodeOneCore;
  let mockTopicRoom;
  let mockMessages;

  beforeEach(() => {
    // Mock messages to simulate a long conversation
    mockMessages = [];
    for (let i = 0; i < 100; i++) {
      mockMessages.push({
        data: {
          text: `Message ${i}: This is a test message with some content to make it reasonably sized for token counting purposes.`,
          sender: i % 2 === 0 ? 'user123' : 'ai456'
        },
        author: i % 2 === 0 ? 'user123' : 'ai456'
      });
    }

    // Mock topic room
    mockTopicRoom = {
      retrieveAllMessages: jest.fn(() => Promise.resolve(mockMessages)),
      sendMessage: jest.fn()
    };

    // Mock topic analysis model
    const mockTopicAnalysisModel = {
      getSummary: jest.fn(() => Promise.resolve({
        content: 'Previous conversation discussed testing, implementation, and architecture design.'
      })),
      getSubjects: jest.fn(() => Promise.resolve([
        { keywords: ['testing', 'jest'], keywordCombination: 'testing+jest', description: 'Testing framework' },
        { keywords: ['architecture', 'design'], keywordCombination: 'architecture+design', description: 'System design' }
      ])),
      getKeywords: jest.fn(() => Promise.resolve([
        { term: 'testing', frequency: 10 },
        { term: 'architecture', frequency: 8 },
        { term: 'implementation', frequency: 7 }
      ]))
    };

    // Mock node one core
    mockNodeOneCore = {
      topicModel: {
        enterTopicRoom: jest.fn(() => Promise.resolve(mockTopicRoom))
      },
      topicAnalysisModel: mockTopicAnalysisModel,
      channelManager: {},
      llmManager: {
        chat: jest.fn((history, modelId, options) => {
          // Simulate streaming response
          if (options && options.onStream) {
            const response = 'This is a test response maintaining context.';
            response.split(' ').forEach(chunk => {
              options.onStream(chunk + ' ');
            });
          }
          return Promise.resolve('This is a test response maintaining context.');
        }),
        getAvailableModels: jest.fn(() => [
          { id: 'test-model', name: 'Test Model' }
        ]),
        defaultModelId: 'test-model'
      }
    };

    aiModel = new AIAssistantModel(mockNodeOneCore);
    aiModel.llmManager = mockNodeOneCore.llmManager;
    aiModel.isInitialized = true;
    aiModel.registerAITopic('test-topic', 'test-model');
    aiModel.aiContacts.set('test-model', 'ai456');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Context Window Monitoring', () => {
    it('should detect when context window is filling up', async () => {
      const result = await aiModel.checkContextWindowAndPrepareRestart('test-topic', mockMessages);

      expect(result.needsRestart).toBe(true);
      expect(result.restartContext).toBeTruthy();
      expect(result.restartContext).toContain('Previous conversation discussed testing');
    });

    it('should not restart for short conversations', async () => {
      const shortMessages = mockMessages.slice(0, 5);
      const result = await aiModel.checkContextWindowAndPrepareRestart('test-topic', shortMessages);

      expect(result.needsRestart).toBe(false);
      expect(result.restartContext).toBe(null);
    });

    it('should estimate tokens correctly', async () => {
      // Test with known message length
      const testMessages = [{
        data: { text: 'test' } // 4 chars = ~1 token
      }];

      const result = await aiModel.checkContextWindowAndPrepareRestart('test-topic', testMessages);
      expect(result.needsRestart).toBe(false);
    });
  });

  describe('Summary Generation for Restart', () => {
    it('should generate summary using topic analysis when available', async () => {
      const summary = await aiModel.generateConversationSummaryForRestart('test-topic', mockMessages);

      expect(summary).toContain('Previous conversation discussed testing');
      expect(summary).toContain('Key topics: testing, architecture, implementation');
      expect(summary).toContain('Maintain continuity');
    });

    it('should fallback to basic summary when topic analysis unavailable', async () => {
      mockNodeOneCore.topicAnalysisModel = null;

      const summary = await aiModel.generateConversationSummaryForRestart('test-topic', mockMessages.slice(-20));

      expect(summary).toContain('Continuing conversation');
      expect(summary).toContain('messages discussed');
    });

    it('should handle summary generation errors gracefully', async () => {
      mockNodeOneCore.topicAnalysisModel.getSummary.mockRejectedValue(new Error('Test error'));

      const summary = await aiModel.generateConversationSummaryForRestart('test-topic', mockMessages);

      expect(summary).toContain('Continuing');
      expect(summary).not.toContain('undefined');
    });
  });

  describe('Message Processing with Restart', () => {
    it('should use summary context when restarting conversation', async () => {
      // Spy on checkContextWindowAndPrepareRestart
      const checkSpy = jest.spyOn(aiModel, 'checkContextWindowAndPrepareRestart');

      await aiModel.processMessage('test-topic', 'New message after long conversation', 'user123');

      expect(checkSpy).toHaveBeenCalledWith('test-topic', mockMessages);

      // Verify chat was called with summary context
      const chatCalls = mockNodeOneCore.llmManager.chat.mock.calls;
      expect(chatCalls.length).toBeGreaterThan(0);

      const history = chatCalls[0][0];
      const systemMessage = history.find(msg => msg.role === 'system');
      expect(systemMessage).toBeTruthy();
      expect(systemMessage.content).toContain('Previous conversation discussed');
    });

    it('should include only recent messages after restart', async () => {
      await aiModel.processMessage('test-topic', 'New message', 'user123');

      const chatCalls = mockNodeOneCore.llmManager.chat.mock.calls;
      const history = chatCalls[0][0];

      // Should have system message + only last few messages
      const userMessages = history.filter(msg => msg.role === 'user');
      expect(userMessages.length).toBeLessThanOrEqual(4); // Last 3 messages + new one
    });

    it('should use normal context for short conversations', async () => {
      const shortMessages = mockMessages.slice(0, 5);
      mockTopicRoom.retrieveAllMessages.mockResolvedValue(shortMessages);

      await aiModel.processMessage('test-topic', 'New message', 'user123');

      const chatCalls = mockNodeOneCore.llmManager.chat.mock.calls;
      const history = chatCalls[0][0];

      // Should not have restart context
      const systemMessages = history.filter(msg => msg.role === 'system');
      expect(systemMessages.every(msg => !msg.content.includes('Previous conversation discussed'))).toBe(true);
    });
  });

  describe('Manual Restart Trigger', () => {
    it('should allow manual conversation restart', async () => {
      const summary = await aiModel.restartConversationWithSummary('test-topic');

      expect(summary).toBeTruthy();
      expect(summary).toContain('Previous conversation discussed');
      expect(aiModel.topicRestartSummaries).toBeDefined();
      expect(aiModel.topicRestartSummaries.has('test-topic')).toBe(true);
    });

    it('should store restart metadata', async () => {
      await aiModel.restartConversationWithSummary('test-topic');

      const metadata = aiModel.topicRestartSummaries.get('test-topic');
      expect(metadata).toBeDefined();
      expect(metadata.summary).toBeTruthy();
      expect(metadata.timestamp).toBeLessThanOrEqual(Date.now());
      expect(metadata.messageCountAtRestart).toBe(100);
    });
  });

  describe('Integration with Context Enrichment', () => {
    it('should prefer restart context over normal enrichment when needed', async () => {
      // Mock context enrichment service
      aiModel.contextEnrichmentService = {
        buildEnhancedContext: jest.fn(() => Promise.resolve('[Active concepts: different context]'))
      };

      await aiModel.processMessage('test-topic', 'New message', 'user123');

      // Should use restart context, not enrichment
      const chatCalls = mockNodeOneCore.llmManager.chat.mock.calls;
      const history = chatCalls[0][0];
      const systemMessage = history.find(msg => msg.role === 'system');

      expect(systemMessage.content).toContain('Previous conversation discussed');
      expect(systemMessage.content).not.toContain('Active concepts: different context');
    });

    it('should use enrichment for normal conversations', async () => {
      const shortMessages = mockMessages.slice(0, 5);
      mockTopicRoom.retrieveAllMessages.mockResolvedValue(shortMessages);

      aiModel.contextEnrichmentService = {
        buildEnhancedContext: jest.fn(() => Promise.resolve('[Active concepts: normal context]'))
      };

      await aiModel.processMessage('test-topic', 'New message', 'user123');

      const chatCalls = mockNodeOneCore.llmManager.chat.mock.calls;
      const history = chatCalls[0][0];
      const systemMessage = history.find(msg => msg.role === 'system');

      expect(systemMessage.content).toBe('[Active concepts: normal context]');
    });
  });
});