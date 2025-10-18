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
import { storeVersionedObject } from '@refinio/one.core/lib/storage-versioned-objects.js';
import { getObjectByIdHash } from '@refinio/one.core/lib/storage-versioned-objects.js';
import type { AvatarPreference } from '@OneObjectInterfaces';

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
  color: string;
}

// Generate deterministic avatar color from person ID
function generateAvatarColor(personId: string): string {
  // Predefined set of vibrant, distinguishable colors
  const colors = [
    '#ef4444', // red
    '#f97316', // orange
    '#f59e0b', // amber
    '#84cc16', // lime
    '#10b981', // emerald
    '#14b8a6', // teal
    '#06b6d4', // cyan
    '#3b82f6', // blue
    '#6366f1', // indigo
    '#8b5cf6', // violet
    '#a855f7', // purple
    '#ec4899', // pink
    '#f43f5e', // rose
  ];

  // Simple hash function for deterministic color selection
  let hash = 0;
  for (let i = 0; i < personId.length; i++) {
    hash = ((hash << 5) - hash) + personId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }

  return colors[Math.abs(hash) % colors.length];
}

// Map mood to color
function getMoodColor(mood: string): string {
  const moodColors: Record<string, string> = {
    'happy': '#f59e0b',    // amber - warm, cheerful
    'sad': '#3b82f6',      // blue - calm, melancholic
    'angry': '#ef4444',    // red - intense, heated
    'calm': '#14b8a6',     // teal - peaceful, balanced
    'excited': '#ec4899',  // pink - energetic, vibrant
    'tired': '#8b5cf6',    // violet - muted, subdued
    'focused': '#10b981',  // emerald - sharp, concentrated
    'neutral': '#6366f1'   // indigo - balanced, default
  };

  return moodColors[mood] || moodColors['neutral'];
}

// Get or create avatar preference for a person
async function getAvatarColor(personId: string): Promise<string> {
  try {
    // Try to retrieve existing preference
    const result = await getObjectByIdHash<AvatarPreference>(personId as any);
    if (result && result.obj) {
      const pref = result.obj;
      // If mood is set, use mood-based color
      if (pref.mood) {
        return getMoodColor(pref.mood);
      }
      // Otherwise use stored color
      if (pref.color) {
        return pref.color;
      }
    }
  } catch (e) {
    // Preference doesn't exist, will create one
  }

  // Generate and store new preference
  const color = generateAvatarColor(personId);
  const preference: AvatarPreference = {
    $type$: 'AvatarPreference',
    personId,
    color,
    updatedAt: Date.now()
  };

  try {
    await storeVersionedObject(preference);
  } catch (e) {
    console.warn('[OneCoreHandler] Failed to store avatar preference:', e);
  }

  return color;
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

          // Profile is a ProfileModel instance - use ONE.core API (descriptionsOfType)
          if (profile) {
            // Use ProfileModel.descriptionsOfType() - the ONE.core way
            try {
              const personNames = profile.descriptionsOfType('PersonName')
              if (personNames && personNames.length > 0) {
                displayName = personNames[0].name
                console.log(`[OneCoreHandler] Found PersonName for ${String(personId).substring(0, 8)}: ${displayName}`)
              } else {
                console.log(`[OneCoreHandler] No PersonName found in profile for ${String(personId).substring(0, 8)}`)
              }
            } catch (e: any) {
              console.log(`[OneCoreHandler] Error getting PersonName for ${String(personId).substring(0, 8)}: ${e.message}`)
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

          // Get persistent avatar color
          const color = await getAvatarColor(personId);

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
            lastSeen: new Date().toISOString(),
            color
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
   * Clear storage - calls shared clearAppDataShared function
   */
  async clearStorage(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    console.log('[OneCoreHandler] Clear storage request - calling clearAppDataShared')

    try {
      // Import and call the shared function directly
      const { clearAppDataShared } = await import('../../../lama-electron-shadcn.js')

      const result = await clearAppDataShared()

      console.log('[OneCoreHandler] clearAppDataShared result:', result)
      return result
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
  },

  /**
   * Update user's mood (updates avatar color accordingly)
   */
  async updateMood(event: IpcMainInvokeEvent, { mood }: { mood: string }): Promise<IpcResponse> {
    console.log(`[OneCoreHandler] Update mood: ${mood}`)

    try {
      if (!nodeOneCore.initialized || !nodeOneCore.leuteModel) {
        return {
          success: false,
          error: 'Node.js ONE.core not initialized'
        }
      }

      // Get current user's person ID
      const me = await nodeOneCore.leuteModel.me()
      const personId = await me.mainIdentity()

      if (!personId) {
        return {
          success: false,
          error: 'Could not get user person ID'
        }
      }

      // Get existing preference or create new one
      let preference: AvatarPreference | null = null;
      try {
        const result = await getObjectByIdHash<AvatarPreference>(personId as any);
        if (result && result.obj) {
          preference = result.obj;
        }
      } catch (e) {
        // Preference doesn't exist
      }

      // Create updated preference
      const updatedPref: AvatarPreference = {
        $type$: 'AvatarPreference',
        personId,
        color: preference?.color || generateAvatarColor(personId),
        mood: mood as any,
        updatedAt: Date.now()
      };

      // Store updated preference
      await storeVersionedObject(updatedPref);

      // Invalidate contacts cache so mood change reflects immediately
      invalidateContactsCache();

      return {
        success: true,
        data: {
          mood,
          color: getMoodColor(mood)
        }
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to update mood:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  /**
   * Check if the current user has a PersonName set in their profile
   */
  async hasPersonName(event: IpcMainInvokeEvent): Promise<IpcResponse> {
    console.log('[OneCoreHandler] Checking if user has PersonName')

    try {
      if (!nodeOneCore.initialized || !nodeOneCore.leuteModel) {
        return {
          success: false,
          error: 'Node.js ONE.core not initialized'
        }
      }

      // Get current user
      const me = await nodeOneCore.leuteModel.me()
      const profile = await me.mainProfile()

      if (!profile) {
        return {
          success: true,
          hasName: false
        }
      }

      // Check for PersonName in profile descriptions
      try {
        const personNames = profile.descriptionsOfType('PersonName')
        const hasName = personNames && personNames.length > 0 && personNames[0].name

        return {
          success: true,
          hasName: !!hasName,
          name: hasName ? personNames[0].name : null
        }
      } catch (e) {
        return {
          success: true,
          hasName: false
        }
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to check PersonName:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  },

  /**
   * Set PersonName for the current user's profile
   */
  async setPersonName(event: IpcMainInvokeEvent, { name }: { name: string }): Promise<IpcResponse> {
    console.log('[OneCoreHandler] Setting PersonName:', name)

    try {
      if (!nodeOneCore.initialized || !nodeOneCore.leuteModel) {
        return {
          success: false,
          error: 'Node.js ONE.core not initialized'
        }
      }

      if (!name || name.trim().length === 0) {
        return {
          success: false,
          error: 'Name cannot be empty'
        }
      }

      // Get current user
      const me = await nodeOneCore.leuteModel.me()
      const personId = await me.mainIdentity()

      if (!personId) {
        return {
          success: false,
          error: 'Could not get user person ID'
        }
      }

      // Get or create profile
      let profile = await me.mainProfile()

      if (!profile) {
        // Create new profile
        const { default: ProfileModel } = await import('@refinio/one.models/lib/models/Leute/ProfileModel.js')
        profile = await ProfileModel.constructWithNewProfile(personId, personId, 'default')
        console.log('[OneCoreHandler] Created new profile for user')
      }

      // Create PersonName description
      const personName = {
        $type$: 'PersonName' as const,
        name: name.trim()
      }

      // Remove existing PersonName if present
      if (profile.personDescriptions) {
        profile.personDescriptions = profile.personDescriptions.filter(
          (desc: any) => desc.$type$ !== 'PersonName'
        )
      } else {
        profile.personDescriptions = []
      }

      // Add new PersonName
      profile.personDescriptions.push(personName)

      // Save profile
      await profile.saveAndLoad()

      console.log('[OneCoreHandler] PersonName set successfully:', name)

      // Invalidate contacts cache
      invalidateContactsCache()

      return {
        success: true,
        data: {
          name: name.trim()
        }
      }
    } catch (error) {
      console.error('[OneCoreHandler] Failed to set PersonName:', error)
      return {
        success: false,
        error: (error as Error).message
      }
    }
  }
}

export default oneCoreHandlers;