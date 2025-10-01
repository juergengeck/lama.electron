/**
 * Contract test for feedForward:matchSupplyDemand IPC handler
 * Tests request validation and response structure
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { app, ipcMain } from 'electron';
import controller from '../../main/ipc/controller.js';

describe('feedForward:matchSupplyDemand Contract Tests', () => {
  beforeAll(() => {
    // Initialize IPC handlers
    controller.initialize();
  });

  afterAll(() => {
    // Clean up
    controller.cleanup?.();
  });

  describe('Request Validation', () => {
    it('should require demandHash parameter', async () => {
      const result = await ipcMain.emit('feedForward:matchSupplyDemand', {
        minTrust: 0.3,
        limit: 10
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('demandHash');
    });

    it('should validate minTrust range 0-1', async () => {
      const result = await ipcMain.emit('feedForward:matchSupplyDemand', {
        demandHash: 'test-demand-hash',
        minTrust: 1.5
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('minTrust');
    });

    it('should validate limit range 1-100', async () => {
      const result = await ipcMain.emit('feedForward:matchSupplyDemand', {
        demandHash: 'test-demand-hash',
        limit: 101
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('limit');
    });

    it('should accept valid request with minimal parameters', async () => {
      const result = await ipcMain.emit('feedForward:matchSupplyDemand', {
        demandHash: 'test-demand-hash'
      });

      // Will fail until implementation is done
      expect(result).toBeDefined();
    });

    it('should accept optional parameters with defaults', async () => {
      const result = await ipcMain.emit('feedForward:matchSupplyDemand', {
        demandHash: 'test-demand-hash',
        minTrust: 0.5,
        limit: 5
      });

      // Will fail until implementation is done
      expect(result).toBeDefined();
    });
  });

  describe('Response Structure', () => {
    it('should return success and matches array on success', async () => {
      const result = await ipcMain.emit('feedForward:matchSupplyDemand', {
        demandHash: 'test-demand-hash'
      });

      // These will fail until implementation
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('matches');
      expect(result.success).toBe(true);
      expect(Array.isArray(result.matches)).toBe(true);
    });

    it('should return match objects with required fields', async () => {
      const result = await ipcMain.emit('feedForward:matchSupplyDemand', {
        demandHash: 'test-demand-hash'
      });

      // These will fail until implementation
      if (result.matches && result.matches.length > 0) {
        const match = result.matches[0];
        expect(match).toHaveProperty('supplyHash');
        expect(match).toHaveProperty('matchScore');
        expect(match).toHaveProperty('trustWeight');
        expect(match).toHaveProperty('matchedKeywords');
        expect(match).toHaveProperty('conversationId');
        expect(typeof match.supplyHash).toBe('string');
        expect(typeof match.matchScore).toBe('number');
        expect(typeof match.trustWeight).toBe('number');
        expect(Array.isArray(match.matchedKeywords)).toBe(true);
        expect(typeof match.conversationId).toBe('string');
      }
    });

    it('should return empty matches for non-existent demand', async () => {
      const result = await ipcMain.emit('feedForward:matchSupplyDemand', {
        demandHash: 'non-existent-demand-hash'
      });

      // These will fail until implementation
      expect(result.success).toBe(true);
      expect(result.matches).toHaveLength(0);
    });

    it('should return error structure on invalid demand hash', async () => {
      const result = await ipcMain.emit('feedForward:matchSupplyDemand', {
        demandHash: 'invalid-hash-format'
      });

      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
      expect(typeof result.error).toBe('string');
    });
  });
});