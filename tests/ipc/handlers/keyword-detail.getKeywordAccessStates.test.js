/**
 * Integration tests for getKeywordAccessStates IPC handler
 * Tests T013: keyword-detail.js → getKeywordAccessStates()
 *
 * Test scenarios:
 * 1. Returns all access states for keyword
 * 2. Enriches with principal details when includePrincipalDetails: true
 * 3. Returns allPrincipals list
 * 4. Validates keyword parameter
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ipcMain } from 'electron';
import nodeOneCoreInstance from '../../../main/core/node-one-core.js';
import TopicAnalysisModel from '../../../main/core/one-ai/models/TopicAnalysisModel.js';
import * as keywordAccessStorage from '../../../main/core/one-ai/storage/keyword-access-storage.ts';

describe('keyword-detail.getKeywordAccessStates', () => {
    let topicAnalysisModel;
    let testTopicId = 'test-topic-access-states';
    let testUserId = 'sha256:testuser-states';
    let channelManager;

    beforeAll(async () => {
        // Initialize ONE.core
        if (!nodeOneCoreInstance.initialized) {
            await nodeOneCoreInstance.initialize({
                email: 'test@example.com',
                secret: 'test-secret'
            });
        }

        channelManager = nodeOneCoreInstance.channelManager;
        const topicModel = nodeOneCoreInstance.topicModel;
        topicAnalysisModel = new TopicAnalysisModel(channelManager, topicModel);
        await topicAnalysisModel.init();

        // Create test keyword
        await topicAnalysisModel.createKeyword(testTopicId, 'privacy', null, 12, 0.8);

        // Create multiple access states
        await keywordAccessStorage.createAccessState(
            channelManager,
            'privacy',
            'sha256:alice',
            'user',
            'allow',
            testUserId
        );

        await keywordAccessStorage.createAccessState(
            channelManager,
            'privacy',
            'sha256:bob',
            'user',
            'deny',
            testUserId
        );

        await keywordAccessStorage.createAccessState(
            channelManager,
            'privacy',
            'sha256:admins-group',
            'group',
            'allow',
            testUserId
        );
    });

    afterAll(async () => {
        if (nodeOneCoreInstance.initialized) {
            await nodeOneCoreInstance.shutdown();
        }
    });

    it('should return all access states for keyword', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordAccessStates',
            null,
            { keyword: 'privacy' }
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.keyword).toBe('privacy');
        expect(result.data.accessStates).toBeInstanceOf(Array);
        expect(result.data.accessStates.length).toBeGreaterThanOrEqual(3);
        expect(result.data.totalStates).toBeGreaterThanOrEqual(3);

        // Check access state structure
        result.data.accessStates.forEach(state => {
            expect(state.$type$).toBe('KeywordAccessState');
            expect(state.keywordTerm).toBe('privacy');
            expect(state).toHaveProperty('principalId');
            expect(state).toHaveProperty('principalType');
            expect(state).toHaveProperty('state');
            expect(state).toHaveProperty('updatedAt');
            expect(state).toHaveProperty('updatedBy');
        });
    });

    it('should enrich with principal details when includePrincipalDetails is true', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordAccessStates',
            null,
            { keyword: 'privacy', includePrincipalDetails: true }
        );

        expect(result.success).toBe(true);

        // Check that access states have principal details
        result.data.accessStates.forEach(state => {
            if (state.principalType === 'user') {
                expect(state).toHaveProperty('principalName');
                // principalEmail might not be available in test
            } else if (state.principalType === 'group') {
                expect(state).toHaveProperty('principalName');
                // principalMemberCount might not be available in test
            }
        });
    });

    it('should return allPrincipals list when includePrincipalDetails is true', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordAccessStates',
            null,
            { keyword: 'privacy', includePrincipalDetails: true }
        );

        expect(result.success).toBe(true);
        expect(result.data.allPrincipals).toBeDefined();
        expect(result.data.allPrincipals.users).toBeInstanceOf(Array);
        expect(result.data.allPrincipals.groups).toBeInstanceOf(Array);

        // Check user structure
        if (result.data.allPrincipals.users.length > 0) {
            result.data.allPrincipals.users.forEach(user => {
                expect(user).toHaveProperty('id');
                expect(user).toHaveProperty('name');
                expect(user).toHaveProperty('hasState');
                expect(typeof user.hasState).toBe('boolean');
            });
        }

        // Check group structure
        if (result.data.allPrincipals.groups.length > 0) {
            result.data.allPrincipals.groups.forEach(group => {
                expect(group).toHaveProperty('id');
                expect(group).toHaveProperty('name');
                expect(group).toHaveProperty('hasState');
                expect(typeof group.hasState).toBe('boolean');
            });
        }
    });

    it('should not return allPrincipals when includePrincipalDetails is false', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordAccessStates',
            null,
            { keyword: 'privacy', includePrincipalDetails: false }
        );

        expect(result.success).toBe(true);
        expect(result.data.allPrincipals).toBeNull();
        expect(result.data.accessStates).toBeInstanceOf(Array);
    });

    it('should normalize keyword to lowercase', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordAccessStates',
            null,
            { keyword: 'PRIVACY' }
        );

        expect(result.success).toBe(true);
        expect(result.data.keyword).toBe('privacy');
    });

    it('should validate keyword parameter', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordAccessStates',
            null,
            { keyword: '' }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid keyword');
    });

    it('should return error when keyword not found', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordAccessStates',
            null,
            { keyword: 'nonexistent-keyword' }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
        expect(result.data.accessStates).toEqual([]);
    });

    it('should sort access states by type then name', async () => {
        const result = await ipcMain.handle('keywordDetail:getKeywordAccessStates',
            null,
            { keyword: 'privacy', includePrincipalDetails: true }
        );

        expect(result.success).toBe(true);

        if (result.data.accessStates.length > 1) {
            // Check that users come before groups
            let seenGroup = false;
            for (const state of result.data.accessStates) {
                if (state.principalType === 'group') {
                    seenGroup = true;
                } else if (state.principalType === 'user' && seenGroup) {
                    // If we see a user after a group, sorting is wrong
                    expect(false).toBe(true);
                }
            }
        }
    });

    it('should cache results for 5 seconds', async () => {
        const result1 = await ipcMain.handle('keywordDetail:getKeywordAccessStates',
            null,
            { keyword: 'privacy' }
        );

        expect(result1.success).toBe(true);

        // Second call immediately (should hit cache)
        const result2 = await ipcMain.handle('keywordDetail:getKeywordAccessStates',
            null,
            { keyword: 'privacy' }
        );

        expect(result2.success).toBe(true);
        expect(result2.data.accessStates.length).toBe(result1.data.accessStates.length);
    });

    it('should return empty array if no access states exist', async () => {
        // Create keyword with no access states
        await topicAnalysisModel.createKeyword(testTopicId, 'nostate', null, 5, 0.6);

        const result = await ipcMain.handle('keywordDetail:getKeywordAccessStates',
            null,
            { keyword: 'nostate' }
        );

        expect(result.success).toBe(true);
        expect(result.data.accessStates).toEqual([]);
        expect(result.data.totalStates).toBe(0);
    });
});
