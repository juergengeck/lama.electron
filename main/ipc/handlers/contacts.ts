/**
 * Contact Management IPC Handlers (Thin Adapter)
 *
 * Maps Electron IPC calls to ContactsHandler methods.
 * Business logic lives in ../../../lama.core/handlers/ContactsHandler.ts
 */

import electron from 'electron';
const { ipcMain, BrowserWindow } = electron;
import nodeOneCore from '../../core/node-one-core.js';
import { ContactsHandler } from '@chat/core/handlers/ContactsHandler.js';
import type { IpcMainInvokeEvent } from 'electron';

// Create handler instance with Electron-specific dependencies
const contactsHandler = new ContactsHandler(nodeOneCore);

interface PersonInfo {
  name: string;
  email: string;
}

/**
 * Register contact management IPC handlers
 */
export function registerContactHandlers() {
  // Get all contacts with trust status
  ipcMain.handle('contacts:list-with-trust', async (): Promise<any> => {
    return await contactsHandler.getContactsWithTrust();
  });

  // Get all contacts
  ipcMain.handle('contacts:list', async (): Promise<any> => {
    return await contactsHandler.getContacts();
  });

  // Get pending contacts for review
  ipcMain.handle('contacts:pending:list', async (): Promise<any> => {
    return await contactsHandler.getPendingContacts();
  });

  // Get specific pending contact details
  ipcMain.handle('contacts:pending:get', async (event: IpcMainInvokeEvent, pendingId: string): Promise<any> => {
    return await contactsHandler.getPendingContact(pendingId);
  });

  // Accept a contact (update trust level)
  ipcMain.handle('contacts:accept', async (event: IpcMainInvokeEvent, personId: string, options: any = {}): Promise<any> => {
    return await contactsHandler.acceptContact(personId, options);
  });

  // Block a contact
  ipcMain.handle('contacts:block', async (event: IpcMainInvokeEvent, personId: string, reason: string): Promise<any> => {
    return await contactsHandler.blockContact(personId, reason);
  });

  // Legacy: Accept a pending contact (for backward compatibility)
  ipcMain.handle('contacts:pending:accept', async (event: IpcMainInvokeEvent, pendingId: string, options: any = {}): Promise<any> => {
    // This is now handled through trust manager
    return { success: false, error: 'Use contacts:accept instead' };
  });

  // Reject a pending contact
  ipcMain.handle('contacts:pending:reject', async (event: IpcMainInvokeEvent, pendingId: string, reason: string): Promise<any> => {
    return await contactsHandler.rejectContact(pendingId, reason);
  });

  // Add contact
  ipcMain.handle('contacts:add', async (event: IpcMainInvokeEvent, personInfo: PersonInfo): Promise<any> => {
    return await contactsHandler.addContact(personInfo);
  });

  // Remove contact
  ipcMain.handle('contacts:remove', async (event: IpcMainInvokeEvent, contactId: string): Promise<any> => {
    return await contactsHandler.removeContact(contactId);
  });

  // Revoke contact's VC
  ipcMain.handle('contacts:revoke', async (event: IpcMainInvokeEvent, personId: string): Promise<any> => {
    return await contactsHandler.revokeContactVC(personId);
  });

  // Listen for pending contact events and forward to renderer (Electron-specific)
  if (nodeOneCore.quicTransport?.leuteModel) {
    nodeOneCore.quicTransport.leuteModel.on('pending-contact', (data: any) => {
      // Send to all windows
      BrowserWindow.getAllWindows().forEach((window: any) => {
        window.webContents.send('contacts:pending:new', data);
      });
    });

    nodeOneCore.quicTransport.leuteModel.on('contact-accepted', (data: any) => {
      BrowserWindow.getAllWindows().forEach((window: any) => {
        window.webContents.send('contacts:accepted', data);
      });
    });

    nodeOneCore.quicTransport.leuteModel.on('dedicated-vc-received', (data: any) => {
      BrowserWindow.getAllWindows().forEach((window: any) => {
        window.webContents.send('contacts:vc:received', data);
      });
    });
  }
}
