/**
 * Contract test for feedForward:enableSharing IPC handler
 * Tests request validation and response structure
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { app, ipcMain } from 'electron';
import controller from '../../main/ipc/controller.js';

describe('feedForward:enableSharing Contract Tests', () => {
  beforeAll(() => {
    // Initialize IPC handlers
    controller.initialize();
  });

  afterAll(() => {
    // Clean up
    controller.cleanup?.();
  });

  describe('Request Validation', () => {
    it('should require conversationId parameter', async () => {
      const result = await ipcMain.emit('feedForward:enableSharing', {
        enabled: true
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('conversationId');
    });

    it('should require enabled parameter', async () => {
      const result = await ipcMain.emit('feedForward:enableSharing', {
        conversationId: 'test-conversation-123'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('enabled');
    });

    it('should validate enabled is boolean', async () => {
      const result = await ipcMain.emit('feedForward:enableSharing', {
        conversationId: 'test-conversation-123',
        enabled: 'true'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('enabled');
    });

    it('should accept valid request with minimal parameters', async () => {
      const result = await ipcMain.emit('feedForward:enableSharing', {
        conversationId: 'test-conversation-123',
        enabled: true
      });

      // Will fail until implementation is done
      expect(result).toBeDefined();
    });

    it('should accept optional retroactive parameter', async () => {
      const result = await ipcMain.emit('feedForward:enableSharing', {
        conversationId: 'test-conversation-123',
        enabled: true,
        retroactive: true
      });

      // Will fail until implementation is done
      expect(result).toBeDefined();
    });

    it('should validate retroactive is boolean if provided', async () => {
      const result = await ipcMain.emit('feedForward:enableSharing', {
        conversationId: 'test-conversation-123',
        enabled: true,
        retroactive: 'yes'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('retroactive');
    });
  });

  describe('Response Structure', () => {
    it('should return success and previousState on success', async () => {
      const result = await ipcMain.emit('feedForward:enableSharing', {
        conversationId: 'test-conversation-123',
        enabled: true
      });

      // These will fail until implementation
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('previousState');
      expect(result.success).toBe(true);
      expect(typeof result.previousState).toBe('boolean');
    });

    it('should handle enabling sharing from disabled state', async () => {
      const result = await ipcMain.emit('feedForward:enableSharing', {
        conversationId: 'test-conversation-123',
        enabled: true
      });

      // These will fail until implementation
      expect(result.success).toBe(true);
      expect(result.previousState).toBe(false);
    });

    it('should handle disabling sharing from enabled state', async () => {
      // First enable sharing
      await ipcMain.emit('feedForward:enableSharing', {
        conversationId: 'test-conversation-123',
        enabled: true
      });

      // Then disable it
      const result = await ipcMain.emit('feedForward:enableSharing', {
        conversationId: 'test-conversation-123',
        enabled: false
      });

      // These will fail until implementation
      expect(result.success).toBe(true);
      expect(result.previousState).toBe(true);
    });

    it('should return error structure on failure', async () => {
      const result = await ipcMain.emit('feedForward:enableSharing', {
        conversationId: 'non-existent-conversation',
        enabled: true
      });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });
  });
});