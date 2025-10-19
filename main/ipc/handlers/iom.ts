/**
 * IOM IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to IOMHandler methods.
 * Business logic lives in ../../../lama.core/handlers/IOMHandler.ts
 * Platform-specific operations (fs, storage, events) handled here.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import type { IpcMainInvokeEvent } from 'electron';
import { IOMHandler } from '@lama/core/handlers/IOMHandler.js';
import nodeOneCore from '../../core/node-one-core.js';

// Singleton handler instance
let iomHandler: IOMHandler | null = null;

/**
 * Platform-specific storage provider for Electron
 */
const storageProvider = {
  /**
   * Get Node.js storage info using fs operations
   */
  async getNodeStorage() {
    try {
      const dataPath = path.join(process.cwd(), 'OneDB');

      let totalSize = 0;
      let availableSpace = 0;

      // Get actual filesystem stats
      try {
        if (process.platform === 'darwin' || process.platform === 'linux') {
          const dfOutput = execSync(`df -k "${process.cwd()}"`).toString();
          const lines = dfOutput.trim().split('\n');
          if (lines.length > 1) {
            const parts = lines[1].split(/\s+/);
            const availableBlocks = parseInt(parts[3]) * 1024;
            availableSpace = availableBlocks;
          }
        } else if (process.platform === 'win32') {
          const drive = path.parse(process.cwd()).root;
          const wmicOutput = execSync(
            `wmic logicaldisk where caption="${drive.replace(/\\/g, '')}" get size,freespace /value`
          ).toString();
          const freeMatch = wmicOutput.match(/FreeSpace=(\d+)/);
          if (freeMatch) {
            availableSpace = parseInt(freeMatch[1]);
          }
        }
      } catch (e) {
        console.error('[IOM] Failed to get disk stats:', e);
        availableSpace = os.freemem();
      }

      // Calculate actual used space
      try {
        const files = await fs.readdir(dataPath, { recursive: true });
        for (const file of files) {
          try {
            const filePath = path.join(dataPath, file as string);
            const stat = await fs.stat(filePath);
            if (stat.isFile()) {
              totalSize += stat.size;
            }
          } catch (e) {
            // Ignore individual file errors
          }
        }
      } catch (e) {
        totalSize = 0;
      }

      const totalCapacity = totalSize + availableSpace;
      return {
        used: totalSize,
        total: totalCapacity,
        percentage: totalCapacity > 0 ? Math.round((totalSize / totalCapacity) * 100) : 0
      };
    } catch (error) {
      console.error('[IOM] Failed to get storage info:', error);
      return {
        used: 0,
        total: 0,
        percentage: 0
      };
    }
  }
};

/**
 * Get handler instance (creates on first use)
 */
function getHandler(): IOMHandler {
  if (!iomHandler) {
    iomHandler = new IOMHandler(nodeOneCore, storageProvider);
  }
  return iomHandler;
}

/**
 * Get current IOM instances and their states
 * Delegates to one.models ConnectionsModel
 */
async function getIOMInstances(event: IpcMainInvokeEvent) {
  const handler = getHandler();
  const result = await handler.getIOMInstances({});
  return result.instances;
}

/**
 * Create a pairing invitation
 * Delegates to one.models ConnectionsModel.pairing
 */
async function createPairingInvitation(event: IpcMainInvokeEvent) {
  const handler = getHandler();
  return await handler.createPairingInvitation({});
}

/**
 * Accept a pairing invitation
 * Delegates to one.models ConnectionsModel.pairing
 */
async function acceptPairingInvitation(event: IpcMainInvokeEvent, invitationUrl: string) {
  const handler = getHandler();
  return await handler.acceptPairingInvitation({ invitationUrl });
}

/**
 * Get connection status
 * Delegates to one.models ConnectionsModel
 */
async function getConnectionStatus(event: IpcMainInvokeEvent) {
  const handler = getHandler();
  return await handler.getConnectionStatus({});
}

/**
 * Subscribe to ONE.core events for real-time updates
 * Uses one.models event emitters instead of custom tracking
 */
function subscribeToEvents(callback: (event: any) => void) {
  if (!nodeOneCore.connectionsModel) {
    console.warn('[IOM] ConnectionsModel not available for event subscription');
    return;
  }

  // Use one.models events directly
  // @ts-expect-error - ConnectionsModel extends EventEmitter but types are incomplete
  nodeOneCore.connectionsModel.on('connection:open', (data: any) => {
    callback({
      type: 'connection:open',
      data
    });
  });

  // @ts-expect-error - ConnectionsModel extends EventEmitter but types are incomplete
  nodeOneCore.connectionsModel.on('connection:closed', (data: any) => {
    callback({
      type: 'connection:closed',
      data
    });
  });

  // @ts-expect-error - ConnectionsModel extends EventEmitter but types are incomplete
  nodeOneCore.connectionsModel.on('connection:error', (data: any) => {
    callback({
      type: 'connection:error',
      data
    });
  });

  // ChannelManager sync events
  if (nodeOneCore.channelManager) {
    // @ts-expect-error - ChannelManager extends EventEmitter but types are incomplete
    nodeOneCore.channelManager.on('sync:progress', (data: any) => {
      callback({
        type: 'sync:progress',
        data
      });
    });

    // @ts-expect-error - ChannelManager extends EventEmitter but types are incomplete
    nodeOneCore.channelManager.on('sync:completed', (data: any) => {
      callback({
        type: 'sync:completed',
        data
      });
    });
  }

  console.log('[IOM] Subscribed to ONE.core events');
}

export default {
  getIOMInstances,
  createPairingInvitation,
  acceptPairingInvitation,
  getConnectionStatus,
  subscribeToEvents
};
