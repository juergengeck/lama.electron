/**
 * Electron API TypeScript Definitions
 */

export interface ElectronAPI {
  // UDP Socket APIs
  udpCreate: (socketId: string, type: 'udp4' | 'udp6') => Promise<boolean>
  udpBind: (socketId: string, port: number, address?: string) => Promise<{
    address: string
    port: number
    family: string
  }>
  udpSend: (socketId: string, data: number[], port: number, address: string) => Promise<number>
  udpClose: (socketId: string) => Promise<void>
  onUDPMessage: (callback: (socketId: string, eventType: string, ...args: any[]) => void) => void
  
  // App control APIs
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  
  // System info
  getPlatform: () => Promise<string>
  getVersion: () => Promise<string>
  
  // File system (restricted)
  selectDirectory: () => Promise<string | null>
  selectFile: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<string | null>
  
  // Clipboard
  copyToClipboard: (text: string) => Promise<boolean>
  readFromClipboard: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}