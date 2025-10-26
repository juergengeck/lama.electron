/**
 * QuicVC Discovery IPC Handlers
 *
 * Provides IPC interface for QuicVC device discovery in the UI
 */

import electron from 'electron';
const { ipcMain } = electron;
import { DiscoveryService } from '@lama/connection.core';
import { QuicVCDiscovery } from '../../core/quicvc-discovery.js';
import nodeOneCore from '../../core/node-one-core.js';
import type { IpcMainInvokeEvent } from 'electron';

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  devices?: any[];
  [key: string]: any;
}

// Singleton discovery service instance
let discoveryService: DiscoveryService | null = null;
let quicvcDiscovery: QuicVCDiscovery | null = null;

/**
 * Initialize QuicVC discovery service
 */
async function initializeDiscoveryService(): Promise<void> {
  if (discoveryService) {
    return; // Already initialized
  }

  // Get own device info from nodeOneCore
  const ownDeviceId = nodeOneCore.ownerId || 'unknown';
  const ownDeviceName = nodeOneCore.instanceName || 'lama-electron';

  console.log('[QuicVCDiscovery] Initializing with device ID:', ownDeviceId, 'name:', ownDeviceName);

  // Create QuicVC discovery provider
  quicvcDiscovery = new QuicVCDiscovery(ownDeviceId, ownDeviceName);

  // Create discovery service
  discoveryService = new DiscoveryService();

  // Initialize with QuicVC local discovery
  await discoveryService.initialize({
    localDiscovery: quicvcDiscovery,
  });

  // Start continuous discovery
  discoveryService.start({
    methods: ['local'],
    timeout: 2000,
  });

  // Setup event listeners
  discoveryService.on('peerDiscovered', (peer) => {
    console.log('[QuicVCDiscovery] Peer discovered:', peer.name, 'at', peer.address);

    // Broadcast to all renderer windows
    const allWindows = electron.BrowserWindow.getAllWindows();
    allWindows.forEach((win) => {
      win.webContents.send('quicvc:peerDiscovered', peer);
    });
  });

  discoveryService.on('peerLost', (peer) => {
    console.log('[QuicVCDiscovery] Peer lost:', peer.id);

    // Broadcast to all renderer windows
    const allWindows = electron.BrowserWindow.getAllWindows();
    allWindows.forEach((win) => {
      win.webContents.send('quicvc:peerLost', peer);
    });
  });

  console.log('[QuicVCDiscovery] Service initialized and started');
}

/**
 * Initialize QuicVC discovery IPC handlers
 */
export function initializeQuicVCDiscoveryHandlers(): void {
  /**
   * Start QuicVC discovery
   */
  ipcMain.handle('quicvc:startDiscovery', async (event: IpcMainInvokeEvent): Promise<IpcResponse> => {
    try {
      console.log('[QuicVCDiscovery] Starting discovery via IPC');

      // Initialize if not already done
      if (!discoveryService) {
        await initializeDiscoveryService();
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('[QuicVCDiscovery] Failed to start discovery:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * Stop QuicVC discovery
   */
  ipcMain.handle('quicvc:stopDiscovery', async (event: IpcMainInvokeEvent): Promise<IpcResponse> => {
    try {
      console.log('[QuicVCDiscovery] Stopping discovery via IPC');

      if (discoveryService) {
        discoveryService.stop();
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('[QuicVCDiscovery] Failed to stop discovery:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * Get discovered QuicVC devices
   */
  ipcMain.handle('quicvc:getDiscoveredDevices', async (event: IpcMainInvokeEvent): Promise<IpcResponse> => {
    try {
      // Initialize if not already done
      if (!discoveryService) {
        await initializeDiscoveryService();
      }

      // Get discovered peers from discovery service
      const peers = discoveryService!.getDiscoveredPeers();

      // Convert to device format for UI
      const devices = peers.map((peer) => ({
        id: peer.id,
        name: peer.name,
        type: 'quicvc',
        status: 'discovered',
        address: peer.address,
        capabilities: peer.capabilities,
        discoveredAt: new Date(peer.discoveredAt).toISOString(),
        lastSeen: new Date(peer.lastSeenAt).toISOString(),
        credentialStatus: peer.credentialStatus,
      }));

      console.log('[QuicVCDiscovery] Returning', devices.length, 'discovered devices');

      return {
        success: true,
        devices,
      };
    } catch (error) {
      console.error('[QuicVCDiscovery] Failed to get discovered devices:', error);
      return {
        success: false,
        error: (error as Error).message,
        devices: [],
      };
    }
  });

  /**
   * Perform one-time discovery scan
   */
  ipcMain.handle('quicvc:scan', async (event: IpcMainInvokeEvent, timeout?: number): Promise<IpcResponse> => {
    try {
      console.log('[QuicVCDiscovery] Performing discovery scan');

      // Initialize if not already done
      if (!discoveryService) {
        await initializeDiscoveryService();
      }

      // Perform scan
      const peers = await discoveryService!.scan({
        methods: ['local'],
        timeout: timeout || 2000,
      });

      // Convert to device format
      const devices = peers.map((peer) => ({
        id: peer.id,
        name: peer.name,
        type: 'quicvc',
        status: 'discovered',
        address: peer.address,
        capabilities: peer.capabilities,
        discoveredAt: new Date(peer.discoveredAt).toISOString(),
        lastSeen: new Date(peer.lastSeenAt).toISOString(),
      }));

      console.log('[QuicVCDiscovery] Scan complete, found', devices.length, 'devices');

      return {
        success: true,
        devices,
      };
    } catch (error) {
      console.error('[QuicVCDiscovery] Scan failed:', error);
      return {
        success: false,
        error: (error as Error).message,
        devices: [],
      };
    }
  });

  console.log('[QuicVCDiscovery] IPC handlers registered');
}

/**
 * Auto-initialize discovery when Node.js ONE.core is ready
 */
export async function autoInitializeDiscovery(): Promise<void> {
  // Wait for nodeOneCore to be initialized
  if (!nodeOneCore.initialized) {
    console.log('[QuicVCDiscovery] Waiting for nodeOneCore to initialize...');
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(() => {
        if (nodeOneCore.initialized) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  // Initialize discovery service automatically
  await initializeDiscoveryService();
}
