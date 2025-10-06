/**
 * Ollama configuration manager
 * Handles token encryption/decryption and config management
 */

import { safeStorage } from 'electron';

/**
 * Encrypt an auth token using Electron's safeStorage
 * Uses OS-level encryption (Keychain on macOS, DPAPI on Windows, libsecret on Linux)
 */
export function encryptToken(plainToken: string): string {
  if (!plainToken) {
    throw new Error('Cannot encrypt empty token');
  }

  try {
    const encrypted = safeStorage.encryptString(plainToken);
    return encrypted.toString('base64');
  } catch (error: any) {
    console.error('[OllamaConfig] Token encryption failed:', error);
    throw new Error(`Token encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt an auth token using Electron's safeStorage
 */
export function decryptToken(encryptedBase64: string): string {
  if (!encryptedBase64) {
    throw new Error('Cannot decrypt empty token');
  }

  try {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    const decrypted = safeStorage.decryptString(buffer);
    return decrypted;
  } catch (error: any) {
    console.error('[OllamaConfig] Token decryption failed:', error);
    throw new Error(`Token decryption failed: ${error.message}`);
  }
}

/**
 * Check if safeStorage is available
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

/**
 * Compute default base URL for local Ollama
 */
export function getDefaultOllamaUrl(): string {
  return 'http://localhost:11434';
}

/**
 * Compute effective base URL from config
 * Local type defaults to localhost, remote type uses stored baseUrl
 */
export function computeBaseUrl(modelType: 'local' | 'remote', baseUrl?: string): string {
  if (modelType === 'local') {
    return baseUrl || getDefaultOllamaUrl();
  }

  if (modelType === 'remote' && !baseUrl) {
    throw new Error('Remote Ollama requires baseUrl');
  }

  return baseUrl!;
}
