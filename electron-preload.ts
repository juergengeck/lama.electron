const { contextBridge, ipcRenderer } = require('electron');

// Type definitions for the ElectronAPI
interface NodeLogData {
  level: string;
  message: string;
  timestamp?: string;
}

interface ElectronAPI {
  platform: string;
  isElectron: boolean;
  log: (message: string) => void;
  invoke: (channel: string, ...args: any[]) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
  off: (channel: string, callback: (...args: any[]) => void) => void;
  createUdpSocket: (options: any) => Promise<{ id: string }>;
  clearAppData: () => Promise<{ success: boolean; message?: string; error?: string }>;
  createInvitation: () => Promise<any>;
  getConnectionsInfo: () => Promise<any>;
  getConnectionsStatus: () => Promise<any>;
  getDevices: () => Promise<any>;
  getConnectedDevices: () => Promise<any>;
  registerDevice: (deviceInfo: any) => Promise<any>;
  removeDevice: (deviceId: string) => Promise<any>;
  getInstanceInfo: () => Promise<any>;
}

// Debug: Log that preload script is running
console.log('[PRELOAD] Preload script loaded, setting up node-log listener...');

// Listen for Node.js logs and forward to browser console
ipcRenderer.on('node-log', (event: Electron.IpcRendererEvent, data: NodeLogData) => {
  const { level, message, timestamp } = data;
  const time = timestamp ? timestamp.split('T')[1].split('.')[0] : '';
  const prefix = `[NODE ${time}]`;

  // Style the logs to distinguish them from browser logs
  const style = 'color: #007ACC; font-weight: bold;';

  switch(level) {
    case 'error':
      console.error(`%c${prefix}`, style, message);
      break;
    case 'warn':
      console.warn(`%c${prefix}`, style, message);
      break;
    case 'info':
      console.info(`%c${prefix}`, style, message);
      break;
    default:
      console.log(`%c${prefix}`, style, message);
  }
});

console.log('[PRELOAD] Node-log listener registered');

// Use contextBridge to safely expose APIs to renderer
// This maintains context isolation and prevents Node.js detection in renderer
const electronAPI: ElectronAPI = {
  // Platform info
  platform: process.platform,
  isElectron: true,
  
  // Debug logging to main process
  log: (message) => ipcRenderer.send('browser-log', 'log', message),
  
  // IPC invoke wrapper
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // IPC event listeners
  on: (channel: string, callback: (...args: any[]) => void) => {
    const subscription = (event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },

  off: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
  
  // Native UDP socket creation
  createUdpSocket: (options: any) => ipcRenderer.invoke('create-udp-socket', options),

  // App data management
  clearAppData: () => ipcRenderer.invoke('app:clearData'),

  // Invitations (via Node.js instance)
  createInvitation: () => ipcRenderer.invoke('invitation:create'),

  // Connections management (via Node.js instance)
  getConnectionsInfo: () => ipcRenderer.invoke('connections:info'),
  getConnectionsStatus: () => ipcRenderer.invoke('connections:status'),

  // Device management
  getDevices: () => ipcRenderer.invoke('devices:list'),
  getConnectedDevices: () => ipcRenderer.invoke('devices:connected'),
  registerDevice: (deviceInfo: any) => ipcRenderer.invoke('devices:register', deviceInfo),
  removeDevice: (deviceId: string) => ipcRenderer.invoke('devices:remove', deviceId),

  // Instance information
  getInstanceInfo: () => ipcRenderer.invoke('instance:info'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

console.log('Electron preload script loaded with context isolation');

// Forward browser console logs to main process for debugging
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args: any[]): void => {
  originalLog.apply(console, args);
  // Forward to main process if it contains specific keywords
  const msg = args.join(' ');
  if (msg.includes('EncryptionPlugin') || msg.includes('evenLocalNonceCounter') ||
      msg.includes('LamaBridge') || msg.includes('useLamaMessages') ||
      msg.includes('chat:newMessages') || msg.includes('IPC event')) {
    ipcRenderer.send('browser-log', 'log', msg);
  }
};

console.error = (...args: any[]): void => {
  originalError.apply(console, args);
  const msg = args.join(' ');
  if (msg.includes('EncryptionPlugin') || msg.includes('evenLocalNonceCounter')) {
    ipcRenderer.send('browser-log', 'error', msg);
  }
};

console.warn = (...args: any[]): void => {
  originalWarn.apply(console, args);
  const msg = args.join(' ');
  if (msg.includes('EncryptionPlugin') || msg.includes('evenLocalNonceCounter')) {
    ipcRenderer.send('browser-log', 'warn', msg);
  }
};