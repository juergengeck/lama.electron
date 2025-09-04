/**
 * State Management IPC Handlers
 */

import stateManager from '../../state/manager.js'

const stateHandlers = {
  async getState(event, { path } = {}) {
    console.log('[StateHandler] Get state request:', path || 'all')
    
    if (path) {
      return stateManager.getState(path)
    }
    
    // Return full serializable state
    return stateManager.toJSON()
  },

  async subscribe(event, { paths = [] }) {
    console.log('[StateHandler] Subscribe to state changes:', paths)
    
    const unsubscribers = []
    
    // Subscribe to specific paths or all changes
    if (paths.length === 0) {
      // Subscribe to all state changes
      const handler = (change) => {
        event.sender.send('state:changed', change)
      }
      stateManager.on('stateChanged', handler)
      
      // Store unsubscriber
      unsubscribers.push(() => {
        stateManager.off('stateChanged', handler)
      })
    } else {
      // Subscribe to specific paths
      paths.forEach(path => {
        const unwatch = stateManager.watch(path, (newValue, oldValue) => {
          event.sender.send('state:changed', {
            path,
            newValue,
            oldValue
          })
        })
        unsubscribers.push(unwatch)
      })
    }
    
    // Handle cleanup when renderer disconnects
    event.sender.once('destroyed', () => {
      unsubscribers.forEach(unsub => unsub())
    })
    
    return { subscribed: true, paths }
  }
}

export default stateHandlers