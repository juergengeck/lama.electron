/**
 * Integration test for feedforward:createSupply IPC handler
 * Must fail initially (TDD approach)
 */

const { expect } = require('chai');
const path = require('path');

// Mock electron for testing
const { ipcMain } = require('electron');

describe('Feed-Forward: Create Supply', () => {
  let feedForwardHandlers;
  let mockOneCore;

  before(() => {
    // Set up mock ONE.core instance
    mockOneCore = {
      createObject: async (recipe, data) => {
        return {
          hash: 'mock-supply-hash-' + Date.now(),
          data: data
        };
      },
      getPersonId: () => 'mock-person-id'
    };

    // Load the handlers
    feedForwardHandlers = require('../../../main/ipc/handlers/feed-forward');
    feedForwardHandlers.initializeFeedForward(mockOneCore);
  });

  describe('feedforward:createSupply', () => {
    it('should create a Supply object with valid keywords', async () => {
      const request = {
        keywords: ['quantum', 'computing', 'entanglement'],
        contextLevel: 2,
        conversationId: 'conv-123'
      };

      const handler = feedForwardHandlers.handlers['feedforward:createSupply'];
      const result = await handler(null, request);

      expect(result).to.have.property('supplyHash');
      expect(result).to.have.property('keywords');
      expect(result).to.have.property('timestamp');
      expect(result.keywords).to.be.an('object');
      expect(Object.keys(result.keywords)).to.have.lengthOf(3);
    });

    it('should hash keywords to SHA-256', async () => {
      const request = {
        keywords: ['test'],
        contextLevel: 1
      };

      const handler = feedForwardHandlers.handlers['feedforward:createSupply'];
      const result = await handler(null, request);

      // SHA-256 hash should be 64 characters
      const firstHash = Object.keys(result.keywords)[0];
      expect(firstHash).to.match(/^[a-f0-9]{64}$/);
    });

    it('should validate context level between 0 and 3', async () => {
      const request = {
        keywords: ['test'],
        contextLevel: 5 // Invalid
      };

      const handler = feedForwardHandlers.handlers['feedforward:createSupply'];

      try {
        await handler(null, request);
        expect.fail('Should have thrown error for invalid context level');
      } catch (error) {
        expect(error.message).to.include('context level');
      }
    });

    it('should require at least one keyword', async () => {
      const request = {
        keywords: [],
        contextLevel: 1
      };

      const handler = feedForwardHandlers.handlers['feedforward:createSupply'];

      try {
        await handler(null, request);
        expect.fail('Should have thrown error for empty keywords');
      } catch (error) {
        expect(error.message).to.include('keyword');
      }
    });

    it('should limit keywords to maximum 20', async () => {
      const request = {
        keywords: Array(25).fill('keyword'),
        contextLevel: 1
      };

      const handler = feedForwardHandlers.handlers['feedforward:createSupply'];

      try {
        await handler(null, request);
        expect.fail('Should have thrown error for too many keywords');
      } catch (error) {
        expect(error.message).to.include('maximum');
      }
    });
  });
});