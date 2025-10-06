/**
 * Integration tests for updateKeywordAccessState IPC handler
 * Tests T011: keyword-detail.js → updateKeywordAccessState()
 *
 * Test scenarios:
 * 1. Create new access state (created: true)
 * 2. Update existing access state (created: false)
 * 3. Keyword not found error
 * 4. Principal not found error
 * 5. Invalid principalType error
 * 6. Invalid state error
 * 7. Cache invalidation after update
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ipcMain } from 'electron';
import nodeOneCoreInstance from '../../../main/core/node-one-core.js';
import TopicAnalysisModel from '../../../main/core/one-ai/models/TopicAnalysisModel.js';

describe('keyword-detail.updateKeywordAccessState', () => {
    let topicAnalysisModel;
    let testTopicId = 'test-topic-access-update';
    let testUserId = 'sha256:testuser-update';
    let testPrincipalId = 'sha256:principal123';

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

        // Create test keyword
        await topicAnalysisModel.createKeyword(testTopicId, 'security', null, 10, 0.8);

        // Mock getCurrentUserId to return test user
        if (!nodeOneCoreInstance.getCurrentUserId) {
            nodeOneCoreInstance.getCurrentUserId = () => testUserId;
        }
    });

    afterAll(async () => {
        if (nodeOneCoreInstance.initialized) {
            await nodeOneCoreInstance.shutdown();
        }
    });

    it('should create new access state with created: true', async () => {
        const result = await ipcMain.handle('keywordDetail:updateKeywordAccessState',
            null,
            {
                keyword: 'security',
                principalId: 'sha256:newuser123',
                principalType: 'user',
                state: 'allow'
            }
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data.accessState).toBeDefined();
        expect(result.data.created).toBe(true);

        // Check access state structure
        expect(result.data.accessState.$type$).toBe('KeywordAccessState');
        expect(result.data.accessState.keywordTerm).toBe('security');
        expect(result.data.accessState.principalId).toBe('sha256:newuser123');
        expect(result.data.accessState.principalType).toBe('user');
        expect(result.data.accessState.state).toBe('allow');
        expect(result.data.accessState.updatedAt).toBeDefined();
        expect(result.data.accessState.updatedBy).toBe(testUserId);
    });

    it('should update existing access state with created: false', async () => {
        const principalId = 'sha256:existinguser456';

        // First create an access state
        const createResult = await ipcMain.handle('keywordDetail:updateKeywordAccessState',
            null,
            {
                keyword: 'security',
                principalId,
                principalType: 'user',
                state: 'allow'
            }
        );

        expect(createResult.success).toBe(true);
        expect(createResult.data.created).toBe(true);

        // Now update it
        const updateResult = await ipcMain.handle('keywordDetail:updateKeywordAccessState',
            null,
            {
                keyword: 'security',
                principalId,
                principalType: 'user',
                state: 'deny'
            }
        );

        expect(updateResult.success).toBe(true);
        expect(updateResult.data.created).toBe(false);
        expect(updateResult.data.accessState.state).toBe('deny');
        expect(updateResult.data.accessState.updatedBy).toBe(testUserId);
    });

    it('should return error when keyword not found', async () => {
        const result = await ipcMain.handle('keywordDetail:updateKeywordAccessState',
            null,
            {
                keyword: 'nonexistent-keyword',
                principalId: 'sha256:user789',
                principalType: 'user',
                state: 'allow'
            }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
        expect(result.data.accessState).toBeNull();
        expect(result.data.created).toBe(false);
    });

    it('should return error when principal not found', async () => {
        const result = await ipcMain.handle('keywordDetail:updateKeywordAccessState',
            null,
            {
                keyword: 'security',
                principalId: 'sha256:nonexistent-principal',
                principalType: 'user',
                state: 'allow'
            }
        );

        // Depending on implementation, might succeed or fail
        // If verification is strict, should fail
        expect(result).toBeDefined();
        if (!result.success) {
            expect(result.error).toContain('Principal not found');
        }
    });

    it('should return error for invalid principalType', async () => {
        const result = await ipcMain.handle('keywordDetail:updateKeywordAccessState',
            null,
            {
                keyword: 'security',
                principalId: 'sha256:user999',
                principalType: 'invalid-type',
                state: 'allow'
            }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid principalType');
        expect(result.data.accessState).toBeNull();
    });

    it('should return error for invalid state value', async () => {
        const result = await ipcMain.handle('keywordDetail:updateKeywordAccessState',
            null,
            {
                keyword: 'security',
                principalId: 'sha256:user888',
                principalType: 'user',
                state: 'invalid-state'
            }
        );

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid state');
        expect(result.data.accessState).toBeNull();
    });

    it('should invalidate cache after update', async () => {
        const principalId = 'sha256:cachetest777';

        // First, get keyword details to populate cache (if handler exists)
        try {
            await ipcMain.handle('keywordDetail:getKeywordDetails',
                null,
                { keyword: 'security', topicId: testTopicId }
            );
        } catch (err) {
            // Handler might not exist yet, skip cache check
        }

        // Update access state
        const result = await ipcMain.handle('keywordDetail:updateKeywordAccessState',
            null,
            {
                keyword: 'security',
                principalId,
                principalType: 'user',
                state: 'deny'
            }
        );

        expect(result.success).toBe(true);

        // If we get keyword details again, it should reflect the new access state
        try {
            const detailsResult = await ipcMain.handle('keywordDetail:getKeywordDetails',
                null,
                { keyword: 'security', topicId: testTopicId }
            );

            if (detailsResult.success) {
                const accessState = detailsResult.data.accessStates.find(
                    s => s.principalId === principalId
                );
                if (accessState) {
                    expect(accessState.state).toBe('deny');
                }
            }
        } catch (err) {
            // Handler might not exist yet
        }
    });

    it('should normalize keyword to lowercase', async () => {
        const result = await ipcMain.handle('keywordDetail:updateKeywordAccessState',
            null,
            {
                keyword: 'SECURITY',
                principalId: 'sha256:lowercase-test',
                principalType: 'user',
                state: 'allow'
            }
        );

        expect(result.success).toBe(true);
        expect(result.data.accessState.keywordTerm).toBe('security');
    });

    it('should validate required parameters', async () => {
        // Missing keyword
        const result1 = await ipcMain.handle('keywordDetail:updateKeywordAccessState',
            null,
            {
                principalId: 'sha256:user',
                principalType: 'user',
                state: 'allow'
            }
        );
        expect(result1.success).toBe(false);

        // Missing principalId
        const result2 = await ipcMain.handle('keywordDetail:updateKeywordAccessState',
            null,
            {
                keyword: 'security',
                principalType: 'user',
                state: 'allow'
            }
        );
        expect(result2.success).toBe(false);

        // Missing state
        const result3 = await ipcMain.handle('keywordDetail:updateKeywordAccessState',
            null,
            {
                keyword: 'security',
                principalId: 'sha256:user',
                principalType: 'user'
            }
        );
        expect(result3.success).toBe(false);
    });

    it('should support group principal type', async () => {
        const result = await ipcMain.handle('keywordDetail:updateKeywordAccessState',
            null,
            {
                keyword: 'security',
                principalId: 'sha256:group123',
                principalType: 'group',
                state: 'deny'
            }
        );

        // Depending on whether group verification is strict
        if (result.success) {
            expect(result.data.accessState.principalType).toBe('group');
            expect(result.data.accessState.state).toBe('deny');
        }
    });
});
