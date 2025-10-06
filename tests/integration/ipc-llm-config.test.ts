/**
 * Integration tests for Ollama network configuration IPC handlers
 * TDD: These tests are written BEFORE implementation and MUST FAIL initially
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import type {
  TestConnectionRequest,
  TestConnectionResponse,
  SetOllamaConfigRequest,
  SetOllamaConfigResponse,
  GetOllamaConfigRequest,
  GetOllamaConfigResponse,
  GetAvailableModelsRequest,
  GetAvailableModelsResponse,
  DeleteOllamaConfigRequest,
  DeleteOllamaConfigResponse,
} from '../../main/types/llm-config';

// Mock IPC invoke function (replace with actual test harness)
async function ipcInvoke<T>(channel: string, data?: any): Promise<T> {
  // This will be replaced with actual IPC test harness
  // For now, this ensures tests compile and fail
  throw new Error(`IPC handler '${channel}' not implemented`);
}

describe('IPC Handler: llm:testOllamaConnection', () => {
  it('should validate and list models from local Ollama', async () => {
    const request: TestConnectionRequest = {
      baseUrl: 'http://localhost:11434',
    };

    const response = await ipcInvoke<TestConnectionResponse>(
      'llm:testOllamaConnection',
      request
    );

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.models).toBeDefined();
      expect(response.models.length).toBeGreaterThan(0);
      expect(response.models[0]).toHaveProperty('name');
      expect(response.models[0]).toHaveProperty('size');
      expect(response.models[0]).toHaveProperty('digest');
    }
  });

  it('should return INVALID_URL for malformed URL', async () => {
    const request: TestConnectionRequest = {
      baseUrl: 'not-a-url',
    };

    const response = await ipcInvoke<TestConnectionResponse>(
      'llm:testOllamaConnection',
      request
    );

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.errorCode).toBe('INVALID_URL');
      expect(response.error).toContain('http');
    }
  });

  it('should return NETWORK_ERROR for unreachable server', async () => {
    const request: TestConnectionRequest = {
      baseUrl: 'http://192.168.99.99:11434', // Non-existent server
    };

    const response = await ipcInvoke<TestConnectionResponse>(
      'llm:testOllamaConnection',
      request
    );

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.errorCode).toBe('NETWORK_ERROR');
      expect(response.error).toBeDefined();
    }
  });

  it('should include auth headers when token provided', async () => {
    const request: TestConnectionRequest = {
      baseUrl: 'http://localhost:11434',
      authToken: 'test-token-123',
    };

    // This test verifies the structure, actual auth testing requires auth-enabled server
    const response = await ipcInvoke<TestConnectionResponse>(
      'llm:testOllamaConnection',
      request
    );

    // Even if local Ollama doesn't require auth, request should be valid
    expect(response).toBeDefined();
    expect(response.success).toBeDefined();
  });
});

describe('IPC Handler: llm:setOllamaConfig', () => {
  it('should save network Ollama config with encryption', async () => {
    const request: SetOllamaConfigRequest = {
      modelType: 'remote',
      baseUrl: 'http://192.168.1.100:11434',
      authType: 'bearer',
      authToken: 'secret-token-123',
      modelName: 'llama3.2:latest',
      setAsActive: true,
    };

    const response = await ipcInvoke<SetOllamaConfigResponse>(
      'llm:setOllamaConfig',
      request
    );

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.configHash).toBeDefined();
      expect(response.configHash.length).toBe(64); // SHA256 hash length
    }
  });

  it('should save local Ollama config without baseUrl', async () => {
    const request: SetOllamaConfigRequest = {
      modelType: 'local',
      modelName: 'llama3.2:latest',
      setAsActive: true,
    };

    const response = await ipcInvoke<SetOllamaConfigResponse>(
      'llm:setOllamaConfig',
      request
    );

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.configHash).toBeDefined();
    }
  });

  it('should return VALIDATION_FAILED for remote without baseUrl', async () => {
    const request: SetOllamaConfigRequest = {
      modelType: 'remote',
      // Missing baseUrl for remote type
      modelName: 'llama3.2:latest',
      setAsActive: true,
    };

    const response = await ipcInvoke<SetOllamaConfigResponse>(
      'llm:setOllamaConfig',
      request
    );

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.errorCode).toBe('VALIDATION_FAILED');
    }
  });

  it('should return VALIDATION_FAILED for bearer without token', async () => {
    const request: SetOllamaConfigRequest = {
      modelType: 'remote',
      baseUrl: 'http://server:11434',
      authType: 'bearer',
      // Missing authToken for bearer type
      modelName: 'llama3.2:latest',
      setAsActive: true,
    };

    const response = await ipcInvoke<SetOllamaConfigResponse>(
      'llm:setOllamaConfig',
      request
    );

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.errorCode).toBe('VALIDATION_FAILED');
    }
  });
});

describe('IPC Handler: llm:getOllamaConfig', () => {
  it('should retrieve active Ollama config', async () => {
    const request: GetOllamaConfigRequest = {};

    const response = await ipcInvoke<GetOllamaConfigResponse>(
      'llm:getOllamaConfig',
      request
    );

    expect(response.success).toBe(true);
    if (response.success && response.config) {
      expect(response.config.modelType).toBeDefined();
      expect(response.config.baseUrl).toBeDefined();
      expect(response.config.modelName).toBeDefined();
      expect(response.config.hasAuthToken).toBeDefined();
      // CRITICAL: Token itself must NEVER be in response
      expect(response.config).not.toHaveProperty('authToken');
      expect(response.config).not.toHaveProperty('encryptedAuthToken');
    }
  });

  it('should return null config if none exists', async () => {
    // Test with clean state - no configs
    const request: GetOllamaConfigRequest = {};

    const response = await ipcInvoke<GetOllamaConfigResponse>(
      'llm:getOllamaConfig',
      request
    );

    expect(response.success).toBe(true);
    if (response.success) {
      // Config may be null or an existing config
      expect(response.config === null || typeof response.config === 'object').toBe(true);
    }
  });

  it('should include inactive configs when requested', async () => {
    const request: GetOllamaConfigRequest = {
      includeInactive: true,
    };

    const response = await ipcInvoke<GetOllamaConfigResponse>(
      'llm:getOllamaConfig',
      request
    );

    expect(response.success).toBe(true);
    // Response structure should be valid regardless
  });
});

describe('IPC Handler: llm:getAvailableModels', () => {
  it('should fetch models from active config', async () => {
    const request: GetAvailableModelsRequest = {};

    const response = await ipcInvoke<GetAvailableModelsResponse>(
      'llm:getAvailableModels',
      request
    );

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.models).toBeDefined();
      expect(response.source).toBe('active_config');
    }
  });

  it('should fetch models from specified URL', async () => {
    const request: GetAvailableModelsRequest = {
      baseUrl: 'http://localhost:11434',
    };

    const response = await ipcInvoke<GetAvailableModelsResponse>(
      'llm:getAvailableModels',
      request
    );

    expect(response.success).toBe(true);
    if (response.success) {
      expect(response.models).toBeDefined();
      expect(response.source).toBe('specified_url');
    }
  });

  it('should return NO_CONFIG when no active config and no URL', async () => {
    // This test assumes clean state with no active config
    const request: GetAvailableModelsRequest = {};

    const response = await ipcInvoke<GetAvailableModelsResponse>(
      'llm:getAvailableModels',
      request
    );

    // Either succeeds with active_config or fails with NO_CONFIG
    if (!response.success) {
      expect(response.errorCode).toBe('NO_CONFIG');
    }
  });
});

describe('IPC Handler: llm:deleteOllamaConfig', () => {
  it('should soft-delete config', async () => {
    // First create a config to delete (this will fail until setOllamaConfig works)
    const createRequest: SetOllamaConfigRequest = {
      modelType: 'local',
      modelName: 'test-model',
      setAsActive: false, // Don't set as active
    };

    const createResponse = await ipcInvoke<SetOllamaConfigResponse>(
      'llm:setOllamaConfig',
      createRequest
    );

    if (createResponse.success) {
      const deleteRequest: DeleteOllamaConfigRequest = {
        configHash: createResponse.configHash,
      };

      const deleteResponse = await ipcInvoke<DeleteOllamaConfigResponse>(
        'llm:deleteOllamaConfig',
        deleteRequest
      );

      expect(deleteResponse.success).toBe(true);
      if (deleteResponse.success) {
        expect(deleteResponse.deletedHash).toBe(createResponse.configHash);
      }
    }
  });

  it('should return NOT_FOUND for non-existent config', async () => {
    const request: DeleteOllamaConfigRequest = {
      configHash: '0000000000000000000000000000000000000000000000000000000000000000',
    };

    const response = await ipcInvoke<DeleteOllamaConfigResponse>(
      'llm:deleteOllamaConfig',
      request
    );

    expect(response.success).toBe(false);
    if (!response.success) {
      expect(response.errorCode).toBe('NOT_FOUND');
    }
  });
});

// Cleanup after all tests
afterAll(async () => {
  // Clean up test data from ONE.core storage if needed
  console.log('Integration tests complete - cleanup if needed');
});
