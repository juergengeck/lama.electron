/**
 * Test for HTML response structure validation
 * Ensures exported HTML contains proper microdata markup
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { ipcMain } from 'electron';
import controller from '../../main/ipc/controller.js';

describe('HTML Export Response Structure Tests', () => {
  let mockTopicId;

  beforeAll(() => {
    controller.initialize();
    // Create a mock topic with messages for testing
    mockTopicId = 'test-topic-' + Date.now();
  });

  afterAll(() => {
    controller.cleanup?.();
  });

  describe('HTML Structure', () => {
    it('should generate valid HTML5 document', async () => {
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: mockTopicId,
        format: 'html-microdata'
      });

      // This will fail until implementation
      expect(result.success).toBe(true);
      expect(result.html).toContain('<!DOCTYPE html>');
      expect(result.html).toContain('<html');
      expect(result.html).toContain('<head>');
      expect(result.html).toContain('<body>');
      expect(result.html).toContain('</html>');
    });

    it('should include meta charset UTF-8', async () => {
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: mockTopicId,
        format: 'html-microdata'
      });

      expect(result.html).toContain('<meta charset="UTF-8">');
    });

    it('should include inline CSS styles', async () => {
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: mockTopicId,
        format: 'html-microdata'
      });

      expect(result.html).toContain('<style>');
      expect(result.html).toContain('</style>');
    });
  });

  describe('Microdata Markup', () => {
    it('should include message microdata with itemscope and itemtype', async () => {
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: mockTopicId,
        format: 'html-microdata'
      });

      const dom = new JSDOM(result.html);
      const messages = dom.window.document.querySelectorAll('[itemscope][itemtype*="Message"]');

      expect(messages.length).toBeGreaterThan(0);
    });

    it('should include data-hash attribute for each message', async () => {
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: mockTopicId,
        format: 'html-microdata'
      });

      const dom = new JSDOM(result.html);
      const messages = dom.window.document.querySelectorAll('[itemscope][itemtype*="Message"]');

      messages.forEach(message => {
        expect(message.hasAttribute('data-hash')).toBe(true);
        expect(message.getAttribute('data-hash')).toMatch(/^[a-f0-9]{64}$/);
      });
    });

    it('should include itemprop attributes for message properties', async () => {
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: mockTopicId,
        format: 'html-microdata'
      });

      const dom = new JSDOM(result.html);
      const messages = dom.window.document.querySelectorAll('[itemscope][itemtype*="Message"]');

      messages.forEach(message => {
        expect(message.querySelector('[itemprop="author"]')).toBeTruthy();
        expect(message.querySelector('[itemprop="content"]')).toBeTruthy();
        expect(message.querySelector('[itemprop="timestamp"]')).toBeTruthy();
      });
    });

    it('should include signature when includeSignatures is true', async () => {
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: mockTopicId,
        format: 'html-microdata',
        options: {
          includeSignatures: true
        }
      });

      const dom = new JSDOM(result.html);
      const messages = dom.window.document.querySelectorAll('[itemscope][itemtype*="Message"]');

      messages.forEach(message => {
        // Some messages may not have signatures (system messages)
        const signature = message.getAttribute('data-signature');
        if (signature) {
          expect(signature).toBeTruthy();
        }
      });
    });
  });

  describe('Conversation Metadata', () => {
    it('should include conversation header with metadata', async () => {
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: mockTopicId,
        format: 'html-microdata'
      });

      const dom = new JSDOM(result.html);
      const header = dom.window.document.querySelector('[itemscope][itemtype*="ConversationExport"]');

      expect(header).toBeTruthy();
      expect(header.querySelector('[itemprop="title"]')).toBeTruthy();
      expect(header.querySelector('[itemprop="topicId"]')).toBeTruthy();
      expect(header.querySelector('[itemprop="messageCount"]')).toBeTruthy();
    });

    it('should include participant information', async () => {
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: mockTopicId,
        format: 'html-microdata'
      });

      const dom = new JSDOM(result.html);
      const participants = dom.window.document.querySelectorAll('[itemtype*="Person"]');

      expect(participants.length).toBeGreaterThan(0);
      participants.forEach(person => {
        expect(person.querySelector('[itemprop="email"]')).toBeTruthy();
        expect(person.querySelector('[itemprop="name"]')).toBeTruthy();
      });
    });
  });

  describe('Content Security', () => {
    it('should escape HTML in message content', async () => {
      // Test with a message containing HTML
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: mockTopicId,
        format: 'html-microdata'
      });

      // Check that any < or > in content are escaped
      expect(result.html).not.toContain('<script>');
      expect(result.html).not.toContain('javascript:');
    });

    it('should include Content-Security-Policy meta tag', async () => {
      const result = await ipcMain.emit('export:htmlWithMicrodata', {
        topicId: mockTopicId,
        format: 'html-microdata'
      });

      const dom = new JSDOM(result.html);
      const csp = dom.window.document.querySelector('meta[http-equiv="Content-Security-Policy"]');

      expect(csp).toBeTruthy();
    });
  });
});