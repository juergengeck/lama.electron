/**
 * ONE.core IPC Handlers
 * Handle ONE.core initialization and IoM setup
 */

import nodeOneCore from '../../core/node-one-core.js';
import stateManager from '../../state/manager.js';
import chumSettings from '../../services/chum-settings.js';
import credentialsManager from '../../services/credentials-manager.js';
import type { IpcMainInvokeEvent } from 'electron';
import type { PersonDescriptionTypes } from '@refinio/one.models/lib/recipes/Leute/PersonDescriptions.js';
import type { CommunicationEndpointTypes } from '@refinio/one.models/lib/recipes/Leute/CommunicationEndpoints.js';

// Type guards for ONE.core recipe union types
function isPersonName(obj: PersonDescriptionTypes): obj is Extract<PersonDescriptionTypes, { $type$: 'PersonName' }> {
  return obj.$type$ === 'PersonName';
}

function isEmail(obj: CommunicationEndpointTypes): obj is Extract<CommunicationEndpointTypes, { $type$: 'Email' }> {
  return obj.$type$ === 'Email';
}

// Cache for contacts to prevent redundant calls during initialization
let contactsCache: any = null
let contactsCacheTime = 0
const CONTACTS_CACHE_TTL = 5000 // 5 seconds

interface UserCredentials {
  name: string;
  password: string;
}

interface InitializeNodeParams {
  user?: UserCredentials;
  name?: string;
  password?: string;
}

interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  [key: string]: any;
}

interface Contact {
  id: string;
  personId: string;
  someoneId?: string;
  name: string;
  displayName: string;
  email: string;
  isAI: boolean;
  role: string;
  platform: string;
  status: string;
  isConnected: boolean;
  trusted: boolean;
  lastSeen: string;
}

// Function to invalidate cache when contacts change
export function invalidateContactsCache(): void {
  contactsCache = null
  contactsCacheTime = 0
}

const oneCoreHandlers = {
  /**
   * Initialize Node.js ONE.core instance
   * This is called from the browser UI during setup
   */
  async initializeNode(event: IpcMainInvokeEvent, params: InitializeNodeParams): Promise<IpcResponse> {
    // Handle both formats: { name, password } and { user: { name, password } }
    const { name, password } = params.user || params;
    console.log('[OneCoreHandler] Initialize Node.js ONE.core instance:', name)

    try {
      // Use the nodeProvisioning module to handle initialization
      const { default: nodeProvisioning } = await import('../../services/node-provisioning.js')

      // Call the provision method with the user data
      const result = await nodeProvisioning.provision({
        user: { name, password }
      })

      return result
    } catch (error) {
      console.error('[OneCoreHandler] Failed to initialize Node:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  /**
   * Create local invite for browser connection
   */
  async createLocalInvite(event: IpcMainInvokeEvent, options: any = {}): Promise<IpcResponse> {
    console.log('[OneCoreHandler] Create local invite')

    try {
      const invite = await (nodeOneCore as any).createLocalInvite(options)
      return {
        success: true,
        invite
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to create local invite:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  /**
   * Create pairing invitation for browser instance
   */
  async createBrowserPairingInvite(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    console.log('[OneCoreHandler] Create browser pairing invitation')

    try {
      const invitation = await (nodeOneCore as any).createBrowserPairingInvite()
      return {
        success: true,
        invitation
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to create browser pairing invite:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  /**
   * Get stored browser pairing invitation
   */
  async getBrowserPairingInvite(event: IpcMainInvokeEvent): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  /**
   * Create network invite for remote connections
   */
  async createNetworkInvite(event: IpcMainInvokeEvent, options: any = {}): Promise<IpcResponse> {
    console.log('[OneCoreHandler] Create network invite')

    try {
      const invite = await (nodeOneCore as any).createNetworkInvite(options)
      return {
        success: true,
        invite
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to create network invite:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  /**
   * List all active invites
   */
  async listInvites(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    console.log('[OneCoreHandler] List invites')

    try {
      const invites = await (nodeOneCore as any).listInvites()
      return {
        success: true,
        invites
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to list invites:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  /**
   * Revoke an invite
   */
  async revokeInvite(event: IpcMainInvokeEvent, { inviteId }: { inviteId: string }): Promise<IpcResponse> {
    console.log('[OneCoreHandler] Revoke invite:', inviteId)

    try {
      await (nodeOneCore as any).revokeInvite(inviteId)
      return {
        success: true
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to revoke invite:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  /**
   * Get Node instance status
   */
  async getNodeStatus(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    const info = nodeOneCore.getInfo()
    return {
      success: true,
      ...info
    }
  },

  /**
   * Set Node instance configuration state
   */
  async setNodeState(event: IpcMainInvokeEvent, { key, value }: { key: string; value: any }): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  /**
   * Get Node instance configuration state
   */
  async getNodeState(event: IpcMainInvokeEvent, { key }: { key: string }): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  /**
   * Get Node instance full configuration
   */
  async getNodeConfig(event: IpcMainInvokeEvent): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  /**
   * Get contacts from Node.js ONE.core instance
   * This acts as our "CHUM sync" via IPC instead of WebSocket
   */
  async getContacts(event?: IpcMainInvokeEvent): Promise<IpcResponse<Contact[]>> {
    // Check cache first
    const now = Date.now()
    if (contactsCache && (now - contactsCacheTime) < CONTACTS_CACHE_TTL) {
      console.log('[OneCoreHandler] Returning cached contacts')
      return contactsCache
    }

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

      const contacts: Contact[] = []

      // Get owner ID for special handling below
      let myId: string | null = null
      try {
        const me = await nodeOneCore.leuteModel.me()
        myId = await me.mainIdentity()
      } catch (error) {
        console.warn('[OneCoreHandler] Error getting owner ID:', error)
      }

      // Get ALL contacts from LeuteModel.others() - this is the ONLY source of truth
      // Following one.leute pattern - no connection checking for contact list
      console.log('[OneCoreHandler] Step 1: Calling LeuteModel.others()...')
      const others = await nodeOneCore.leuteModel.others()
      console.log(`[OneCoreHandler] ✅ LeuteModel.others() returned ${others.length} contacts`)

      // Log each Someone object and check for duplicates
      const seenIds = new Map<string, number>()
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
        } catch (e: any) {
          console.log(`[OneCoreHandler]   Contact ${i + 1}: ERROR - ${e.message}`)
        }
      }

      // Track which personIds we've already processed to avoid duplicates
      const processedPersonIds = new Set<string>()

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
            console.log(`[OneCoreHandler] Skipping duplicate Someone for person ${String(personId).substring(0, 8)}...`)
            continue
          }
          processedPersonIds.add(personId)
          const profile = await someone.mainProfile()

          // Extract email - try multiple sources
          let email: string | null = null

          // First try to get it from the someone object directly (for imported contacts)
          if ((someone as any).email) {
            email = (someone as any).email
          }
          // Then try communicationEndpoints in profile
          else if (profile?.communicationEndpoints?.length > 0) {
            const emailEndpoint = profile.communicationEndpoints.find(isEmail)
            if (emailEndpoint && 'email' in emailEndpoint) {
              email = emailEndpoint.email
            }
          }
          // Also check if there's a mainEmail method
          else if (typeof (someone as any).mainEmail === 'function') {
            try {
              email = await (someone as any).mainEmail()
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
              console.log(`[OneCoreHandler] Checking ${String(personId).substring(0, 8)} against ${llmObjects.length} LLM objects`)
              for (const llm of llmObjects) {
                console.log(`[OneCoreHandler]   LLM personId: ${llm.personId?.toString().substring(0, 8)}...`)
              }
            }
          }
          // Fallback to email check if LLM check fails
          if (!isAI && email && email.endsWith('@ai.local')) {
            isAI = true
          }

          let displayName: string | null = null

          // Profile is a ProfileModel instance, need to access its properties correctly
          if (profile) {
            // Debug what type of object profile is
            if (isAI) {
              console.log(`[OneCoreHandler] AI Profile for ${String(personId).substring(0, 8)}: type=${typeof profile}, constructor=${profile?.constructor?.name}`)
              console.log(`[OneCoreHandler]   - nickname: ${(profile as any).nickname}`)
              console.log(`[OneCoreHandler]   - personDescriptions type: ${typeof profile.personDescriptions}`)
              if (profile.personDescriptions) {
                console.log(`[OneCoreHandler]   - personDescriptions isArray: ${Array.isArray(profile.personDescriptions)}`)
                console.log(`[OneCoreHandler]   - personDescriptions length: ${profile.personDescriptions?.length}`)
                if (profile.personDescriptions.length > 0) {
                  console.log(`[OneCoreHandler]   - personDescriptions[0]: ${JSON.stringify(profile.personDescriptions[0])}`)
                }
              }
            }

            // Try personDescriptions - this is an array on the ProfileModel
            if (profile.personDescriptions && Array.isArray(profile.personDescriptions)) {
              const nameDesc = profile.personDescriptions.find(isPersonName)
              if (nameDesc && 'name' in nameDesc) {
                displayName = nameDesc.name
                console.log(`[OneCoreHandler] Found PersonName for ${String(personId).substring(0, 8)}: ${displayName}`)
              }
            }
            // If personDescriptions is a method, call it
            else if (typeof profile.personDescriptions === 'function') {
              try {
                const personDescFunc = profile.personDescriptions as () => Promise<any>;
                const descriptions = await personDescFunc();
                const nameDesc = descriptions?.find((d: any) =>
                  d.$type$ === 'PersonName' && d.name
                )
                if (nameDesc?.name) {
                  displayName = nameDesc.name
                  console.log(`[OneCoreHandler] Found PersonName (via method) for ${String(personId).substring(0, 8)}: ${displayName}`)
                }
              } catch (e: any) {
                console.log('[OneCoreHandler] Could not get personDescriptions:', e.message)
              }
            }
          } else {
            console.log(`[OneCoreHandler] No profile found for ${String(personId).substring(0, 8)}`)
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
              displayName = `Contact ${String(personId).substring(0, 8)}`
            } else {
              displayName = 'Unknown Contact'
            }
          }

          // Check if this is the owner
          const isOwner = personId === myId
          if (isOwner) {
            displayName += ' (You)'
          }

          // Following one.leute pattern - don't check connection status for contacts
          // Contacts exist regardless of connection state

          contacts.push({
            id: personId, // Use Person ID as the contact ID for P2P channels
            personId: personId,
            someoneId: someone.idHash,
            name: displayName,
            displayName: displayName,
            email: email || `${String(personId).substring(0, 8)}@lama.network`,
            isAI: isAI,
            role: isOwner ? 'owner' : 'contact',
            platform: isAI ? 'ai' : (isOwner ? 'nodejs' : 'external'),
            status: isOwner ? 'owner' : 'offline',
            isConnected: isOwner ? true : false,
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
      console.log(`[OneCoreHandler] All contacts (including owner and AI) from LeuteModel.others()`)

      console.log('\n[OneCoreHandler] SUMMARY:')
      console.log(`[OneCoreHandler]   - Total from LeuteModel.others(): ${others.length}`)
      console.log(`[OneCoreHandler]   - After deduplication: ${contacts.length}`)
      console.log(`[OneCoreHandler]   - Owner: ${contacts.filter(c => c.role === 'owner').length}`)
      console.log(`[OneCoreHandler]   - AI contacts: ${contacts.filter(c => c.isAI).length}`)
      console.log(`[OneCoreHandler]   - Regular contacts: ${contacts.filter(c => !c.isAI && c.role !== 'owner').length}`)

      // Check for duplicate IDs in final contact list
      const finalIds = new Map<string, number>()
      contacts.forEach((contact, index) => {
        if (finalIds.has(contact.id)) {
          console.log(`[OneCoreHandler] ⚠️  DUPLICATE ID in final list: ${contact.id?.substring(0, 8)}... at index ${index} (first at ${finalIds.get(contact.id)})`)
        } else {
          finalIds.set(contact.id, index)
        }
      })

      console.log('='.repeat(60) + '\n')

      // Save to cache
      const result = {
        success: true,
        contacts
      }
      contactsCache = result
      contactsCacheTime = Date.now()

      return result
    } catch (error) {
      console.error('[OneCoreHandler] Failed to get contacts:', error)
      return {
        success: false,
        error: (error as Error).message,
        contacts: []
      }
    }
  },

  /**
   * Test settings replication with credentials (for demonstration)
   */
  async testSettingsReplication(event: IpcMainInvokeEvent, { category, data }: { category: string; data: any }): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  /**
   * Sync connection settings to peers
   */
  async syncConnectionSettings(event: IpcMainInvokeEvent, connectionSettings: any): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  /**
   * Get credentials status and trust information
   */
  async getCredentialsStatus(event: IpcMainInvokeEvent): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  /**
   * Get shared credentials for browser IoM setup
   */
  async getBrowserCredentials(event: IpcMainInvokeEvent): Promise<IpcResponse> {
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
        error: (error as Error).message
      }
    }
  },

  /**
   * Get list of connected peers
   */
  async getPeerList(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    console.log('[OneCoreHandler] Getting peer list')

    try {
      // For now, return the contacts list as peers
      // In the future, this could filter for only connected peers
      const result = await oneCoreHandlers.getContacts(event)

      if (result.success && result.contacts) {
        // Filter for connected/online peers if needed
        const peers: any[] = result.contacts.map((contact: Contact) => ({
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
        error: (error as Error).message,
        peers: []
      }
    }
  },

  /**
   * Store data securely using LLM objects
   * Claude API keys are stored as LLM objects with encryptedAuthToken
   */
  async secureStore(event: IpcMainInvokeEvent, { key, value, encrypted = true }: { key: string; value: any; encrypted?: boolean }): Promise<IpcResponse> {
    console.log(`[OneCoreHandler] Secure store: ${key} (encrypted: ${encrypted})`)
    console.log(`[OneCoreHandler] nodeOneCore initialized: ${nodeOneCore?.initialized}, channelManager: ${!!nodeOneCore?.channelManager}`)

    try {
      if (key === 'claude_api_key') {
        if (!nodeOneCore?.initialized || !nodeOneCore?.channelManager) {
          throw new Error('ONE.core not initialized')
        }

        console.log('[OneCoreHandler] Importing llm-config handler...')
        const { handleSetOllamaConfig } = await import('./llm-config.js')

        console.log('[OneCoreHandler] Calling handleSetOllamaConfig with Claude API key...')
        const result = await handleSetOllamaConfig(event, {
          modelType: 'remote',
          baseUrl: 'https://api.anthropic.com',
          authType: 'bearer',
          authToken: value,
          modelName: 'claude',
          setAsActive: true
        })

        console.log('[OneCoreHandler] handleSetOllamaConfig result:', result)

        if (!result.success) {
          throw new Error('error' in result ? result.error : 'Failed to store API key')
        }

        return {
          success: true,
          data: { stored: true, configHash: result.configHash }
        }
      }

      throw new Error(`Unsupported secure storage key: ${key}`)

    } catch (error) {
      console.error('[OneCoreHandler] secureStore error:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  /**
   * Retrieve data from LLM objects
   * Claude API keys are stored as LLM objects with encryptedAuthToken
   */
  async secureRetrieve(event: IpcMainInvokeEvent, { key }: { key: string }): Promise<IpcResponse> {
    console.log(`[OneCoreHandler] Secure retrieve: ${key}`)

    try {
      if (key === 'claude_api_key') {
        if (!nodeOneCore?.channelManager) {
          throw new Error('ONE.core not initialized')
        }

        const { decryptToken } = await import('../../services/ollama-config-manager.js')

        const iterator = nodeOneCore.channelManager.objectIteratorWithType('LLM', {
          channelId: 'lama'
        })

        for await (const llmObj of iterator) {
          if (llmObj?.data?.name === 'claude' && llmObj.data.active && !llmObj.data.deleted) {
            const encrypted = (llmObj.data as any).encryptedAuthToken
            if (encrypted) {
              const apiKey = decryptToken(encrypted)
              return { success: true, value: apiKey }
            }
          }
        }

        throw new Error('API key not found')
      }

      throw new Error(`Unsupported secure storage key: ${key}`)

    } catch (error) {
      console.error('[OneCoreHandler] secureRetrieve error:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  /**
   * Clear storage - delegate to app:clearData for consistency
   */
  async clearStorage(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    console.log('[OneCoreHandler] Clear storage request - delegating to app:clearData')

    try {
      // Import electron to access ipcMain
      const { ipcMain } = await import('electron')

      // Create a mock event object for the app:clearData handler
      const mockEvent = { sender: event.sender }

      // Call the existing app:clearData handler directly
      const { app } = await import('electron')
      const mainModule = await import('../../../lama-electron-shadcn.js')

      // Find and call the app:clearData handler
      const handler = ipcMain.listeners('app:clearData')?.[0] as any
      if (handler) {
        const result = await handler(mockEvent)
        return result
      } else {
        // Fallback: just clear browser storage
        const { session } = await import('electron')
        await session.defaultSession.clearStorageData({
          storages: ['indexdb', 'localstorage', 'cookies', 'cachestorage', 'websql']
        })
        await session.defaultSession.clearCache()

        return { success: true }
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to clear storage:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  /**
   * Restart Node.js ONE.core instance
   * Useful during development when UI reloads
   * Shuts down the instance - UI must re-initialize with credentials
   */
  async restartNode(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    console.log('[OneCoreHandler] Restarting Node.js ONE.core instance...')

    try {
      // Shutdown current instance
      if (nodeOneCore.initialized) {
        console.log('[OneCoreHandler] Shutting down current instance...')
        await nodeOneCore.shutdown()
      }

      console.log('[OneCoreHandler] Node.js instance shut down - UI must re-initialize')

      return {
        success: true,
        data: {
          message: 'Node instance shut down - please re-login'
        }
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to restart Node instance:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

export default oneCoreHandlers;