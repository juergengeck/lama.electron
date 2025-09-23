/**
 * Integration test for full HTML export flow
 * Tests creating a topic, adding messages, and exporting
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { ipcMain } from 'electron';
import controller from '../../main/ipc/controller.js';
import { JSDOM } from 'jsdom';

describe('HTML Export Full Flow Integration', () => {
  let testTopicId;
  let testMessages = [];

  beforeAll(() => {
    controller.initialize();
  });

  afterAll(() => {
    controller.cleanup?.();
  });

  beforeEach(async () => {
    // Create a test topic and add messages
    testTopicId = 'test-topic-' + Date.now();

    // This would normally create a topic and add messages
    // For now, we'll just set up the test data
    testMessages = [
      {
        id: 'msg1',
        content: 'Hello, this is the first message',
        author: { name: 'Alice', email: 'alice@example.com' },
        timestamp: new Date().toISOString()
      },
      {
        id: 'msg2',
        content: 'This is a reply with **bold** text',
        author: { name: 'Bob', email: 'bob@example.com' },
        timestamp: new Date().toISOString()
      },
      {
        id: 'msg3',
        content: 'Message with `code` and a link: https://example.com',
        author: { name: 'Alice', email: 'alice@example.com' },
        timestamp: new Date().toISOString()
      }
    ];
  });

  describe('Export Flow', () => {
    it('should export conversation with all messages', async () => {
      // This will fail until implementation
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: testTopicId,
        format: 'html-microdata'
      });

      expect(result.success).toBe(true);
      expect(result.html).toBeDefined();
      expect(result.metadata.messageCount).toBe(testMessages.length);
    });

    it('should preserve message content and formatting', async () => {
      // This will fail until implementation
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: testTopicId,
        format: 'html-microdata'
      });

      const dom = new JSDOM(result.html);
      const messages = dom.window.document.querySelectorAll('[itemtype*="Message"]');

      expect(messages).toHaveLength(testMessages.length);

      // Check first message content
      const firstMessage = messages[0].querySelector('[itemprop="content"]');
      expect(firstMessage.textContent).toContain('Hello, this is the first message');
    });

    it('should include author information for each message', async () => {
      // This will fail until implementation
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: testTopicId,
        format: 'html-microdata'
      });

      const dom = new JSDOM(result.html);
      const authors = dom.window.document.querySelectorAll('[itemprop="author"]');

      expect(authors).toHaveLength(testMessages.length);
      expect(authors[0].textContent).toContain('Alice');
      expect(authors[1].textContent).toContain('Bob');
    });

    it('should preserve markdown formatting in HTML', async () => {
      // This will fail until implementation
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: testTopicId,
        format: 'html-microdata'
      });

      // Check that markdown is converted properly
      expect(result.html).toContain('<strong>bold</strong>');
      expect(result.html).toContain('<code>code</code>');
    });
  });

  describe('Export Options', () => {
    it('should respect maxMessages option', async () => {
      // This will fail until implementation
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: testTopicId,
        format: 'html-microdata',
        options: {
          maxMessages: 2
        }
      });

      const dom = new JSDOM(result.html);
      const messages = dom.window.document.querySelectorAll('[itemtype*="Message"]');

      expect(messages).toHaveLength(2);
      expect(result.metadata.messageCount).toBe(2);
    });

    it('should filter by date range when specified', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // This will fail until implementation
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: testTopicId,
        format: 'html-microdata',
        options: {
          dateRange: {
            start: yesterday.toISOString(),
            end: tomorrow.toISOString()
          }
        }
      });

      expect(result.success).toBe(true);
      // All test messages should be within range
      expect(result.metadata.messageCount).toBe(testMessages.length);
    });

    it('should apply selected theme styles', async () => {
      // This will fail until implementation
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: testTopicId,
        format: 'html-microdata',
        options: {
          styleTheme: 'dark'
        }
      });

      expect(result.html).toContain('background-color: #1a1a1a');
    });

    it('should include signatures when requested', async () => {
      // This will fail until implementation
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: testTopicId,
        format: 'html-microdata',
        options: {
          includeSignatures: true
        }
      });

      const dom = new JSDOM(result.html);
      const messages = dom.window.document.querySelectorAll('[itemtype*="Message"]');

      // At least some messages should have signatures
      const signaturesFound = Array.from(messages).some(msg =>
        msg.hasAttribute('data-signature')
      );
      expect(signaturesFound).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should export 100 messages in under 2 seconds', async () => {
      // Create a topic with many messages
      const largeTopicId = 'large-topic-' + Date.now();
      // Would normally create 100 messages here

      const startTime = Date.now();

      // This will fail until implementation
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: largeTopicId,
        format: 'html-microdata'
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(2000); // Under 2 seconds
    });
  });

  describe('Self-contained HTML', () => {
    it('should not reference any external resources', async () => {
      // This will fail until implementation
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: testTopicId,
        format: 'html-microdata'
      });

      // Check for external references
      expect(result.html).not.toContain('src="http');
      expect(result.html).not.toContain('href="http');
      expect(result.html).not.toContain('@import');
    });

    it('should include all styles inline', async () => {
      // This will fail until implementation
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: testTopicId,
        format: 'html-microdata'
      });

      expect(result.html).toContain('<style>');
      expect(result.html).not.toContain('<link rel="stylesheet"');
    });
  });
});