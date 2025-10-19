/**
 * ONE.core IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to OneCoreHandler methods.
 * Business logic lives in ../../../lama.core/handlers/OneCoreHandler.ts
 */

import { OneCoreHandler } from '@lama/core/handlers/OneCoreHandler.js';
import nodeOneCore from '../../core/node-one-core.js';
import stateManager from '../../state/manager.js';
import chumSettings from '../../services/chum-settings.js';
import credentialsManager from '../../services/credentials-manager.js';
import { decryptToken } from '../../services/ollama-config-manager.js';
import { clearAppDataShared } from '../../../lama-electron-shadcn.js';
import nodeProvisioning from '../../services/node-provisioning.js';
import type { IpcMainInvokeEvent } from 'electron';

// Import llmConfigHandler for secure storage operations
let llmConfigHandler: any;
import('./llm-config.js').then(module => {
  // Get the handler instance after it's initialized
  const { handleSetOllamaConfig } = module;
  llmConfigHandler = {
    setConfig: async (request: any) => {
      return await handleSetOllamaConfig({} as any, request);
    }
  };
});

// Create handler instance with Electron-specific dependencies
const oneCoreHandler = new OneCoreHandler(
  nodeOneCore,
  stateManager,
  chumSettings,
  credentialsManager
);

// Export function to invalidate cache when contacts change
export function invalidateContactsCache(): void {
  oneCoreHandler.invalidateContactsCache();
}

/**
 * Thin IPC adapter - maps ipcMain.handle() calls to handler methods
 */
const oneCoreHandlers = {
  /**
   * Initialize Node.js ONE.core instance
   * Platform-specific: Uses nodeProvisioning from lama.electron
   */
  async initializeNode(event: IpcMainInvokeEvent, params: any) {
    const { name, password } = params.user || params;
    console.log('[OneCoreElectronHandler] Initialize Node.js ONE.core instance:', name);

    try {
      const result = await nodeProvisioning.provision({
        user: { name, password }
      });
      return result;
    } catch (error) {
      console.error('[OneCoreElectronHandler] Failed to initialize Node:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  },

  /**
   * Create local invite for browser connection
   */
  async createLocalInvite(event: IpcMainInvokeEvent, options: any = {}) {
    return await oneCoreHandler.createLocalInvite(options);
  },

  /**
   * Create pairing invitation for browser instance
   */
  async createBrowserPairingInvite(event: IpcMainInvokeEvent) {
    return await oneCoreHandler.createBrowserPairingInvite();
  },

  /**
   * Get stored browser pairing invitation
   */
  async getBrowserPairingInvite(event: IpcMainInvokeEvent) {
    return await oneCoreHandler.getBrowserPairingInvite();
  },

  /**
   * Create network invite for remote connections
   */
  async createNetworkInvite(event: IpcMainInvokeEvent, options: any = {}) {
    return await oneCoreHandler.createNetworkInvite(options);
  },

  /**
   * List all active invites
   */
  async listInvites(event: IpcMainInvokeEvent) {
    return await oneCoreHandler.listInvites();
  },

  /**
   * Revoke an invite
   */
  async revokeInvite(event: IpcMainInvokeEvent, { inviteId }: { inviteId: string }) {
    return await oneCoreHandler.revokeInvite(inviteId);
  },

  /**
   * Get Node instance status
   */
  async getNodeStatus(event: IpcMainInvokeEvent) {
    return await oneCoreHandler.getNodeStatus();
  },

  /**
   * Set Node instance configuration state
   */
  async setNodeState(event: IpcMainInvokeEvent, params: { key: string; value: any }) {
    return await oneCoreHandler.setNodeState(params);
  },

  /**
   * Get Node instance configuration state
   */
  async getNodeState(event: IpcMainInvokeEvent, params: { key: string }) {
    return await oneCoreHandler.getNodeState(params);
  },

  /**
   * Get Node instance full configuration
   */
  async getNodeConfig(event: IpcMainInvokeEvent) {
    return await oneCoreHandler.getNodeConfig();
  },

  /**
   * Get contacts from Node.js ONE.core instance
   */
  async getContacts(event?: IpcMainInvokeEvent) {
    return await oneCoreHandler.getContacts({});
  },

  /**
   * Test settings replication with credentials
   */
  async testSettingsReplication(event: IpcMainInvokeEvent, params: { category: string; data: any }) {
    return await oneCoreHandler.testSettingsReplication(params.category, params.data);
  },

  /**
   * Sync connection settings to peers
   */
  async syncConnectionSettings(event: IpcMainInvokeEvent, connectionSettings: any) {
    return await oneCoreHandler.syncConnectionSettings(connectionSettings);
  },

  /**
   * Get credentials status and trust information
   */
  async getCredentialsStatus(event: IpcMainInvokeEvent) {
    return await oneCoreHandler.getCredentialsStatus();
  },

  /**
   * Get shared credentials for browser IoM setup
   */
  async getBrowserCredentials(event: IpcMainInvokeEvent) {
    return await oneCoreHandler.getBrowserCredentials();
  },

  /**
   * Get list of connected peers
   */
  async getPeerList(event: IpcMainInvokeEvent) {
    return await oneCoreHandler.getPeerList();
  },

  /**
   * Store data securely using LLM objects
   */
  async secureStore(event: IpcMainInvokeEvent, params: { key: string; value: any; encrypted?: boolean }) {
    return await oneCoreHandler.secureStore(params.key, params.value, params.encrypted, llmConfigHandler);
  },

  /**
   * Retrieve data from LLM objects
   */
  async secureRetrieve(event: IpcMainInvokeEvent, params: { key: string }) {
    return await oneCoreHandler.secureRetrieve(params.key, decryptToken);
  },

  /**
   * Clear storage
   */
  async clearStorage(event: IpcMainInvokeEvent) {
    return await oneCoreHandler.clearStorage(clearAppDataShared);
  },

  /**
   * Restart Node.js ONE.core instance
   */
  async restartNode(event: IpcMainInvokeEvent) {
    return await oneCoreHandler.restartNode();
  },

  /**
   * Update user's mood
   */
  async updateMood(event: IpcMainInvokeEvent, params: { mood: string }) {
    return await oneCoreHandler.updateMood({ mood: params.mood });
  },

  /**
   * Check if the current user has a PersonName set in their profile
   */
  async hasPersonName(event: IpcMainInvokeEvent) {
    return await oneCoreHandler.hasPersonName();
  },

  /**
   * Set PersonName for the current user's profile
   */
  async setPersonName(event: IpcMainInvokeEvent, params: { name: string }) {
    return await oneCoreHandler.setPersonName({ name: params.name });
  }
};

export default oneCoreHandlers;
