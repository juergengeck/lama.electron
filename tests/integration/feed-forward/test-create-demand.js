/**
 * Integration test for feedforward:createDemand IPC handler
 * Must fail initially (TDD approach)
 */

const { expect } = require('chai');

describe('Feed-Forward: Create Demand', () => {
  let feedForwardHandlers;
  let mockOneCore;

  before(() => {
    mockOneCore = {
      createObject: async (recipe, data) => ({
        hash: 'mock-demand-hash-' + Date.now(),
        data: data
      }),
      getPersonId: () => 'mock-person-id'
    };

    feedForwardHandlers = require('../../../main/ipc/handlers/feed-forward');
    feedForwardHandlers.initializeFeedForward(mockOneCore);
  });

  describe('feedforward:createDemand', () => {
    it('should create a Demand object with valid parameters', async () => {
      const request = {
        keywords: ['machine', 'learning', 'basics'],
        urgency: 'high',
        context: 'User asking about ML fundamentals',
        criteria: 'Need comprehensive overview'
      };

      const handler = feedForwardHandlers.handlers['feedforward:createDemand'];
      const result = await handler(null, request);

      expect(result).to.have.property('demandHash');
      expect(result).to.have.property('status');
      expect(result).to.have.property('timestamp');
      expect(result.status).to.equal('open');
    });

    it('should validate urgency levels', async () => {
      const validUrgencies = ['high', 'medium', 'low'];

      for (const urgency of validUrgencies) {
        const request = {
          keywords: ['test'],
          urgency: urgency,
          context: 'Test context',
          criteria: 'Test criteria'
        };

        const handler = feedForwardHandlers.handlers['feedforward:createDemand'];
        const result = await handler(null, request);
        expect(result).to.have.property('demandHash');
      }
    });

    it('should reject invalid urgency', async () => {
      const request = {
        keywords: ['test'],
        urgency: 'critical', // Invalid
        context: 'Test context',
        criteria: 'Test criteria'
      };

      const handler = feedForwardHandlers.handlers['feedforward:createDemand'];

      try {
        await handler(null, request);
        expect.fail('Should have thrown error for invalid urgency');
      } catch (error) {
        expect(error.message).to.include('urgency');
      }
    });

    it('should limit context to 500 characters', async () => {
      const request = {
        keywords: ['test'],
        urgency: 'medium',
        context: 'x'.repeat(501),
        criteria: 'Test criteria'
      };

      const handler = feedForwardHandlers.handlers['feedforward:createDemand'];

      try {
        await handler(null, request);
        expect.fail('Should have thrown error for context too long');
      } catch (error) {
        expect(error.message).to.include('context');
      }
    });

    it('should limit criteria to 200 characters', async () => {
      const request = {
        keywords: ['test'],
        urgency: 'medium',
        context: 'Test context',
        criteria: 'x'.repeat(201)
      };

      const handler = feedForwardHandlers.handlers['feedforward:createDemand'];

      try {
        await handler(null, request);
        expect.fail('Should have thrown error for criteria too long');
      } catch (error) {
        expect(error.message).to.include('criteria');
      }
    });
  });
});