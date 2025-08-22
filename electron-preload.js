const { contextBridge, ipcRenderer } = require('electron');

// Use contextBridge to safely expose APIs to renderer
// This maintains context isolation and prevents Node.js detection in renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,
  isElectron: true,
  
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
});

console.log('Electron preload script loaded with context isolation');