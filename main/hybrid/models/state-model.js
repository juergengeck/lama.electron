/**
 * State Model - ONE.CORE based state management
 * Stores application state as ONE.CORE objects
 * Inspired by one.leute's approach
 */

const EventEmitter = require('events')

class StateModel extends EventEmitter {
  constructor(instance) {
    super()
    this.instance = instance
    this.stateType = null
    this.cache = new Map()
  }

  async load() {
    // Register or get State object type
    this.stateType = await this.instance.createObjectType({
      name: 'State',
      version: '1.0.0',
      schema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          value: { type: 'any' },
          timestamp: { type: 'string' },
          version: { type: 'number' }
        },
        required: ['path', 'value', 'timestamp']
      }
    })
    
    // Load existing state into cache
    await this.loadStateObjects()
  }

  async loadStateObjects() {
    const states = await this.instance.getObjectsByType('State')
    
    // Build cache from latest versions
    for (const stateObj of states) {
      const existing = this.cache.get(stateObj.path)
      if (!existing || stateObj.version > existing.version) {
        this.cache.set(stateObj.path, stateObj)
      }
    }
  }

  async set(path, value) {
    // Get current version
    const current = this.cache.get(path)
    const version = current ? current.version + 1 : 1
    
    // Create new state object in ONE.CORE
    const stateObj = await this.instance.createObject({
      type: 'State',
      path,
      value,
      timestamp: new Date().toISOString(),
      version
    })
    
    // Update cache
    const oldValue = current?.value
    this.cache.set(path, stateObj)
    
    // Emit change event
    this.emit('changed', {
      path,
      oldValue,
      newValue: value,
      version
    })
    
    return stateObj
  }

  async get(path) {
    // Check cache first
    const cached = this.cache.get(path)
    if (cached) {
      return cached.value
    }
    
    // Query ONE.CORE
    const states = await this.instance.query({
      type: 'State',
      where: { path }
    })
    
    if (states.length > 0) {
      // Get latest version
      const latest = states.reduce((prev, curr) => 
        curr.version > prev.version ? curr : prev
      )
      
      this.cache.set(path, latest)
      return latest.value
    }
    
    return undefined
  }

  async getAll() {
    const result = {}
    for (const [path, stateObj] of this.cache) {
      result[path] = stateObj.value
    }
    return result
  }

  async delete(path) {
    // Mark as deleted in ONE.CORE (append-only)
    const deleteObj = await this.instance.createObject({
      type: 'State',
      path,
      value: null,
      deleted: true,
      timestamp: new Date().toISOString(),
      version: Date.now()
    })
    
    this.cache.delete(path)
    
    this.emit('deleted', { path })
    
    return deleteObj
  }

  // Get state history
  async getHistory(path, limit = 10) {
    const states = await this.instance.query({
      type: 'State',
      where: { path },
      orderBy: 'version',
      order: 'desc',
      limit
    })
    
    return states.map(s => ({
      value: s.value,
      timestamp: s.timestamp,
      version: s.version
    }))
  }

  // Watch for changes from other instances
  watchRemoteChanges() {
    this.instance.on('objectCreated', async (obj) => {
      if (obj.type === 'State') {
        const current = this.cache.get(obj.path)
        
        // Only update if newer version
        if (!current || obj.version > current.version) {
          const oldValue = current?.value
          this.cache.set(obj.path, obj)
          
          this.emit('remoteChanged', {
            path: obj.path,
            oldValue,
            newValue: obj.value,
            version: obj.version,
            remote: true
          })
        }
      }
    })
  }

  // Merge states from remote (CRDT-like)
  async mergeRemoteState(remoteState) {
    const localState = this.cache.get(remoteState.path)
    
    if (!localState || remoteState.version > localState.version) {
      // Remote is newer, accept it
      this.cache.set(remoteState.path, remoteState)
      this.emit('merged', {
        path: remoteState.path,
        value: remoteState.value,
        source: 'remote'
      })
    } else if (remoteState.version === localState.version && 
               remoteState.timestamp > localState.timestamp) {
      // Same version, use timestamp as tiebreaker
      this.cache.set(remoteState.path, remoteState)
      this.emit('merged', {
        path: remoteState.path,
        value: remoteState.value,
        source: 'remote-tiebreak'
      })
    }
    // Otherwise keep local version
  }

  async save() {
    // ONE.CORE handles persistence automatically
    // This is here for compatibility
    return true
  }
}

module.exports = StateModel