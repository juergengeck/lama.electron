/**
 * Contract test for feedForward:createDemand IPC handler
 * Tests request validation and response structure
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { app, ipcMain } from 'electron';
import controller from '../../main/ipc/controller.js';

describe('feedForward:createDemand Contract Tests', () => {
  beforeAll(() => {
    // Initialize IPC handlers
    controller.initialize();
  });

  afterAll(() => {
    // Clean up
    controller.cleanup?.();
  });

  describe('Request Validation', () => {
    it('should require keywords parameter', async () => {
      const result = await ipcMain.emit('feedForward:createDemand', {
        urgency: 5,
        context: 'Need ML training data'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('keywords');
    });

    it('should require urgency parameter', async () => {
      const result = await ipcMain.emit('feedForward:createDemand', {
        keywords: ['machine', 'learning'],
        context: 'Need ML training data'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('urgency');
    });

    it('should require context parameter', async () => {
      const result = await ipcMain.emit('feedForward:createDemand', {
        keywords: ['machine', 'learning'],
        urgency: 5
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('context');
    });

    it('should validate keywords is array with 1-10 items', async () => {
      const result = await ipcMain.emit('feedForward:createDemand', {
        keywords: [],
        urgency: 5,
        context: 'Need ML training data'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('keywords');
    });

    it('should reject too many keywords', async () => {
      const keywords = Array.from({ length: 11 }, (_, i) => `keyword${i}`);
      const result = await ipcMain.emit('feedForward:createDemand', {
        keywords,
        urgency: 5,
        context: 'Need ML training data'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('keywords');
    });

    it('should validate urgency range 1-10', async () => {
      const result = await ipcMain.emit('feedForward:createDemand', {
        keywords: ['machine', 'learning'],
        urgency: 11,
        context: 'Need ML training data'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('urgency');
    });

    it('should validate context length <= 500 characters', async () => {
      const longContext = 'x'.repeat(501);
      const result = await ipcMain.emit('feedForward:createDemand', {
        keywords: ['machine', 'learning'],
        urgency: 5,
        context: longContext
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('context');
    });

    it('should accept valid request with minimal parameters', async () => {
      const result = await ipcMain.emit('feedForward:createDemand', {
        keywords: ['machine', 'learning'],
        urgency: 5,
        context: 'Need ML training data'
      });

      // Will fail until implementation is done
      expect(result).toBeDefined();
    });

    it('should accept optional parameters', async () => {
      const result = await ipcMain.emit('feedForward:createDemand', {
        keywords: ['machine', 'learning'],
        urgency: 5,
        context: 'Need ML training data',
        criteria: { minTrust: 0.7 },
        expires: Date.now() + 86400000,
        maxResults: 10
      });

      // Will fail until implementation is done
      expect(result).toBeDefined();
    });
  });

  describe('Response Structure', () => {
    it('should return success and demandHash on success', async () => {
      const result = await ipcMain.emit('feedForward:createDemand', {
        keywords: ['machine', 'learning'],
        urgency: 5,
        context: 'Need ML training data'
      });

      // These will fail until implementation
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('demandHash');
      expect(result.success).toBe(true);
      expect(typeof result.demandHash).toBe('string');
    });

    it('should return error structure on failure', async () => {
      const result = await ipcMain.emit('feedForward:createDemand', {
        keywords: ['machine', 'learning'],
        urgency: 5,
        context: 'Need ML training data',
        expires: Date.now() - 1000 // Past expiration
      });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });
  });
});