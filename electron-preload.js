const { contextBridge, ipcRenderer } = require('electron');

// Listen for Node.js logs and forward to browser console
ipcRenderer.on('node-log', (event, data) => {
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

// Use contextBridge to safely expose APIs to renderer
// This maintains context isolation and prevents Node.js detection in renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  isElectron: true,
  
  // Debug logging to main process
  log: (message) => ipcRenderer.send('browser-log', 'log', message),
  
  // IPC invoke wrapper
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  
  // IPC event listeners
  on: (channel, callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },
  
  // Native UDP socket creation
  createUdpSocket: (options) => ipcRenderer.invoke('create-udp-socket', options),
  
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
  registerDevice: (deviceInfo) => ipcRenderer.invoke('devices:register', deviceInfo),
  removeDevice: (deviceId) => ipcRenderer.invoke('devices:remove', deviceId),
  
  // Instance information
  getInstanceInfo: () => ipcRenderer.invoke('instance:info'),
});

console.log('Electron preload script loaded with context isolation');

// Forward browser console logs to main process for debugging
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args) => {
  originalLog.apply(console, args);
  // Forward to main process if it contains EncryptionPlugin
  const msg = args.join(' ');
  if (msg.includes('EncryptionPlugin') || msg.includes('evenLocalNonceCounter')) {
    ipcRenderer.send('browser-log', 'log', msg);
  }
};

console.error = (...args) => {
  originalError.apply(console, args);
  const msg = args.join(' ');
  if (msg.includes('EncryptionPlugin') || msg.includes('evenLocalNonceCounter')) {
    ipcRenderer.send('browser-log', 'error', msg);
  }
};

console.warn = (...args) => {
  originalWarn.apply(console, args);
  const msg = args.join(' ');
  if (msg.includes('EncryptionPlugin') || msg.includes('evenLocalNonceCounter')) {
    ipcRenderer.send('browser-log', 'warn', msg);
  }
};