/**
 * Integration tests for getAllKeywords IPC handler
 * Tests T009: keyword-detail.js → getAllKeywords()
 *
 * Test scenarios:
 * 1. Aggregates keywords across all topics
 * 2. topicCount and subjectCount accurate
 * 3. topTopics shows 3 highest frequency topics
 * 4. accessControlCount reflects access states
 * 5. hasRestrictions true when 'deny' state exists
 * 6. Sorting by frequency/alphabetical/lastSeen works
 * 7. Pagination with limit/offset
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ipcMain } from 'electron';
import nodeOneCoreInstance from '../../../main/core/node-one-core.js';
import TopicAnalysisModel from '../../../main/core/one-ai/models/TopicAnalysisModel.js';
import * as keywordAccessStorage from '../../../main/core/one-ai/storage/keyword-access-storage.ts';

describe('keyword-detail.getAllKeywords', () => {
    let topicAnalysisModel;
    let testTopicId1 = 'test-topic-all-1';
    let testTopicId2 = 'test-topic-all-2';
    let testTopicId3 = 'test-topic-all-3';
    let testUserId = 'sha256:testuser789';

    beforeAll(async () => {
        // Initialize ONE.core
        if (!nodeOneCoreInstance.initialized) {
            await nodeOneCoreInstance.initialize({
                email: 'test@example.com',
                secret: 'test-secret'
            });
        }

        const channelManager = nodeOneCoreInstance.channelManager;
        const topicModel = nodeOneCoreInstance.topicModel;
        topicAnalysisModel = new TopicAnalysisModel(channelManager, topicModel);
        await topicAnalysisModel.init();

        // Create keywords in multiple topics (same keyword across topics)
        // Topic 1: blockchain (freq 30), ai (freq 20)
        await topicAnalysisModel.createKeyword(testTopicId1, 'blockchain', null, 30, 0.9);
        await topicAnalysisModel.createKeyword(testTopicId1, 'ai', null, 20, 0.85);

        // Topic 2: blockchain (freq 15), ai (freq 25), quantum (freq 10)
        await topicAnalysisModel.createKeyword(testTopicId2, 'blockchain', null, 15, 0.8);
        await topicAnalysisModel.createKeyword(testTopicId2, 'ai', null, 25, 0.9);
        await topicAnalysisModel.createKeyword(testTopicId2, 'quantum', null, 10, 0.7);

        // Topic 3: ai (freq 18), quantum (freq 12)
        await topicAnalysisModel.createKeyword(testTopicId3, 'ai', null, 18, 0.88);
        await topicAnalysisModel.createKeyword(testTopicId3, 'quantum', null, 12, 0.75);

        // Create subjects for topicCount/subjectCount testing
        await topicAnalysisModel.createSubject(testTopicId1, ['blockchain'], 'blockchain', 'Subject T1-1', 0.9);
        await topicAnalysisModel.createSubject(testTopicId1, ['blockchain', 'ai'], 'blockchain+ai', 'Subject T1-2', 0.85);
        await topicAnalysisModel.createSubject(testTopicId1, ['ai'], 'ai', 'Subject T1-3', 0.8);

        await topicAnalysisModel.createSubject(testTopicId2, ['blockchain'], 'blockchain', 'Subject T2-1', 0.88);
        await topicAnalysisModel.createSubject(testTopicId2, ['ai', 'quantum'], 'ai+quantum', 'Subject T2-2', 0.82);

        await topicAnalysisModel.createSubject(testTopicId3, ['ai'], 'ai', 'Subject T3-1', 0.9);
        await topicAnalysisModel.createSubject(testTopicId3, ['quantum'], 'quantum', 'Subject T3-2', 0.75);

        // Create access states for keywords
        // blockchain: 2 allow states (no deny)
        await keywordAccessStorage.createAccessState(channelManager, 'blockchain', 'sha256:user1', 'user', 'allow', testUserId);
        await keywordAccessStorage.createAccessState(channelManager, 'blockchain', 'sha256:user2', 'user', 'allow', testUserId);

        // ai: 1 allow, 1 deny (has restrictions)
        await keywordAccessStorage.createAccessState(channelManager, 'ai', 'sha256:user3', 'user', 'allow', testUserId);
        await keywordAccessStorage.createAccessState(channelManager, 'ai', 'sha256:group1', 'group', 'deny', testUserId);

        // quantum: no access states
    });

    afterAll(async () => {
        if (nodeOneCoreInstance.initialized) {
            await nodeOneCoreInstance.shutdown();
        }
    });

    it('should aggregate keywords across all topics', async () => {
        const result = await ipcMain.handle('keywordDetail:getAllKeywords',
            null,
            {}
        );

        expect(result.success).toBe(true);
        expect(result.data.keywords).toBeInstanceOf(Array);

        // Should have 3 unique keywords: blockchain, ai, quantum
        const uniqueTerms = new Set(result.data.keywords.map(k => k.term));
        expect(uniqueTerms.has('blockchain')).toBe(true);
        expect(uniqueTerms.has('ai')).toBe(true);
        expect(uniqueTerms.has('quantum')).toBe(true);

        // blockchain should have aggregated frequency: 30 + 15 = 45
        const blockchain = result.data.keywords.find(k => k.term === 'blockchain');
        expect(blockchain.frequency).toBe(45);

        // ai should have aggregated frequency: 20 + 25 + 18 = 63
        const ai = result.data.keywords.find(k => k.term === 'ai');
        expect(ai.frequency).toBe(63);
    });

    it('should calculate topicCount and subjectCount accurately', async () => {
        const result = await ipcMain.handle('keywordDetail:getAllKeywords',
            null,
            {}
        );

        expect(result.success).toBe(true);

        // blockchain appears in 2 topics
        const blockchain = result.data.keywords.find(k => k.term === 'blockchain');
        expect(blockchain.topicCount).toBe(2);
        expect(blockchain.subjectCount).toBeGreaterThanOrEqual(2);

        // ai appears in 3 topics
        const ai = result.data.keywords.find(k => k.term === 'ai');
        expect(ai.topicCount).toBe(3);
        expect(ai.subjectCount).toBeGreaterThanOrEqual(3);

        // quantum appears in 2 topics
        const quantum = result.data.keywords.find(k => k.term === 'quantum');
        expect(quantum.topicCount).toBe(2);
        expect(quantum.subjectCount).toBeGreaterThanOrEqual(2);
    });

    it('should show topTopics limited to 3 and sorted by frequency', async () => {
        const result = await ipcMain.handle('keywordDetail:getAllKeywords',
            null,
            {}
        );

        expect(result.success).toBe(true);

        // blockchain has 2 topics, so topTopics should have 2 entries
        const blockchain = result.data.keywords.find(k => k.term === 'blockchain');
        expect(blockchain.topTopics).toBeInstanceOf(Array);
        expect(blockchain.topTopics.length).toBeLessThanOrEqual(3);
        expect(blockchain.topTopics.length).toBe(2); // Only in 2 topics

        // First topic should be the one with higher frequency (testTopicId1 with freq 30)
        expect(blockchain.topTopics[0].frequency).toBeGreaterThanOrEqual(blockchain.topTopics[1].frequency);

        // ai has 3 topics, so topTopics should have 3 entries
        const ai = result.data.keywords.find(k => k.term === 'ai');
        expect(ai.topTopics.length).toBe(3);

        // Check sorting: descending frequency
        for (let i = 0; i < ai.topTopics.length - 1; i++) {
            expect(ai.topTopics[i].frequency).toBeGreaterThanOrEqual(ai.topTopics[i + 1].frequency);
        }
    });

    it('should calculate accessControlCount correctly', async () => {
        const result = await ipcMain.handle('keywordDetail:getAllKeywords',
            null,
            {}
        );

        expect(result.success).toBe(true);

        // blockchain has 2 access states
        const blockchain = result.data.keywords.find(k => k.term === 'blockchain');
        expect(blockchain.accessControlCount).toBe(2);

        // ai has 2 access states
        const ai = result.data.keywords.find(k => k.term === 'ai');
        expect(ai.accessControlCount).toBe(2);

        // quantum has 0 access states
        const quantum = result.data.keywords.find(k => k.term === 'quantum');
        expect(quantum.accessControlCount).toBe(0);
    });

    it('should set hasRestrictions true when deny state exists', async () => {
        const result = await ipcMain.handle('keywordDetail:getAllKeywords',
            null,
            {}
        );

        expect(result.success).toBe(true);

        // blockchain has no deny states
        const blockchain = result.data.keywords.find(k => k.term === 'blockchain');
        expect(blockchain.hasRestrictions).toBe(false);

        // ai has a deny state
        const ai = result.data.keywords.find(k => k.term === 'ai');
        expect(ai.hasRestrictions).toBe(true);

        // quantum has no access states
        const quantum = result.data.keywords.find(k => k.term === 'quantum');
        expect(quantum.hasRestrictions).toBe(false);
    });

    it('should sort by frequency descending', async () => {
        const result = await ipcMain.handle('keywordDetail:getAllKeywords',
            null,
            { sortBy: 'frequency' }
        );

        expect(result.success).toBe(true);
        expect(result.data.keywords.length).toBeGreaterThan(1);

        // Check sorting
        for (let i = 0; i < result.data.keywords.length - 1; i++) {
            const current = result.data.keywords[i].frequency;
            const next = result.data.keywords[i + 1].frequency;
            expect(current).toBeGreaterThanOrEqual(next);
        }

        // ai should be first (highest frequency: 63)
        expect(result.data.keywords[0].term).toBe('ai');
    });

    it('should sort alphabetically when sortBy is alphabetical', async () => {
        const result = await ipcMain.handle('keywordDetail:getAllKeywords',
            null,
            { sortBy: 'alphabetical' }
        );

        expect(result.success).toBe(true);

        // Check alphabetical sorting
        for (let i = 0; i < result.data.keywords.length - 1; i++) {
            const current = result.data.keywords[i].term;
            const next = result.data.keywords[i + 1].term;
            expect(current.localeCompare(next)).toBeLessThanOrEqual(0);
        }

        // 'ai' should be first alphabetically
        expect(result.data.keywords[0].term).toBe('ai');
    });

    it('should paginate with limit and offset', async () => {
        const result1 = await ipcMain.handle('keywordDetail:getAllKeywords',
            null,
            { limit: 2, offset: 0 }
        );

        expect(result1.success).toBe(true);
        expect(result1.data.keywords.length).toBe(2);
        expect(result1.data.totalCount).toBeGreaterThanOrEqual(3);
        expect(result1.data.hasMore).toBe(true);

        const result2 = await ipcMain.handle('keywordDetail:getAllKeywords',
            null,
            { limit: 2, offset: 2 }
        );

        expect(result2.success).toBe(true);
        expect(result2.data.hasMore).toBe(false);

        // Keywords should be different
        expect(result1.data.keywords[0].term).not.toBe(result2.data.keywords[0].term);
    });

    it('should validate sortBy parameter', async () => {
        const result = await ipcMain.handle('keywordDetail:getAllKeywords',
            null,
            { sortBy: 'invalid-sort' }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid sortBy');
    });

    it('should validate limit parameter', async () => {
        const result = await ipcMain.handle('keywordDetail:getAllKeywords',
            null,
            { limit: -1 }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid limit');
    });

    it('should validate offset parameter', async () => {
        const result = await ipcMain.handle('keywordDetail:getAllKeywords',
            null,
            { offset: -1 }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid offset');
    });
});
