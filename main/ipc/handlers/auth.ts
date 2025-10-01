/**
 * Authentication IPC Handlers (TypeScript)
 */

import { IpcMainInvokeEvent } from 'electron';
import type { LoginCredentials, UserInfo, ProvisionResult } from '../../types/ipc.js';
import authModel from '../../models/auth.js';
import stateManager from '../../state/manager.js';

interface RegisterCredentials extends LoginCredentials {
  email?: string;
}

interface AuthResult {
  success: boolean;
  user?: UserInfo;
  error?: string;
}

const authHandlers = {
  async login(event: IpcMainInvokeEvent, credentials: LoginCredentials): Promise<AuthResult> {
    const { username, password } = credentials;
    console.log(`[AuthHandler] Login request for: ${username}`);

    const result: any = await authModel.login(username, password);

    if (result.success) {
      // Notify renderer of successful login
      event.sender.send('auth:loginSuccess', result.user);
    }

    return result;
  },

  async register(event: IpcMainInvokeEvent, credentials: RegisterCredentials): Promise<AuthResult> {
    const { username, password, email } = credentials;
    console.log(`[AuthHandler] Register request for: ${username}`);

    const result: any = await authModel.register(username, password, email);

    if (result.success) {
      // Notify renderer of successful registration
      event.sender.send('auth:registerSuccess', result.user);
    }

    return result;
  },

  async logout(event: IpcMainInvokeEvent): Promise<AuthResult> {
    console.log('[AuthHandler] Logout request');

    const result: any = await authModel.logout();

    if (result.success) {
      // Notify renderer of logout
      event.sender.send('auth:logoutSuccess');
    }

    return result;
  },

  async checkAuth(event: IpcMainInvokeEvent): Promise<AuthResult> {
    console.log('[AuthHandler] Check auth status');

    const result: any = await authModel.checkAuth();

    return result;
  }
};

export default authHandlers;