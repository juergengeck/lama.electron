/**
 * Type definitions for Ollama network configuration
 * Used by IPC handlers and services for network-based Ollama instances
 */

export type ModelType = 'local' | 'remote';
export type AuthType = 'none' | 'bearer';

export type ErrorCode =
  | 'INVALID_URL'
  | 'NETWORK_ERROR'
  | 'AUTH_FAILED'
  | 'NO_MODELS'
  | 'VALIDATION_FAILED'
  | 'STORAGE_ERROR'
  | 'ENCRYPTION_ERROR'
  | 'NOT_FOUND'
  | 'NO_CONFIG';

// Ollama model info from server
export interface OllamaModel {
  name: string;
  size: number;
  modified: string;
  digest: string;
}

// Request/Response for llm:testOllamaConnection
export interface TestConnectionRequest {
  baseUrl: string;
  authToken?: string;
}

export interface TestConnectionSuccess {
  success: true;
  models: OllamaModel[];
  serverInfo: {
    version?: string;
  };
}

export interface TestConnectionError {
  success: false;
  error: string;
  errorCode: ErrorCode;
}

export type TestConnectionResponse = TestConnectionSuccess | TestConnectionError;

// Request/Response for llm:setOllamaConfig
export interface SetOllamaConfigRequest {
  modelType: ModelType;
  baseUrl?: string;
  authType?: AuthType;
  authToken?: string;
  modelName: string;
  setAsActive: boolean;
}

export interface SetOllamaConfigSuccess {
  success: true;
  configHash: string;
  personId?: string;
}

export interface SetOllamaConfigError {
  success: false;
  error: string;
  errorCode: ErrorCode;
}

export type SetOllamaConfigResponse = SetOllamaConfigSuccess | SetOllamaConfigError;

// Request/Response for llm:getOllamaConfig
export interface GetOllamaConfigRequest {
  includeInactive?: boolean;
}

export interface OllamaConfigData {
  modelType: ModelType;
  baseUrl: string;
  authType: AuthType;
  hasAuthToken: boolean;
  modelName: string;
  isActive: boolean;
  created: number;
  lastUsed: string;
}

export interface GetOllamaConfigSuccess {
  success: true;
  config: OllamaConfigData | null;
}

export interface GetOllamaConfigError {
  success: false;
  error: string;
  errorCode: ErrorCode;
}

export type GetOllamaConfigResponse = GetOllamaConfigSuccess | GetOllamaConfigError;

// Request/Response for llm:getAvailableModels
export interface GetAvailableModelsRequest {
  baseUrl?: string;
  authToken?: string;
}

export interface GetAvailableModelsSuccess {
  success: true;
  models: OllamaModel[];
  source: 'active_config' | 'specified_url';
}

export interface GetAvailableModelsError {
  success: false;
  error: string;
  errorCode: ErrorCode;
}

export type GetAvailableModelsResponse = GetAvailableModelsSuccess | GetAvailableModelsError;

// Request/Response for llm:deleteOllamaConfig
export interface DeleteOllamaConfigRequest {
  configHash: string;
}

export interface DeleteOllamaConfigSuccess {
  success: true;
  deletedHash: string;
}

export interface DeleteOllamaConfigError {
  success: false;
  error: string;
  errorCode: ErrorCode;
}

export type DeleteOllamaConfigResponse = DeleteOllamaConfigSuccess | DeleteOllamaConfigError;

// Validation result for internal use
export interface ValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: ErrorCode;
}

// Internal config structure (stored in ONE.core)
export interface OllamaConfigInternal {
  modelType: ModelType;
  baseUrl?: string;
  authType?: AuthType;
  encryptedAuthToken?: string;
  modelName: string;
  active: boolean;
  deleted: boolean;
  created: number;
  modified: number;
  createdAt: string;
  lastUsed: string;
  personId?: string;
}
