/**
 * IPC Storage Service
 * ALL storage operations go through IPC to ONE.core
 * NO localStorage, NO fallbacks, NO migration
 */

class IPCStorage {
  /**
   * Store data in ONE.core via IPC
   */
  async setItem(key: string, value: any): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('IPC not available - cannot store data')
    }

    const result = await window.electronAPI.invoke('onecore:secureStore', {
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      encrypted: this.shouldEncrypt(key)
    })
    
    if (!result?.success) {
      throw new Error(result?.error || `Failed to store ${key}`)
    }
  }

  /**
   * Get data from ONE.core via IPC
   */
  async getItem(key: string): Promise<any> {
    if (!window.electronAPI) {
      throw new Error('IPC not available - cannot retrieve data')
    }

    const result = await window.electronAPI.invoke('onecore:secureRetrieve', { key })
    
    if (!result?.success) {
      return null
    }

    // Parse JSON if needed
    let value = result.value
    if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
      try {
        value = JSON.parse(value)
      } catch {
        // Not JSON, return as-is
      }
    }
    
    return value
  }

  /**
   * Remove data from ONE.core via IPC
   */
  async removeItem(key: string): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('IPC not available - cannot remove data')
    }

    // Store null to remove
    await this.setItem(key, null)
  }

  /**
   * Clear all app data via IPC
   */
  async clear(): Promise<void> {
    if (!window.electronAPI) {
      throw new Error('IPC not available - cannot clear data')
    }

    const result = await window.electronAPI.invoke('onecore:clearStorage')
    
    if (!result?.success) {
      throw new Error(result?.error || 'Failed to clear storage')
    }
  }

  /**
   * Determine if a key should be encrypted
   */
  private shouldEncrypt(key: string): boolean {
    const sensitiveKeys = [
      'api_key',
      'password',
      'secret',
      'token',
      'credential',
      'private'
    ]
    
    return sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))
  }
}

// Export singleton instance
export const ipcStorage = new IPCStorage()