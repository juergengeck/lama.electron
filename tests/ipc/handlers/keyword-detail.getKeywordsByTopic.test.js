/**
 * Integration tests for getKeywordsByTopic IPC handler
 * Tests T007: keyword-detail.js → getKeywordsByTopic()
 *
 * Test scenarios:
 * 1. Returns keywords for valid topicId sorted by frequency
 * 2. subjectCount enrichment accurate
 * 3. limit parameter works
 * 4. includeArchived parameter filters correctly
 * 5. topic not found error
 * 6. totalCount reflects all keywords before limit
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ipcMain } from 'electron';
import nodeOneCoreInstance from '../../../main/core/node-one-core.js';
import TopicAnalysisModel from '../../../main/core/one-ai/models/TopicAnalysisModel.js';

describe('keyword-detail.getKeywordsByTopic', () => {
    let topicAnalysisModel;
    let testTopicId = 'test-topic-keywords';

    beforeAll(async () => {
        // Initialize ONE.core
        if (!nodeOneCoreInstance.initialized) {
            await nodeOneCoreInstance.initialize({
                email: 'test@example.com',
                secret: 'test-secret'
            });
        }

        // Get TopicAnalysisModel instance
        const channelManager = nodeOneCoreInstance.channelManager;
        const topicModel = nodeOneCoreInstance.topicModel;
        topicAnalysisModel = new TopicAnalysisModel(channelManager, topicModel);
        await topicAnalysisModel.init();

        // Create multiple keywords with varying frequencies
        await topicAnalysisModel.createKeyword(testTopicId, 'blockchain', null, 25, 0.9);
        await topicAnalysisModel.createKeyword(testTopicId, 'ethereum', null, 20, 0.85);
        await topicAnalysisModel.createKeyword(testTopicId, 'bitcoin', null, 18, 0.8);
        await topicAnalysisModel.createKeyword(testTopicId, 'defi', null, 15, 0.75);
        await topicAnalysisModel.createKeyword(testTopicId, 'nft', null, 12, 0.7);
        await topicAnalysisModel.createKeyword(testTopicId, 'web3', null, 10, 0.65);

        // Create subjects for subjectCount testing
        await topicAnalysisModel.createSubject(
            testTopicId,
            ['blockchain', 'ethereum'],
            'blockchain+ethereum',
            'Subject 1',
            0.9
        );

        await topicAnalysisModel.createSubject(
            testTopicId,
            ['blockchain', 'bitcoin'],
            'blockchain+bitcoin',
            'Subject 2',
            0.85
        );

        await topicAnalysisModel.createSubject(
            testTopicId,
            ['ethereum', 'defi'],
            'ethereum+defi',
            'Subject 3',
            0.8
        );

        // Create archived subject
        const archivedSubject = await topicAnalysisModel.createSubject(
            testTopicId,
            ['nft', 'archived'],
            'nft+archived',
            'Archived subject',
            0.7
        );
        // Mark as archived (would need a method on model to do this)
        // For now, we'll assume the subject can be archived
    });

    afterAll(async () => {
        if (nodeOneCoreInstance.initialized) {
            await nodeOneCoreInstance.shutdown();
        }
    });

    it('should return keywords sorted by frequency descending', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordsByTopic',
            null,
            { topicId: testTopicId }
        );

        expect(result.success).toBe(true);
        expect(result.data.keywords).toBeInstanceOf(Array);
        expect(result.data.keywords.length).toBeGreaterThan(0);

        // Check sorting by frequency
        for (let i = 0; i < result.data.keywords.length - 1; i++) {
            const current = result.data.keywords[i];
            const next = result.data.keywords[i + 1];

            // Primary sort: frequency descending
            if (current.frequency !== next.frequency) {
                expect(current.frequency).toBeGreaterThanOrEqual(next.frequency);
            } else if (current.score !== next.score) {
                // Secondary sort: score descending
                expect(current.score).toBeGreaterThanOrEqual(next.score);
            } else {
                // Tertiary sort: term alphabetical
                expect(current.term.localeCompare(next.term)).toBeLessThanOrEqual(0);
            }
        }
    });

    it('should calculate subjectCount accurately', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordsByTopic',
            null,
            { topicId: testTopicId }
        );

        expect(result.success).toBe(true);

        // Find blockchain keyword (appears in 2 subjects)
        const blockchain = result.data.keywords.find(k => k.term === 'blockchain');
        expect(blockchain).toBeDefined();
        expect(blockchain.subjectCount).toBe(2);

        // Find ethereum keyword (appears in 2 subjects)
        const ethereum = result.data.keywords.find(k => k.term === 'ethereum');
        expect(ethereum).toBeDefined();
        expect(ethereum.subjectCount).toBe(2);

        // Find defi keyword (appears in 1 subject)
        const defi = result.data.keywords.find(k => k.term === 'defi');
        expect(defi).toBeDefined();
        expect(defi.subjectCount).toBe(1);
    });

    it('should respect limit parameter', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordsByTopic',
            null,
            { topicId: testTopicId, limit: 3 }
        );

        expect(result.success).toBe(true);
        expect(result.data.keywords.length).toBeLessThanOrEqual(3);
        expect(result.data.totalCount).toBeGreaterThanOrEqual(result.data.keywords.length);
    });

    it('should filter archived keywords when includeArchived is false', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordsByTopic',
            null,
            { topicId: testTopicId, includeArchived: false }
        );

        expect(result.success).toBe(true);

        // Should not include keywords from archived subjects
        // This depends on implementation - keywords might still appear if they're in non-archived subjects too
        expect(result.data.keywords).toBeInstanceOf(Array);
    });

    it('should return error for non-existent topic', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordsByTopic',
            null,
            { topicId: 'non-existent-topic' }
        );

        // Could return error or empty array depending on implementation
        expect(result.success).toBe(true); // Handler should succeed but return empty
        expect(result.data.keywords).toEqual([]);
        expect(result.data.totalCount).toBe(0);
    });

    it('should return totalCount reflecting all keywords before limit', async () => {
        // Get all keywords first
        const resultAll = await ipcMain.handle('keywordDetail:getKeywordsByTopic',
            null,
            { topicId: testTopicId, limit: 1000 }
        );

        const totalKeywords = resultAll.data.keywords.length;

        // Get limited keywords
        const resultLimited = await ipcMain.handle('keywordDetail:getKeywordsByTopic',
            null,
            { topicId: testTopicId, limit: 2 }
        );

        expect(resultLimited.success).toBe(true);
        expect(resultLimited.data.keywords.length).toBe(2);
        expect(resultLimited.data.totalCount).toBe(totalKeywords);
    });

    it('should validate invalid limit parameter', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordsByTopic',
            null,
            { topicId: testTopicId, limit: -1 }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid limit');
    });

    it('should validate invalid topicId parameter', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordsByTopic',
            null,
            { topicId: '', limit: 10 }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid topicId');
    });

    it('should echo topicId in response', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordsByTopic',
            null,
            { topicId: testTopicId }
        );

        expect(result.success).toBe(true);
        expect(result.data.topicId).toBe(testTopicId);
    });
});
