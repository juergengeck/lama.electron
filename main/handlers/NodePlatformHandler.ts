/**
 * Node Platform Handler (Platform-Specific)
 *
 * Extracted from OneCoreHandler - Electron/Node.js platform infrastructure.
 * Handles platform-specific operations:
 * - Instance lifecycle (initialization, shutdown, restart)
 * - State management
 * - Storage operations
 * - Pairing and invites
 * - Credentials management
 * - Settings replication
 */

/**
 * NodePlatformHandler - Platform infrastructure for Electron/Node.js
 */
export class NodePlatformHandler {
  private nodeOneCore: any;
  private stateManager: any;
  private chumSettings: any;
  private credentialsManager: any;

  constructor(
    nodeOneCore: any,
    stateManager?: any,
    chumSettings?: any,
    credentialsManager?: any
  ) {
    this.nodeOneCore = nodeOneCore;
    this.stateManager = stateManager;
    this.chumSettings = chumSettings;
    this.credentialsManager = credentialsManager;
  }

  /**
   * Initialize Node.js ONE.core instance
   * NOTE: Platform-specific implementation
   */
  async initializeNode(params: { user?: { name: string; password: string }; name?: string; password?: string }): Promise<{ success: boolean; data?: any; error?: string }> {
    throw new Error('initializeNode must be implemented by platform layer (lama.electron)');
  }

  /**
   * Get Node instance status
   */
  async getNodeStatus(): Promise<{ success: boolean; [key: string]: any }> {
    const info = this.nodeOneCore.getInfo();
    return {
      success: true,
      ...info
    };
  }

  /**
   * Set Node instance configuration state
   */
  async setNodeState(params: { key: string; value: any }): Promise<{ success: boolean; error?: string }> {
    console.log(`[NodePlatformHandler] Set Node state: ${params.key}`);

    try {
      await this.nodeOneCore.setState(params.key, params.value);
      return { success: true };
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to set state:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get Node instance configuration state
   */
  async getNodeState(params: { key: string }): Promise<{ success: boolean; value?: any; error?: string }> {
    console.log(`[NodePlatformHandler] Get Node state: ${params.key}`);

    try {
      const value = this.nodeOneCore.getState(params.key);
      return {
        success: true,
        value
      };
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to get state:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get Node instance full configuration
   */
  async getNodeConfig(): Promise<{ success: boolean; config?: any; error?: string }> {
    console.log('[NodePlatformHandler] Get Node configuration');

    try {
      const info = this.nodeOneCore.getInfo();
      return {
        success: true,
        config: info.config || {}
      };
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to get config:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Clear storage
   *
   * NOTE: This method requires platform-specific clearAppDataShared function.
   * The platform adapter should inject the clearAppDataShared function.
   */
  async clearStorage(clearAppDataShared?: () => Promise<{ success: boolean; error?: string }>): Promise<{ success: boolean; error?: string }> {
    console.log('[NodePlatformHandler] Clear storage request');

    try {
      if (!clearAppDataShared) {
        throw new Error('clearAppDataShared function not provided');
      }

      const result = await clearAppDataShared();
      console.log('[NodePlatformHandler] clearAppDataShared result:', result);
      return result;
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to clear storage:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Restart ONE.core instance
   */
  async restartNode(): Promise<{ success: boolean; data?: any; error?: string }> {
    console.log('[NodePlatformHandler] Restarting ONE.core instance...');

    try {
      if (this.nodeOneCore.initialized) {
        console.log('[NodePlatformHandler] Shutting down current instance...');
        await this.nodeOneCore.shutdown();
      }

      console.log('[NodePlatformHandler] Instance shut down - UI must re-initialize');

      return {
        success: true,
        data: {
          message: 'Instance shut down - please re-login'
        }
      };
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to restart instance:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Create local invite for browser connection
   */
  async createLocalInvite(options: any = {}): Promise<{ success: boolean; invite?: any; error?: string }> {
    console.log('[NodePlatformHandler] Create local invite');
    try {
      const invite = await (this.nodeOneCore as any).createLocalInvite(options);
      return { success: true, invite };
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to create local invite:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Create pairing invitation for browser instance
   */
  async createBrowserPairingInvite(): Promise<{ success: boolean; invitation?: any; error?: string }> {
    console.log('[NodePlatformHandler] Create browser pairing invitation');
    try {
      const invitation = await (this.nodeOneCore as any).createBrowserPairingInvite();
      return { success: true, invitation };
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to create browser pairing invite:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get stored browser pairing invitation
   */
  async getBrowserPairingInvite(): Promise<{ success: boolean; invitation?: any; error?: string }> {
    console.log('[NodePlatformHandler] Get browser pairing invitation');

    if (!this.stateManager) {
      return {
        success: false,
        error: 'State manager not available'
      };
    }

    try {
      const browserInvite = this.stateManager.getState('browserInvite');

      if (!browserInvite) {
        return {
          success: false,
          error: 'No browser invitation available'
        };
      }

      const now = new Date();
      const expiresAt = new Date(browserInvite.expiresAt);

      if (now > expiresAt) {
        return {
          success: false,
          error: 'Browser invitation has expired'
        };
      }

      return {
        success: true,
        invitation: browserInvite.invitation
      };
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to get browser pairing invite:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Create network invite for remote connections
   */
  async createNetworkInvite(options: any = {}): Promise<{ success: boolean; invite?: any; error?: string }> {
    console.log('[NodePlatformHandler] Create network invite');
    try {
      const invite = await (this.nodeOneCore as any).createNetworkInvite(options);
      return { success: true, invite };
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to create network invite:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * List all active invites
   */
  async listInvites(): Promise<{ success: boolean; invites?: any[]; error?: string }> {
    console.log('[NodePlatformHandler] List invites');
    try {
      const invites = await (this.nodeOneCore as any).listInvites();
      return { success: true, invites };
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to list invites:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Revoke an invite
   */
  async revokeInvite(inviteId: string): Promise<{ success: boolean; error?: string }> {
    console.log('[NodePlatformHandler] Revoke invite:', inviteId);
    try {
      await (this.nodeOneCore as any).revokeInvite(inviteId);
      return { success: true };
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to revoke invite:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get credentials status
   */
  async getCredentialsStatus(): Promise<{ success: boolean; ownCredentials?: number; trustedIssuers?: number; instanceId?: string; error?: string }> {
    if (!this.credentialsManager) {
      return { success: false, error: 'Credentials manager not available' };
    }

    console.log('[NodePlatformHandler] Getting credentials status');

    try {
      const credentials = this.credentialsManager.getAllCredentials();
      return {
        success: true,
        ownCredentials: credentials.own.length,
        trustedIssuers: credentials.trusted.length,
        instanceId: this.credentialsManager.getOwnInstanceId()
      };
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to get credentials status:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Get shared credentials for browser IoM setup
   */
  async getBrowserCredentials(): Promise<{ success: boolean; error?: string; [key: string]: any }> {
    console.log('[NodePlatformHandler] Getting credentials for browser IoM');

    try {
      const credentials = await this.nodeOneCore.getCredentialsForBrowser();
      return {
        success: true,
        ...credentials
      };
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to get browser credentials:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Test settings replication with credentials
   */
  async testSettingsReplication(category: string, data: any): Promise<{ success: boolean; testResult?: any; error?: string }> {
    console.log(`[NodePlatformHandler] Testing settings replication: ${category}`);

    if (!this.chumSettings) {
      return {
        success: false,
        error: 'CHUM settings not available'
      };
    }

    try {
      const result = await this.chumSettings.testSettingsValidation(category, data);
      return {
        success: true,
        testResult: result
      };
    } catch (error) {
      console.error('[NodePlatformHandler] Settings replication test failed:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }

  /**
   * Sync connection settings to peers
   */
  async syncConnectionSettings(connectionSettings: any): Promise<{ success: boolean; settingsId?: string; replicatedAt?: number; error?: string }> {
    console.log('[NodePlatformHandler] Syncing connection settings to peers');

    if (!this.chumSettings) {
      return {
        success: false,
        error: 'CHUM settings not available'
      };
    }

    try {
      const settingsObject = await this.chumSettings.syncConnectionSettings(connectionSettings);
      return {
        success: true,
        settingsId: settingsObject.id,
        replicatedAt: settingsObject.timestamp
      };
    } catch (error) {
      console.error('[NodePlatformHandler] Failed to sync connection settings:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  }
}
