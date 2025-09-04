/**
 * ONE.core IPC Handlers
 * Handle ONE.core initialization and IoM setup
 */

import nodeOneCore from '../../core/node-one-core.js';
import stateManager from '../../state/manager.js';
import chumSettings from '../../services/chum-settings.js';
import credentialsManager from '../../services/credentials-manager.js';

const oneCoreHandlers = {
  /**
   * Initialize Node.js ONE.core instance
   * This is called from the browser UI during setup
   */
  async initializeNode(event, { name, password }) {
    console.log('[OneCoreHandler] Initialize Node.js ONE.core instance:', name)
    
    try {
      // Use the nodeProvisioning module to handle initialization
      const { default: nodeProvisioning } = await import('../../hybrid/node-provisioning.js')
      const result = await nodeProvisioning.provisionNode(name, password)
      
      return result
    } catch (error) {
      console.error('[OneCoreHandler] Failed to initialize Node:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Create local invite for browser connection
   */
  async createLocalInvite(event, options = {}) {
    console.log('[OneCoreHandler] Create local invite')
    
    try {
      const invite = await nodeOneCore.createLocalInvite(options)
      return {
        success: true,
        invite
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to create local invite:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Create pairing invitation for browser instance
   */
  async createBrowserPairingInvite(event) {
    console.log('[OneCoreHandler] Create browser pairing invitation')
    
    try {
      const invitation = await nodeOneCore.createBrowserPairingInvite()
      return {
        success: true,
        invitation
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to create browser pairing invite:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Get stored browser pairing invitation
   */
  async getBrowserPairingInvite(event) {
    console.log('[OneCoreHandler] Get browser pairing invitation')
    
    try {
      const browserInvite = stateManager.getState('browserInvite')
      
      if (!browserInvite) {
        return {
          success: false,
          error: 'No browser invitation available'
        }
      }
      
      // Check if invitation is still valid
      const now = new Date()
      const expiresAt = new Date(browserInvite.expiresAt)
      
      if (now > expiresAt) {
        return {
          success: false,
          error: 'Browser invitation has expired'
        }
      }
      
      return {
        success: true,
        invitation: browserInvite.invitation
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to get browser pairing invite:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Create network invite for remote connections
   */
  async createNetworkInvite(event, options = {}) {
    console.log('[OneCoreHandler] Create network invite')
    
    try {
      const invite = await nodeOneCore.createNetworkInvite(options)
      return {
        success: true,
        invite
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to create network invite:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * List all active invites
   */
  async listInvites(event) {
    console.log('[OneCoreHandler] List invites')
    
    try {
      const invites = await nodeOneCore.listInvites()
      return {
        success: true,
        invites
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to list invites:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Revoke an invite
   */
  async revokeInvite(event, { inviteId }) {
    console.log('[OneCoreHandler] Revoke invite:', inviteId)
    
    try {
      await nodeOneCore.revokeInvite(inviteId)
      return {
        success: true
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to revoke invite:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Get Node instance status
   */
  async getNodeStatus(event) {
    const info = nodeOneCore.getInfo()
    return {
      success: true,
      ...info
    }
  },

  /**
   * Set Node instance configuration state
   */
  async setNodeState(event, { key, value }) {
    console.log(`[OneCoreHandler] Set Node state: ${key}`)
    
    try {
      await nodeOneCore.setState(key, value)
      return {
        success: true
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to set state:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Get Node instance configuration state
   */
  async getNodeState(event, { key }) {
    console.log(`[OneCoreHandler] Get Node state: ${key}`)
    
    try {
      const value = nodeOneCore.getState(key)
      return {
        success: true,
        value
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to get state:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Get Node instance full configuration
   */
  async getNodeConfig(event) {
    console.log('[OneCoreHandler] Get Node configuration')
    
    try {
      const info = nodeOneCore.getInfo()
      return {
        success: true,
        config: info.config || {}
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to get config:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Get contacts from Node.js ONE.core instance
   * This acts as our "CHUM sync" via IPC instead of WebSocket
   */
  async getContacts(event) {
    console.log('[OneCoreHandler] Getting contacts from Node.js ONE.core (IPC sync)')
    
    try {
      if (!nodeOneCore.initialized || !nodeOneCore.leuteModel) {
        return {
          success: false,
          error: 'Node.js ONE.core not initialized',
          contacts: []
        }
      }

      const contacts = []
      
      // Add the owner (self) first
      try {
        const me = await nodeOneCore.leuteModel.me()
        const myId = await me.mainIdentity()
        const myProfile = await me.mainProfile()
        
        let myName = nodeOneCore.instanceName || 'Node.js Owner'
        if (myProfile?.nickname) {
          myName = myProfile.nickname
        } else if (myProfile?.personDescriptions?.length > 0) {
          const nameDesc = myProfile.personDescriptions.find(d => 
            d.$type$ === 'PersonName' && d.name
          )
          if (nameDesc?.name) {
            myName = nameDesc.name
          }
        }
        
        contacts.push({
          id: myId,
          name: myName + ' (Owner)',
          displayName: myName + ' (Owner)',
          status: 'owner',
          lastSeen: new Date().toISOString()
        })
      } catch (error) {
        console.warn('[OneCoreHandler] Error getting owner info:', error)
      }
      
      // Get contacts from connections instead of LeuteModel.others()
      // because pairing connections don't automatically add to LeuteModel
      const connections = nodeOneCore.connectionsModel ? 
        nodeOneCore.connectionsModel.connectionsInfo() : []
      
      // Get unique person IDs from connections
      const contactPersonIds = new Set()
      for (const conn of connections) {
        if (conn.isConnected && conn.remotePersonId !== nodeOneCore.ownerId) {
          contactPersonIds.add(conn.remotePersonId)
        }
      }
      
      console.log(`[OneCoreHandler] Found ${contactPersonIds.size} connected contacts`)
      
      // Also check LeuteModel.others() for imported contacts
      const others = await nodeOneCore.leuteModel.others()
      console.log(`[OneCoreHandler] Found ${others.length} other contacts in LeuteModel`)
      
      // Add contacts from connections
      for (const personId of contactPersonIds) {
        try {
          // Find connection info for this person
          const conn = connections.find(c => c.remotePersonId === personId)
          
          contacts.push({
            id: `contact-${personId}`,
            personId: personId,
            name: `Contact ${personId.substring(0, 8)}`,
            email: `${personId.substring(0, 8)}@lama.network`,
            role: 'contact',
            platform: 'external',
            status: 'connected',
            isConnected: true,
            protocolName: conn?.protocolName || 'unknown',
            trusted: true,
            lastSeen: new Date().toISOString()
          })
        } catch (error) {
          console.warn('[OneCoreHandler] Error adding connection contact:', error)
        }
      }
      
      // Add contacts from LeuteModel (may have profiles)
      for (const someone of others) {
        try {
          const personId = await someone.mainIdentity()
          const profile = await someone.mainProfile()
          
          // Extract email - try multiple sources
          let email = null
          
          // First try to get it from the someone object directly (for imported contacts)
          if (someone.email) {
            email = someone.email
          }
          // Then try communicationEndpoints in profile
          else if (profile?.communicationEndpoints?.length > 0) {
            const emailEndpoint = profile.communicationEndpoints.find(e => 
              e.$type$ === 'Email' && e.email
            )
            if (emailEndpoint?.email) {
              email = emailEndpoint.email
            }
          }
          // Also check if there's a mainEmail method
          else if (typeof someone.mainEmail === 'function') {
            try {
              email = await someone.mainEmail()
            } catch (e) {
              // mainEmail might not exist or fail
            }
          }
          
          // Check if this is an AI contact
          const isAI = email && email.endsWith('@ai.local')
          
          let displayName = 'Unknown Contact'
          if (profile?.nickname) {
            displayName = profile.nickname
          } else if (profile?.personDescriptions?.length > 0) {
            const nameDesc = profile.personDescriptions.find(d => 
              d.$type$ === 'PersonName' && d.name
            )
            if (nameDesc?.name) {
              displayName = nameDesc.name
            }
          }
          
          // If still unknown and we have an email, try to extract name from it
          if (displayName === 'Unknown Contact' && email) {
            if (isAI) {
              // Extract model name from AI email
              const emailPrefix = email.split('@')[0]
              displayName = emailPrefix
                .replace(/lmstudio_/g, '')
                .replace(/ollama_/g, '')
                .replace(/claude_/g, '')
                .replace(/_/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')
              
              // Add provider suffix for clarity
              if (email.includes('lmstudio')) {
                displayName += ' (LM Studio)'
              } else if (email.includes('ollama')) {
                displayName += ' (Ollama)'
              }
            }
          }
          
          console.log(`[OneCoreHandler] Contact ${personId.substring(0, 8)}: name="${displayName}", email="${email}", isAI=${isAI}`)
          
          contacts.push({
            id: personId,
            name: displayName,
            displayName: displayName,
            email: email,
            isAI: isAI,
            status: isAI ? 'connected' : 'connected',
            lastSeen: new Date().toISOString()
          })
        } catch (error) {
          console.warn('[OneCoreHandler] Error processing contact:', error)
        }
      }
      
      console.log(`[OneCoreHandler] Found ${contacts.length} contacts in Node.js ONE.core`)
      
      return {
        success: true,
        contacts
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to get contacts:', error)
      return {
        success: false,
        error: error.message,
        contacts: []
      }
    }
  },

  /**
   * Test settings replication with credentials (for demonstration)
   */
  async testSettingsReplication(event, { category, data }) {
    console.log(`[OneCoreHandler] Testing settings replication: ${category}`)
    
    try {
      const result = await chumSettings.testSettingsValidation(category, data)
      
      return {
        success: true,
        testResult: result
      }
    } catch (error) {
      console.error('[OneCoreHandler] Settings replication test failed:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Sync connection settings to peers
   */
  async syncConnectionSettings(event, connectionSettings) {
    console.log('[OneCoreHandler] Syncing connection settings to peers')
    
    try {
      const settingsObject = await chumSettings.syncConnectionSettings(connectionSettings)
      
      return {
        success: true,
        settingsId: settingsObject.id,
        replicatedAt: settingsObject.timestamp
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to sync connection settings:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Get credentials status and trust information
   */
  async getCredentialsStatus(event) {
    console.log('[OneCoreHandler] Getting credentials status')
    
    try {
      const credentials = credentialsManager.getAllCredentials()
      
      return {
        success: true,
        ownCredentials: credentials.own.length,
        trustedIssuers: credentials.trusted.length,
        instanceId: credentialsManager.getOwnInstanceId()
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to get credentials status:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Get shared credentials for browser IoM setup
   */
  async getBrowserCredentials(event) {
    console.log('[OneCoreHandler] Getting credentials for browser IoM')
    
    try {
      const credentials = await nodeOneCore.getCredentialsForBrowser()
      return {
        success: true,
        ...credentials
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to get browser credentials:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default oneCoreHandlers