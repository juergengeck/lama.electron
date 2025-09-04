/**
 * LAMA Electron Initialization
 *
 * This file now serves as a bridge to the main process where ONE.CORE runs.
 * All ONE.CORE operations happen via IPC.
 */
import AppModelSingleton from '../models/AppModelSingleton';
import { ipcClient } from '../services/one-core-client';
// Configuration
const APP_CONFIG = {
    name: 'LAMA-Desktop',
    version: '1.0.0'
};
// Global instances
let authInstance;
let isLoggedIn = false;
let platformInitialized = false;
let userCredentials = null;
// We don't need appModel variable anymore - using singleton
/**
 * Initialize platform via IPC to main process
 */
export async function initializePlatform() {
    if (platformInitialized) {
        console.log('[Init] Platform already initialized');
        return;
    }
    console.log('[Init] Initializing platform via IPC...');
    try {
        // Initialize ONE.CORE in the main process
        const result = await ipcClient.action('init');
        if (result) {
            platformInitialized = true;
            console.log('[Init] Platform initialized in main process');
        }
        else {
            console.warn('[Init] Running in browser mode - platform not available');
            platformInitialized = true; // Mark as initialized anyway for browser mode
        }
    }
    catch (error) {
        console.error('[Init] Platform initialization failed:', error);
        // Don't throw - allow app to run without ONE.CORE
        platformInitialized = true;
    }
}
/**
 * Create authenticator instance using REAL ONE.CORE
 */
export async function createInstance() {
    if (authInstance) {
        console.log('[Init] Auth instance already exists');
        return authInstance;
    }
    try {
        // Ensure platform is initialized
        if (!platformInitialized) {
            await initializePlatform();
        }
        // Use the REAL browser instance with ONE.CORE
        const { realBrowserInstance } = await import('../services/real-browser-instance');
        // Initialize the real browser instance if not already done
        if (!realBrowserInstance.isInitialized()) {
            console.log('[Init] Initializing REAL browser instance...');
            await realBrowserInstance.initialize();
        }
        // Create authenticator wrapper around real instance
        authInstance = {
            isLoggedIn: () => isLoggedIn,
            login: async (username, password) => {
                console.log('[Init] REAL login:', username);
                const result = await realBrowserInstance.login(username, password);
                isLoggedIn = true;
                authInstance.ownerId = result.person?.id || username;
                return { success: true, userId: authInstance.ownerId };
            },
            logout: async () => {
                console.log('[Init] REAL logout');
                isLoggedIn = false;
                authInstance.ownerId = null;
            },
            register: async (username, password) => {
                console.log('[Init] REAL register:', username);
                const result = await realBrowserInstance.createUser(username, password);
                authInstance.ownerId = result.person?.id || username;
                return { success: true, userId: authInstance.ownerId };
            },
            ownerId: null,
            getOwnerId: () => authInstance.ownerId
        };
        console.log('[Init] Created REAL ONE.CORE authenticator');
        return authInstance;
    }
    catch (error) {
        console.error('[Init] Failed to create authenticator:', error);
        throw error;
    }
}
/**
 * Login with credentials
 */
export async function login(username, password) {
    console.log('[Init] Attempting login for:', username);
    if (!authInstance) {
        await createInstance();
    }
    try {
        const result = await authInstance.login(username, password);
        if (result.success) {
            isLoggedIn = true;
            userCredentials = { username, password }; // Store credentials for Node.js provisioning
            console.log('[Init] Login successful');
            return true;
        }
        else {
            console.error('[Init] Login failed:', result.error);
            return false;
        }
    }
    catch (error) {
        console.error('[Init] Login error:', error);
        return false;
    }
}
/**
 * Register new user
 */
export async function register(username, password) {
    console.log('[Init] Attempting registration for:', username);
    if (!authInstance) {
        await createInstance();
    }
    try {
        const result = await authInstance.register(username, password);
        if (result.success) {
            userCredentials = { username, password }; // Store credentials for Node.js provisioning
            console.log('[Init] Registration successful');
            return true;
        }
        else {
            console.error('[Init] Registration failed:', result.error);
            return false;
        }
    }
    catch (error) {
        console.error('[Init] Registration error:', error);
        return false;
    }
}
/**
 * Login or register (tries login first, then register if that fails)
 */
export async function loginOrRegister(username, password) {
    console.log('[Init] Attempting login or register for:', username);
    // Try login first
    const loginSuccess = await login(username, password);
    if (loginSuccess) {
        return true;
    }
    // If login failed, try registration
    console.log('[Init] Login failed, attempting registration');
    const registerSuccess = await register(username, password);
    if (registerSuccess) {
        // After successful registration, try to login
        return await login(username, password);
    }
    return false;
}
/**
 * Check if user is logged in
 */
export function checkIsLoggedIn() {
    return isLoggedIn;
}
/**
 * Get app model instance
 */
export async function getAppModel() {
    if (!AppModelSingleton.isInitialized()) {
        return undefined;
    }
    const ownerId = await getOwnerId();
    try {
        return await AppModelSingleton.getInstance(ownerId);
    }
    catch (error) {
        console.error('[Init] Failed to get AppModel:', error);
        return undefined;
    }
}
/**
 * Initialize app model
 */
/**
 * Get owner ID from available sources
 */
async function getOwnerId() {
    // Try auth instance first
    let ownerId = authInstance?.ownerId || authInstance?.getOwnerId?.();
    // If no owner ID from auth instance, try to get from ONE.CORE
    if (!ownerId || ownerId === 'default-owner') {
        try {
            const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js');
            const coreOwnerId = getInstanceOwnerIdHash();
            if (coreOwnerId) {
                ownerId = coreOwnerId;
                console.log('[Init] Using ONE.CORE owner ID:', ownerId);
            }
        }
        catch (error) {
            console.warn('[Init] Could not get ONE.CORE owner ID:', error);
        }
    }
    // Don't use fallback - throw error if no valid owner ID
    if (!ownerId || ownerId === 'default-owner') {
        throw new Error('No valid owner ID available. User must be authenticated first.');
    }
    return ownerId;
}
/**
 * Initialize app model
 */
export async function initializeAppModel() {
    // Ensure user is logged in before initializing models
    if (!isLoggedIn || !authInstance) {
        throw new Error('Cannot initialize AppModel without authenticated user');
    }
    // Provision Node.js instance if in Electron
    if (window.electronAPI && userCredentials) {
        console.log('[Init] Provisioning Node.js instance...');
        try {
            const result = await window.electronAPI.invoke('provision:node', {
                user: {
                    id: await getOwnerId(),
                    name: userCredentials.username,
                    password: userCredentials.password
                },
                config: {
                    storageRole: 'archive',
                    capabilities: ['network', 'storage']
                }
            });
            console.log('[Init] Node.js provisioning result:', result);
        }
        catch (error) {
            console.error('[Init] Failed to provision Node.js instance:', error);
            // Continue anyway - Node.js provisioning is not critical for basic UI
        }
    }
    const ownerId = await getOwnerId();
    return AppModelSingleton.getInstance(ownerId);
}
/**
 * Initialize model (alias for initializeAppModel)
 */
export async function initModel() {
    return initializeAppModel();
}
// Main initialization object (for compatibility with existing code)
export const lamaInit = {
    createInstance,
    login,
    register,
    loginOrRegister,
    checkIsLoggedIn,
    getAppModel,
    initializeAppModel,
    initModel
};
// Export for compatibility
export default lamaInit;
