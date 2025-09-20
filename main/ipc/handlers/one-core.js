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
  async initializeNode(event, params) {
    // Handle both formats: { name, password } and { user: { name, password } }
    const { name, password } = params.user || params;
    console.log('[OneCoreHandler] Initialize Node.js ONE.core instance:', name)
    
    try {
      // Use the nodeProvisioning module to handle initialization
      const { default: nodeProvisioning } = await import('../../hybrid/node-provisioning.js')
      
      // Call the provision method with the user data
      const result = await nodeProvisioning.provision({
        user: { name, password }
      })
      
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
    console.log('\n' + '='.repeat(60))
    console.log('[OneCoreHandler] 📋 GETTING CONTACTS - START')
    console.log('='.repeat(60))
    
    try {
      if (!nodeOneCore.initialized || !nodeOneCore.leuteModel) {
        return {
          success: false,
          error: 'Node.js ONE.core not initialized',
          contacts: []
        }
      }

      const contacts = []

      // Add the owner (self) first - useful for editing own profile
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
          personId: myId,
          name: myName + ' (You)',
          displayName: myName + ' (You)',
          status: 'owner',
          lastSeen: new Date().toISOString()
        })
      } catch (error) {
        console.warn('[OneCoreHandler] Error getting owner info:', error)
      }
      
      // Get ALL contacts from LeuteModel.others() - this is the ONLY source of truth
      // Following one.leute pattern - no connection checking for contact list
      console.log('[OneCoreHandler] Step 1: Calling LeuteModel.others()...')
      const others = await nodeOneCore.leuteModel.others()
      console.log(`[OneCoreHandler] ✅ LeuteModel.others() returned ${others.length} contacts`)
      
      // Log each Someone object and check for duplicates
      const seenIds = new Map()
      for (let i = 0; i < others.length; i++) {
        try {
          // Use mainIdentity() not person() - Someone objects have mainIdentity
          const personId = await others[i].mainIdentity()
          const someoneId = others[i].idHash
          const personIdStr = personId?.substring(0, 8) || 'NO_ID'
          const someoneIdStr = someoneId?.substring(0, 8) || 'NO_HASH'
          
          // Check if we've seen this Person ID before
          if (personId && seenIds.has(personId)) {
            console.log(`[OneCoreHandler]   Contact ${i + 1}: Person=${personIdStr}, Someone=${someoneIdStr} - DUPLICATE Person! First seen at index ${seenIds.get(personId)}`)
          } else {
            console.log(`[OneCoreHandler]   Contact ${i + 1}: Person=${personIdStr}, Someone=${someoneIdStr}`)
            if (personId) seenIds.set(personId, i + 1)
          }
        } catch (e) {
          console.log(`[OneCoreHandler]   Contact ${i + 1}: ERROR - ${e.message}`)
        }
      }
      
      // Track which personIds we've already processed to avoid duplicates
      const processedPersonIds = new Set()
      
      // Add contacts from LeuteModel
      for (const someone of others) {
        try {
          const personId = await someone.mainIdentity()
          
          // Skip if no personId 
          if (!personId) {
            continue
          }
          
          // Skip if we've already processed this person (duplicate Someone object)
          if (processedPersonIds.has(personId)) {
            console.log(`[OneCoreHandler] Skipping duplicate Someone for person ${personId.substring(0, 8)}...`)
            continue
          }
          processedPersonIds.add(personId)
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
          
          // Check if this is an AI contact by checking LLM objects
          let isAI = false
          if (nodeOneCore.aiAssistantModel?.llmObjectManager) {
            isAI = nodeOneCore.aiAssistantModel.llmObjectManager.isLLMPerson(personId)
            if (!isAI) {
              // Debug: Check what's in the LLM objects
              const llmObjects = nodeOneCore.aiAssistantModel.llmObjectManager.getAllLLMObjects()
              console.log(`[OneCoreHandler] Checking ${personId.substring(0, 8)} against ${llmObjects.length} LLM objects`)
              for (const llm of llmObjects) {
                console.log(`[OneCoreHandler]   LLM personId: ${llm.personId?.toString().substring(0, 8)}...`)
              }
            }
          }
          // Fallback to email check if LLM check fails
          if (!isAI && email && email.endsWith('@ai.local')) {
            isAI = true
          }
          
          let displayName = null

          // Profile is a ProfileModel instance, need to access its properties correctly
          if (profile) {
            // Debug what type of object profile is
            if (isAI) {
              console.log(`[OneCoreHandler] AI Profile for ${personId.substring(0, 8)}: type=${typeof profile}, constructor=${profile?.constructor?.name}`)
              console.log(`[OneCoreHandler]   - nickname: ${profile.nickname}`)
              console.log(`[OneCoreHandler]   - personDescriptions type: ${typeof profile.personDescriptions}`)
              if (profile.personDescriptions) {
                console.log(`[OneCoreHandler]   - personDescriptions isArray: ${Array.isArray(profile.personDescriptions)}`)
                console.log(`[OneCoreHandler]   - personDescriptions length: ${profile.personDescriptions?.length}`)
                if (profile.personDescriptions.length > 0) {
                  console.log(`[OneCoreHandler]   - personDescriptions[0]: ${JSON.stringify(profile.personDescriptions[0])}`)
                }
              }
            }

            // Try nickname first
            if (typeof profile.nickname === 'string') {
              displayName = profile.nickname
            }
            // Then try personDescriptions - this is an array on the ProfileModel
            else if (profile.personDescriptions && Array.isArray(profile.personDescriptions)) {
              const nameDesc = profile.personDescriptions.find(d =>
                d.$type$ === 'PersonName' && d.name
              )
              if (nameDesc?.name) {
                displayName = nameDesc.name
                console.log(`[OneCoreHandler] Found PersonName for ${personId.substring(0, 8)}: ${displayName}`)
              }
            }
            // If personDescriptions is a method, call it
            else if (typeof profile.personDescriptions === 'function') {
              try {
                const descriptions = await profile.personDescriptions()
                const nameDesc = descriptions?.find(d =>
                  d.$type$ === 'PersonName' && d.name
                )
                if (nameDesc?.name) {
                  displayName = nameDesc.name
                  console.log(`[OneCoreHandler] Found PersonName (via method) for ${personId.substring(0, 8)}: ${displayName}`)
                }
              } catch (e) {
                console.log('[OneCoreHandler] Could not get personDescriptions:', e.message)
              }
            }
          } else {
            console.log(`[OneCoreHandler] No profile found for ${personId.substring(0, 8)}`)
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

          // If still no display name, use a better fallback
          if (!displayName) {
            // Try to get from Person object if available
            if (personId) {
              // Use first 8 chars of person ID as fallback
              displayName = `Contact ${personId.substring(0, 8)}`
            } else {
              displayName = 'Unknown Contact'
            }
          }

          // Following one.leute pattern - don't check connection status for contacts
          // Contacts exist regardless of connection state

          contacts.push({
            id: personId, // Use Person ID as the contact ID for P2P channels
            personId: personId,
            someoneId: someone.idHash,
            name: displayName,
            displayName: displayName,
            email: email || `${personId.substring(0, 8)}@lama.network`,
            isAI: isAI,
            role: 'contact',
            platform: isAI ? 'ai' : 'external',
            status: 'offline', // Connection status should be checked separately if needed
            isConnected: false, // Connection status should be checked separately if needed
            trusted: true,
            lastSeen: new Date().toISOString()
          })
        } catch (error) {
          console.warn('[OneCoreHandler] Error processing contact:', error)
        }
      }
      
      // AI contacts should already be in LeuteModel.others()
      // They are created as proper Person objects and added to contacts
      // No need to add them again - that would violate single source of truth
      console.log(`[OneCoreHandler] AI contacts are included in LeuteModel.others()`)
      
      console.log('\n[OneCoreHandler] SUMMARY:')
      console.log(`[OneCoreHandler]   - Owner: 1`)
      console.log(`[OneCoreHandler]   - From LeuteModel: ${others.length}`)
      console.log(`[OneCoreHandler]   - AI contacts: ${contacts.filter(c => c.isAI).length}`)
      console.log(`[OneCoreHandler]   - TOTAL: ${contacts.length}`)
      
      // Check for duplicate IDs in final contact list
      const finalIds = new Map()
      contacts.forEach((contact, index) => {
        if (finalIds.has(contact.id)) {
          console.log(`[OneCoreHandler] ⚠️  DUPLICATE ID in final list: ${contact.id.substring(0, 8)}... at index ${index} (first at ${finalIds.get(contact.id)})`)
        } else {
          finalIds.set(contact.id, index)
        }
      })
      
      console.log('='.repeat(60) + '\n')
      
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
  },

  /**
   * Get list of connected peers
   */
  async getPeerList(event) {
    console.log('[OneCoreHandler] Getting peer list')
    
    try {
      // For now, return the contacts list as peers
      // In the future, this could filter for only connected peers
      const result = await oneCoreHandlers.getContacts(event)
      
      if (result.success) {
        // Filter for connected/online peers if needed
        const peers = result.contacts.map(contact => ({
          id: contact.id,
          personId: contact.personId,
          name: contact.name,
          displayName: contact.displayName,
          email: contact.email,
          isAI: contact.isAI,
          status: contact.status || 'offline',
          isConnected: contact.isConnected || false
        }))
        
        return {
          success: true,
          peers
        }
      }
      
      return result
    } catch (error) {
      console.error('[OneCoreHandler] Failed to get peer list:', error)
      return {
        success: false,
        error: error.message,
        peers: []
      }
    }
  },

  /**
   * Store data securely in ONE.core's encrypted storage
   */
  async secureStore(event, { key, value, encrypted = true }) {
    console.log(`[OneCoreHandler] Secure store: ${key} (encrypted: ${encrypted})`)
    
    try {
      if (!nodeOneCore.initialized || !nodeOneCore.appModel) {
        throw new Error('ONE.core not initialized')
      }

      // Use ONE.core's secure storage via the SettingsObject
      const settingsObject = nodeOneCore.appModel.createSettingsObject({
        category: 'secure',
        type: 'credentials',
        encrypted
      })
      
      await settingsObject.set(key, value)
      await settingsObject.save()
      
      return {
        success: true
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to secure store:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  /**
   * Retrieve data from ONE.core's encrypted storage
   */
  async secureRetrieve(event, { key }) {
    console.log(`[OneCoreHandler] Secure retrieve: ${key}`)
    
    try {
      if (!nodeOneCore.initialized || !nodeOneCore.appModel) {
        throw new Error('ONE.core not initialized')
      }

      // Use ONE.core's secure storage via the SettingsObject
      const settingsObject = nodeOneCore.appModel.createSettingsObject({
        category: 'secure',
        type: 'credentials',
        encrypted: true
      })
      
      await settingsObject.load()
      const value = settingsObject.get(key)
      
      return {
        success: true,
        value
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to secure retrieve:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

export default oneCoreHandlers