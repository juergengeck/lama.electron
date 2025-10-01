/**
 * State Management IPC Handlers (TypeScript)
 */

import { IpcMainInvokeEvent } from 'electron';
import stateManager from '../../state/manager.js';

interface StateRequest {
  path?: string;
}

interface SetStateRequest {
  key: string;
  value: any;
}

interface SubscribeRequest {
  paths?: string[];
}

interface StateResult {
  success: boolean;
  key?: string;
  value?: any;
  error?: string;
}

interface SubscribeResult {
  subscribed: boolean;
  paths?: string[];
}

interface StateChange {
  path: string;
  newValue: any;
  oldValue: any;
}

type UnsubscribeFunction = () => void;

const stateHandlers = {
  async getState(event: IpcMainInvokeEvent, request: StateRequest = {}): Promise<any> {
    const { path } = request;
    console.log('[StateHandler] Get state request:', path || 'all');

    if (path) {
      return stateManager.getState(path);
    }

    // Return full serializable state
    return stateManager.toJSON();
  },

  async setState(event: IpcMainInvokeEvent, request: SetStateRequest): Promise<StateResult> {
    const { key, value } = request;
    console.log('[StateHandler] Set state request:', key, '=', value);

    try {
      stateManager.setState(key, value);
      return { success: true, key, value };
    } catch (error) {
      console.error('[StateHandler] Error setting state:', error);
      return { success: false, error: (error as Error).message };
    }
  },

  async subscribe(event: IpcMainInvokeEvent, request: SubscribeRequest = {}): Promise<SubscribeResult> {
    const { paths = [] } = request;
    console.log('[StateHandler] Subscribe to state changes:', paths);

    const unsubscribers: UnsubscribeFunction[] = [];

    // Subscribe to specific paths or all changes
    if (paths.length === 0) {
      // Subscribe to all state changes
      const handler = (change: StateChange) => {
        event.sender.send('state:changed', change);
      };
      stateManager.on('stateChanged', handler);

      // Store unsubscriber
      unsubscribers.push(() => {
        stateManager.off('stateChanged', handler);
      });
    } else {
      // Subscribe to specific paths
      paths.forEach(path => {
        const unwatch = stateManager.watch(path, (newValue: any, oldValue: any) => {
          event.sender.send('state:changed', {
            path,
            newValue,
            oldValue
          } as StateChange);
        });
        unsubscribers.push(unwatch);
      });
    }

    // Handle cleanup when renderer disconnects
    event.sender.once('destroyed', () => {
      unsubscribers.forEach(unsub => unsub());
    });

    return { subscribed: true, paths };
  }
};

export default stateHandlers;