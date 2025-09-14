/**
 * Contact management IPC handlers
 */

import { ipcMain } from 'electron'

export function registerContactHandlers(nodeOneCore) {
  // Get all contacts with trust status
  ipcMain.handle('contacts:list-with-trust', async () => {
    try {
      if (!nodeOneCore.leuteModel) {
        return { success: false, error: 'Leute model not initialized' }
      }
      
      const contacts = await nodeOneCore.leuteModel.getSomeoneElseList()
      
      // Enhance with trust information
      const contactsWithTrust = await Promise.all(contacts.map(async (contact) => {
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
      return { success: false, error: error.message }
    }
  })
  
  // Get all contacts
  ipcMain.handle('contacts:list', async () => {
    try {
      if (!nodeOneCore.leuteModel) {
        return { success: false, error: 'Leute model not initialized' }
      }
      
      const contacts = await nodeOneCore.leuteModel.getSomeoneElseList()
      return { success: true, contacts }
    } catch (error) {
      console.error('[IPC] Failed to get contacts:', error)
      return { success: false, error: error.message }
    }
  })
  
  // Get pending contacts for review
  ipcMain.handle('contacts:pending:list', async () => {
    try {
      if (!nodeOneCore.quicTransport?.contactManager) {
        return { success: true, pendingContacts: [] }
      }
      
      const pendingContacts = nodeOneCore.quicTransport.contactManager.getPendingContacts()
      return { success: true, pendingContacts }
    } catch (error) {
      console.error('[IPC] Failed to get pending contacts:', error)
      return { success: false, error: error.message }
    }
  })
  
  // Get specific pending contact details
  ipcMain.handle('contacts:pending:get', async (event, pendingId) => {
    try {
      if (!nodeOneCore.quicTransport?.contactManager) {
        return { success: false, error: 'Contact manager not initialized' }
      }
      
      const pendingContact = nodeOneCore.quicTransport.contactManager.getPendingContact(pendingId)
      if (!pendingContact) {
        return { success: false, error: 'Pending contact not found' }
      }
      
      return { success: true, pendingContact }
    } catch (error) {
      console.error('[IPC] Failed to get pending contact:', error)
      return { success: false, error: error.message }
    }
  })
  
  // Accept a contact (update trust level)
  ipcMain.handle('contacts:accept', async (event, personId, options = {}) => {
    try {
      if (!nodeOneCore.quicTransport?.trustManager) {
        return { success: false, error: 'Trust manager not initialized' }
      }
      
      const result = await nodeOneCore.quicTransport.trustManager.acceptContact(personId, options)
      return result
    } catch (error) {
      console.error('[IPC] Failed to accept contact:', error)
      return { success: false, error: error.message }
    }
  })
  
  // Block a contact
  ipcMain.handle('contacts:block', async (event, personId, reason) => {
    try {
      if (!nodeOneCore.quicTransport?.trustManager) {
        return { success: false, error: 'Trust manager not initialized' }
      }
      
      const result = await nodeOneCore.quicTransport.trustManager.blockContact(personId, reason)
      return result
    } catch (error) {
      console.error('[IPC] Failed to block contact:', error)
      return { success: false, error: error.message }
    }
  })
  
  // Legacy: Accept a pending contact (for backward compatibility)
  ipcMain.handle('contacts:pending:accept', async (event, pendingId, options = {}) => {
    try {
      // This is now handled through trust manager
      return { success: false, error: 'Use contacts:accept instead' }
    } catch (error) {
      console.error('[IPC] Failed to accept contact:', error)
      return { success: false, error: error.message }
    }
  })
  
  // Reject a pending contact
  ipcMain.handle('contacts:pending:reject', async (event, pendingId, reason) => {
    try {
      if (!nodeOneCore.quicTransport?.contactManager) {
        return { success: false, error: 'Contact manager not initialized' }
      }
      
      const result = await nodeOneCore.quicTransport.contactManager.rejectContact(pendingId, reason)
      return result
    } catch (error) {
      console.error('[IPC] Failed to reject contact:', error)
      return { success: false, error: error.message }
    }
  })
  
  // Add contact
  ipcMain.handle('contacts:add', async (event, personInfo) => {
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
      
      const personHash = await storeVersionedObject(person)
      
      // Create Someone object and add to contacts
      const { SomeoneModel } = await import('@refinio/one.models/lib/models/Leute/SomeoneModel.js')
      const someone = await SomeoneModel.constructWithNewSomeone(person)
      
      await nodeOneCore.leuteModel.addSomeoneElse(someone.idHash)
      
      return { 
        success: true, 
        contact: {
          personHash,
          someoneHash: someone.idHash,
          person
        }
      }
    } catch (error) {
      console.error('[IPC] Failed to add contact:', error)
      return { success: false, error: error.message }
    }
  })
  
  // Remove contact
  ipcMain.handle('contacts:remove', async (event, contactId) => {
    try {
      if (!nodeOneCore.leuteModel) {
        return { success: false, error: 'Leute model not initialized' }
      }
      
      await nodeOneCore.leuteModel.removeSomeoneElse(contactId)
      return { success: true }
    } catch (error) {
      console.error('[IPC] Failed to remove contact:', error)
      return { success: false, error: error.message }
    }
  })
  
  // Revoke contact's VC
  ipcMain.handle('contacts:revoke', async (event, personId) => {
    try {
      if (!nodeOneCore.quicTransport?.contactManager) {
        return { success: false, error: 'Contact manager not initialized' }
      }
      
      await nodeOneCore.quicTransport.contactManager.revokeContactVC(personId)
      return { success: true }
    } catch (error) {
      console.error('[IPC] Failed to revoke contact VC:', error)
      return { success: false, error: error.message }
    }
  })
  
  // Listen for pending contact events and forward to renderer
  if (nodeOneCore.quicTransport?.contactManager) {
    nodeOneCore.quicTransport.contactManager.on('pending-contact', (data) => {
      // Send to all windows
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('contacts:pending:new', data)
      })
    })
    
    nodeOneCore.quicTransport.contactManager.on('contact-accepted', (data) => {
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('contacts:accepted', data)
      })
    })
    
    nodeOneCore.quicTransport.contactManager.on('dedicated-vc-received', (data) => {
      const { BrowserWindow } = require('electron')
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('contacts:vc:received', data)
      })
    })
  }
}