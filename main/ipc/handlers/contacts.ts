/**
 * Contact management IPC handlers
 */

import electron from 'electron'
const { ipcMain } = electron
import nodeOneCore from '../../core/node-one-core.js'
import type { IpcMainInvokeEvent } from 'electron';

interface ContactWithTrust {
  trustLevel: string;
  isConnected: boolean;
  canMessage: boolean;
  canSync: boolean;
  discoverySource: string;
  discoveredAt: number;
  [key: string]: any;
}

interface Contact {
  id: string;
  personId: string;
  name: string;
  isAI: boolean;
  modelId?: string;
  canMessage: boolean;
  isConnected: boolean;
}

interface PersonInfo {
  name: string;
  email: string;
}

interface IpcResponse<T = any> {
  success: boolean;
  error?: string;
  contacts?: T[];
  pendingContacts?: any[];
  pendingContact?: any;
  contact?: any;
}

export function registerContactHandlers() {
  // Get all contacts with trust status
  ipcMain.handle('contacts:list-with-trust', async (): Promise<IpcResponse<ContactWithTrust>> => {
    try {
      if (!nodeOneCore.leuteModel) {
        return { success: false, error: 'Leute model not initialized' }
      }

      const contacts = await nodeOneCore.leuteModel.others()

      // Enhance with trust information
      const contactsWithTrust: any[] = await Promise.all(contacts.map(async (contact: any): Promise<ContactWithTrust> => {
        // Get trust level from trust manager
        const trustLevel = await nodeOneCore.quicTransport?.trustManager?.getContactTrustLevel(contact.personId) || 'unknown'

        // Check if connected via QUIC
        const isConnected = nodeOneCore.quicTransport?.peers?.has(contact.personId) || false

        // Check communication permissions
        const canMessage = await nodeOneCore.quicTransport?.trustManager?.canCommunicateWith(contact.personId, 'message') || false
        const canSync = await nodeOneCore.quicTransport?.trustManager?.canCommunicateWith(contact.personId, 'sync') || false

        return {
          ...contact,
          trustLevel,
          isConnected,
          canMessage,
          canSync,
          discoverySource: 'quic-vc-discovery', // TODO: Get actual source from VC
          discoveredAt: Date.now() - Math.random() * 86400000 // TODO: Get actual timestamp
        }
      }))

      return { success: true, contacts: contactsWithTrust }
    } catch (error) {
      console.error('[IPC] Failed to get contacts with trust:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Get all contacts
  ipcMain.handle('contacts:list', async (): Promise<IpcResponse<Contact>> => {
    try {
      if (!nodeOneCore.leuteModel) {
        return { success: false, error: 'Leute model not initialized' }
      }

      // Get human contacts - these are Someone objects that need to be transformed
      const someoneObjects = await nodeOneCore.leuteModel.others()
      const allContacts: Contact[] = []

      // Track processed Person IDs to skip duplicates
      const processedPersonIds = new Set<string>()

      // Transform Someone objects to plain serializable objects
      for (const someone of someoneObjects) {
        try {
          const personId = await someone.mainIdentity()
          if (!personId) continue

          // Skip if we've already processed this Person (duplicate Someone object)
          if (processedPersonIds.has(personId)) {
            continue
          }
          processedPersonIds.add(personId)

          // Get profile to extract display name from PersonName
          const profile = await someone.mainProfile()
          let displayName: string | null = null

          if (profile?.personDescriptions && Array.isArray(profile.personDescriptions)) {
            const nameDesc = profile.personDescriptions.find((d: any) => d.$type$ === 'PersonName')
            if (nameDesc && 'name' in nameDesc) {
              displayName = nameDesc.name
            }
          }

          // If no PersonName found, throw error - don't use fallbacks
          if (!displayName) {
            throw new Error(`No PersonName found for contact ${String(personId).substring(0, 8)}`)
          }

          // Check if this is an AI contact
          let isAI = false
          let modelId: string | undefined
          if (nodeOneCore.aiAssistantModel?.llmObjectManager) {
            isAI = nodeOneCore.aiAssistantModel.llmObjectManager.isLLMPerson(personId)

            // If this is an AI, get the model ID
            if (isAI && nodeOneCore.aiAssistantModel) {
              modelId = nodeOneCore.aiAssistantModel.getModelIdForPersonId(personId)
            }
          }

          allContacts.push({
            id: personId,
            personId: personId,
            name: displayName,
            isAI: isAI,
            modelId: modelId, // Include the model ID for AI contacts
            canMessage: true,
            isConnected: isAI // AI is always "connected"
          })
        } catch (err: any) {
          console.error('[contacts:list] Error processing someone:', err)
        }
      }

      return { success: true, contacts: allContacts }
    } catch (error) {
      console.error('[IPC] Failed to get contacts:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Get pending contacts for review
  ipcMain.handle('contacts:pending:list', async (): Promise<IpcResponse> => {
    try {
      if (!nodeOneCore.quicTransport?.leuteModel) {
        return { success: true, pendingContacts: [] }
      }

      const pendingContacts = nodeOneCore.quicTransport.leuteModel.getPendingContacts()
      return { success: true, pendingContacts }
    } catch (error) {
      console.error('[IPC] Failed to get pending contacts:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Get specific pending contact details
  ipcMain.handle('contacts:pending:get', async (event: IpcMainInvokeEvent, pendingId: string): Promise<IpcResponse> => {
    try {
      if (!nodeOneCore.quicTransport?.leuteModel) {
        return { success: false, error: 'Contact manager not initialized' }
      }

      const pendingContact = nodeOneCore.quicTransport.leuteModel.getPendingContact(pendingId)
      if (!pendingContact) {
        return { success: false, error: 'Pending contact not found' }
      }

      return { success: true, pendingContact }
    } catch (error) {
      console.error('[IPC] Failed to get pending contact:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Accept a contact (update trust level)
  ipcMain.handle('contacts:accept', async (event: IpcMainInvokeEvent, personId: string, options: any = {}): Promise<IpcResponse> => {
    try {
      if (!nodeOneCore.quicTransport?.trustManager) {
        return { success: false, error: 'Trust manager not initialized' }
      }

      const result = await nodeOneCore.quicTransport.trustManager.acceptContact(personId, options)
      return result
    } catch (error) {
      console.error('[IPC] Failed to accept contact:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Block a contact
  ipcMain.handle('contacts:block', async (event: IpcMainInvokeEvent, personId: string, reason: string): Promise<IpcResponse> => {
    try {
      if (!nodeOneCore.quicTransport?.trustManager) {
        return { success: false, error: 'Trust manager not initialized' }
      }

      const result = await nodeOneCore.quicTransport.trustManager.blockContact(personId, reason)
      return result
    } catch (error) {
      console.error('[IPC] Failed to block contact:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Legacy: Accept a pending contact (for backward compatibility)
  ipcMain.handle('contacts:pending:accept', async (event: IpcMainInvokeEvent, pendingId: string, options: any = {}): Promise<IpcResponse> => {
    try {
      // This is now handled through trust manager
      return { success: false, error: 'Use contacts:accept instead' }
    } catch (error) {
      console.error('[IPC] Failed to accept contact:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Reject a pending contact
  ipcMain.handle('contacts:pending:reject', async (event: IpcMainInvokeEvent, pendingId: string, reason: string): Promise<IpcResponse> => {
    try {
      if (!nodeOneCore.quicTransport?.leuteModel) {
        return { success: false, error: 'Contact manager not initialized' }
      }

      const result = await nodeOneCore.quicTransport.leuteModel.rejectContact(pendingId, reason)
      return result
    } catch (error) {
      console.error('[IPC] Failed to reject contact:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Add contact
  ipcMain.handle('contacts:add', async (event: IpcMainInvokeEvent, personInfo: PersonInfo): Promise<IpcResponse> => {
    try {
      if (!nodeOneCore.leuteModel) {
        return { success: false, error: 'Leute model not initialized' }
      }

      // Create Person object
      const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js')
      const person = {
        $type$: 'Person',
        name: personInfo.name,
        email: personInfo.email
      }

      const personResult = await storeVersionedObject(person as any)

      // Create Someone object and add to contacts
      const { default: SomeoneModel } = await import('@refinio/one.models/lib/models/Leute/SomeoneModel.js')
      // constructWithNewSomeone expects (idHash: string, obj: Person)
      const someone = await SomeoneModel.constructWithNewSomeone(personResult.idHash, person as any)

      await nodeOneCore.leuteModel.addSomeoneElse(someone.idHash)

      return {
        success: true,
        contact: {
          personHash: personResult.idHash,
          someoneHash: someone.idHash,
          person
        }
      }
    } catch (error) {
      console.error('[IPC] Failed to add contact:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Remove contact
  ipcMain.handle('contacts:remove', async (event: IpcMainInvokeEvent, contactId: string): Promise<IpcResponse> => {
    try {
      if (!nodeOneCore.leuteModel) {
        return { success: false, error: 'Leute model not initialized' }
      }

      // removeSomeoneElse expects SHA256IdHash<Someone>
      // contactId is already a string which is what SHA256IdHash is at runtime
      await nodeOneCore.leuteModel.removeSomeoneElse(contactId as any)
      return { success: true }
    } catch (error) {
      console.error('[IPC] Failed to remove contact:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Revoke contact's VC
  ipcMain.handle('contacts:revoke', async (event: IpcMainInvokeEvent, personId: string): Promise<IpcResponse> => {
    try {
      if (!nodeOneCore.quicTransport?.leuteModel) {
        return { success: false, error: 'Contact manager not initialized' }
      }

      await nodeOneCore.quicTransport.leuteModel.revokeContactVC(personId)
      return { success: true }
    } catch (error) {
      console.error('[IPC] Failed to revoke contact VC:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // Listen for pending contact events and forward to renderer
  if (nodeOneCore.quicTransport?.leuteModel) {
    nodeOneCore.quicTransport.leuteModel.on('pending-contact', (data: any) => {
      // Send to all windows
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach((window: any) => {
        window.webContents.send('contacts:pending:new', data)
      })
    })

    nodeOneCore.quicTransport.leuteModel.on('contact-accepted', (data: any) => {
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach((window: any) => {
        window.webContents.send('contacts:accepted', data)
      })
    })

    nodeOneCore.quicTransport.leuteModel.on('dedicated-vc-received', (data: any) => {
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach((window: any) => {
        window.webContents.send('contacts:vc:received', data)
      })
    })
  }
}