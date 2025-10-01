/**
 * Settings IPC Handlers (TypeScript)
 * Manages settings synchronization between browser and node instances
 */

import { IpcMainInvokeEvent } from 'electron';
import nodeOneCore from '../../core/node-one-core.js';

interface SetSettingRequest {
  key: string;
  value: any;
}

interface SettingsResult {
  success: boolean;
}

interface SubscribeResult {
  subscribed: boolean;
}

interface SettingChange {
  key: string;
}

interface BrowserSettings {
  [key: string]: any;
}

interface IomSettings {
  'iom.group'?: string;
  'iom.owner'?: string;
  'iom.node.connected'?: boolean;
  'iom.browser.connected'?: boolean;
  [key: string]: any;
}

interface InstanceConfig {
  node: {
    initialized: boolean;
    hasSettings: boolean;
    hasIoMSettings: boolean;
    instanceId?: string;
    instanceType?: string;
    storageRole?: string;
    syncEnabled?: boolean;
  };
  iom?: {
    group: any;
    owner: any;
    nodeConnected: any;
    browserConnected: any;
  };
}

const settingsHandlers = {
  /**
   * Get a setting value from the node instance
   */
  async getSetting(event: IpcMainInvokeEvent, key: string): Promise<any> {
    console.log('[Settings] Getting setting:', key);

    if (!nodeOneCore.getInfo().initialized) {
      throw new Error('Node instance not initialized');
    }

    const value = await nodeOneCore.getSetting(key);
    return value;
  },

  /**
   * Set a setting value in the node instance
   */
  async setSetting(event: IpcMainInvokeEvent, request: SetSettingRequest): Promise<SettingsResult> {
    const { key, value } = request;
    console.log('[Settings] Setting:', key, '=', value);

    if (!nodeOneCore.getInfo().initialized) {
      throw new Error('Node instance not initialized');
    }

    await nodeOneCore.setSetting(key, value);

    // Broadcast the change to all listeners
    return { success: true };
  },

  /**
   * Get all settings with a specific prefix
   */
  async getSettings(event: IpcMainInvokeEvent, prefix?: string): Promise<any> {
    console.log('[Settings] Getting settings with prefix:', prefix);

    if (!nodeOneCore.getInfo().initialized) {
      throw new Error('Node instance not initialized');
    }

    const settings = await nodeOneCore.getSettings(prefix);
    return settings;
  },

  /**
   * Sync IoM settings between browser and node
   */
  async syncIoMSettings(event: IpcMainInvokeEvent, browserSettings?: BrowserSettings): Promise<IomSettings> {
    console.log('[Settings] Syncing IoM settings from browser');

    if (!nodeOneCore.getInfo().initialized) {
      throw new Error('Node instance not initialized');
    }

    // Sync browser-specific settings to IoM
    if (browserSettings) {
      for (const [key, value] of Object.entries(browserSettings)) {
        if (key.startsWith('iom.browser.')) {
          await nodeOneCore.setSetting(key, value);
        }
      }
    }

    // Return current IoM settings from node
    const iomSettings: any = null; // TODO: Implement proper settings retrieval
    if (iomSettings) {
      const settings: IomSettings = {};
      // Get relevant IoM settings
      settings['iom.group'] = iomSettings.getValue('iom.group');
      settings['iom.owner'] = iomSettings.getValue('iom.owner');
      settings['iom.node.connected'] = iomSettings.getValue('iom.node.connected');
      settings['iom.browser.connected'] = iomSettings.getValue('iom.browser.connected');
      return settings;
    }

    return {};
  },

  /**
   * Subscribe to settings changes
   */
  async subscribeToSettings(event: IpcMainInvokeEvent, prefix?: string): Promise<SubscribeResult> {
    console.log('[Settings] Subscribing to settings with prefix:', prefix);

    if (!nodeOneCore.getInfo().initialized) {
      throw new Error('Node instance not initialized');
    }

    const nodeSettings: any = null; // TODO: Implement proper settings
    const iomSettings: any = null; // TODO: Implement proper settings

    // Subscribe to node settings changes
    if (nodeSettings) {
      nodeSettings.onSettingChange((key: string, value: any) => {
        if (!prefix || key.startsWith(prefix)) {
          event.sender.send('settings:changed', { key, value } as SettingChange);
        }
      });
    }

    // Subscribe to IoM settings changes
    if (iomSettings) {
      iomSettings.onSettingChange((key: string, value: any) => {
        if (!prefix || key.startsWith(prefix)) {
          event.sender.send('settings:changed', { key, value } as SettingChange);
        }
      });
    }

    return { subscribed: true };
  },

  /**
   * Get instance configuration
   */
  async getInstanceConfig(event: IpcMainInvokeEvent): Promise<InstanceConfig> {
    console.log('[Settings] Getting instance configuration');

    const config: InstanceConfig = {
      node: {
        initialized: nodeOneCore.initialized,
        hasSettings: false, // TODO: Check if settings exist
        hasIoMSettings: false // TODO: Check if IoM settings exist
      }
    };

    if (nodeOneCore.initialized) {
      config.node.instanceId = await nodeOneCore.getSetting('instance.id');
      config.node.instanceType = await nodeOneCore.getSetting('instance.type');
      config.node.storageRole = await nodeOneCore.getSetting('storage.role');
      config.node.syncEnabled = await nodeOneCore.getSetting('sync.enabled');

      // Get IoM configuration
      // TODO: Implement proper settings retrieval using ONE.core storage
      config.iom = {
        group: null,
        owner: null,
        nodeConnected: false,
        browserConnected: false
      };
    }

    return config;
  }
};

export default settingsHandlers;