/**
 * Integration tests for getKeywordDetails IPC handler
 * Tests T005: keyword-detail.js → getKeywordDetails()
 *
 * Test scenarios:
 * 1. Successful retrieval with valid keyword + topicId
 * 2. Keyword not found error
 * 3. Topic filtering works
 * 4. Enrichment includes topicReferences and enriched subjects
 * 5. Access states loaded
 * 6. Cache hit on second call
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ipcMain } from 'electron';
import nodeOneCoreInstance from '../../../main/core/node-one-core.js';
import TopicAnalysisModel from '../../../main/core/one-ai/models/TopicAnalysisModel.js';
import * as keywordAccessStorage from '../../../main/core/one-ai/storage/keyword-access-storage.ts';

describe('keyword-detail.getKeywordDetails', () => {
    let topicAnalysisModel;
    let testKeyword;
    let testTopicId = 'test-topic-details';
    let testKeyword2;
    let testTopicId2 = 'test-topic-details-2';
    let testUserId = 'sha256:testuser123';

    beforeAll(async () => {
        // Initialize ONE.core test instance
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

        // Create test keywords and subjects in topic 1
        testKeyword = await topicAnalysisModel.createKeyword(
            testTopicId,
            'blockchain',
            null,
            15,
            0.85
        );

        await topicAnalysisModel.createSubject(
            testTopicId,
            ['blockchain', 'ethereum', 'smartcontract'],
            'blockchain+ethereum+smartcontract',
            'Discussion about Ethereum smart contracts',
            0.9
        );

        await topicAnalysisModel.createSubject(
            testTopicId,
            ['blockchain', 'bitcoin'],
            'blockchain+bitcoin',
            'Bitcoin and blockchain fundamentals',
            0.8
        );

        // Create test keyword in topic 2
        testKeyword2 = await topicAnalysisModel.createKeyword(
            testTopicId2,
            'blockchain',
            null,
            8,
            0.75
        );

        await topicAnalysisModel.createSubject(
            testTopicId2,
            ['blockchain', 'defi'],
            'blockchain+defi',
            'Decentralized finance applications',
            0.85
        );

        // Create access states for keyword
        await keywordAccessStorage.createAccessState(
            channelManager,
            'blockchain',
            'sha256:user123',
            'user',
            'allow',
            testUserId
        );

        await keywordAccessStorage.createAccessState(
            channelManager,
            'blockchain',
            'sha256:group456',
            'group',
            'deny',
            testUserId
        );
    });

    afterAll(async () => {
        // Cleanup test data
        if (nodeOneCoreInstance.initialized) {
            await nodeOneCoreInstance.shutdown();
        }
    });

    it('should return keyword with subjects and access states for valid keyword + topicId', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordDetails',
            null,
            { keyword: 'blockchain', topicId: testTopicId }
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.keyword).toBeDefined();
        expect(result.data.keyword.term).toBe('blockchain');
        expect(result.data.keyword.frequency).toBe(15);
        expect(result.data.keyword.score).toBe(0.85);

        // Check subjects array
        expect(result.data.subjects).toBeInstanceOf(Array);
        expect(result.data.subjects.length).toBeGreaterThan(0);

        // All subjects should be from the specified topic
        result.data.subjects.forEach(subject => {
            expect(subject.topicId).toBe(testTopicId);
        });

        // Check access states array
        expect(result.data.accessStates).toBeInstanceOf(Array);
        expect(result.data.accessStates.length).toBeGreaterThanOrEqual(2);
    });

    it('should return error when keyword not found', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordDetails',
            null,
            { keyword: 'nonexistent-keyword', topicId: testTopicId }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
        expect(result.data.keyword).toBeNull();
        expect(result.data.subjects).toEqual([]);
        expect(result.data.accessStates).toEqual([]);
    });

    it('should filter subjects by topic when topicId provided', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordDetails',
            null,
            { keyword: 'blockchain', topicId: testTopicId }
        );

        expect(result.success).toBe(true);
        expect(result.data.subjects).toBeInstanceOf(Array);

        // All subjects should be from testTopicId only
        result.data.subjects.forEach(subject => {
            expect(subject.topicId).toBe(testTopicId);
        });

        // Should not include subjects from testTopicId2
        const hasTopicId2Subjects = result.data.subjects.some(s => s.topicId === testTopicId2);
        expect(hasTopicId2Subjects).toBe(false);
    });

    it('should include topicReferences and enriched subjects', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordDetails',
            null,
            { keyword: 'blockchain', topicId: testTopicId }
        );

        expect(result.success).toBe(true);

        // Check keyword has topicReferences
        expect(result.data.keyword.topicReferences).toBeInstanceOf(Array);
        expect(result.data.keyword.topicReferences.length).toBeGreaterThan(0);

        result.data.keyword.topicReferences.forEach(ref => {
            expect(ref).toHaveProperty('topicId');
            expect(ref).toHaveProperty('topicName');
            expect(ref).toHaveProperty('messageCount');
            expect(ref).toHaveProperty('lastMessageDate');
            expect(ref).toHaveProperty('authors');
        });

        // Check subjects are enriched
        result.data.subjects.forEach(subject => {
            expect(subject).toHaveProperty('relevanceScore');
            expect(subject).toHaveProperty('placesMentioned');
            expect(subject).toHaveProperty('authors');
            expect(subject).toHaveProperty('sortTimestamp');
        });
    });

    it('should load access states for keyword', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordDetails',
            null,
            { keyword: 'blockchain', topicId: testTopicId }
        );

        expect(result.success).toBe(true);
        expect(result.data.accessStates).toBeInstanceOf(Array);
        expect(result.data.accessStates.length).toBeGreaterThanOrEqual(2);

        // Check access state structure
        const allowState = result.data.accessStates.find(s => s.state === 'allow');
        expect(allowState).toBeDefined();
        expect(allowState.keywordTerm).toBe('blockchain');
        expect(allowState.principalType).toBe('user');

        const denyState = result.data.accessStates.find(s => s.state === 'deny');
        expect(denyState).toBeDefined();
        expect(denyState.keywordTerm).toBe('blockchain');
        expect(denyState.principalType).toBe('group');
    });

    it('should return cached data on second call within 5 seconds', async () => {
        // First call
        const result1 = await ipcMain.handle('keywordDetail:getKeywordDetails',
            null,
            { keyword: 'blockchain', topicId: testTopicId }
        );

        expect(result1.success).toBe(true);
        const firstCallData = result1.data;

        // Second call immediately (should hit cache)
        const result2 = await ipcMain.handle('keywordDetail:getKeywordDetails',
            null,
            { keyword: 'blockchain', topicId: testTopicId }
        );

        expect(result2.success).toBe(true);

        // Data should be identical (cached)
        expect(result2.data.keyword.term).toBe(firstCallData.keyword.term);
        expect(result2.data.subjects.length).toBe(firstCallData.subjects.length);
        expect(result2.data.accessStates.length).toBe(firstCallData.accessStates.length);
    });

    it('should normalize keyword to lowercase', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordDetails',
            null,
            { keyword: 'BLOCKCHAIN', topicId: testTopicId }
        );

        expect(result.success).toBe(true);
        expect(result.data.keyword.term).toBe('blockchain'); // lowercase
    });

    it('should return subjects sorted by relevanceScore descending', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordDetails',
            null,
            { keyword: 'blockchain', topicId: testTopicId }
        );

        expect(result.success).toBe(true);
        expect(result.data.subjects.length).toBeGreaterThan(1);

        // Check sorting
        for (let i = 0; i < result.data.subjects.length - 1; i++) {
            const current = result.data.subjects[i].relevanceScore;
            const next = result.data.subjects[i + 1].relevanceScore;
            expect(current).toBeGreaterThanOrEqual(next);
        }
    });
});
