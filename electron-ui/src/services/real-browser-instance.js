/**
 * REAL Browser ONE.CORE Instance Implementation
 * No localStorage bullshit - actual ONE.CORE
 */
import MultiUser from '@refinio/one.models/lib/models/Authenticator/MultiUser.js';
import RecipesStable from '@refinio/one.models/lib/recipes/recipes-stable.js';
import RecipesExperimental from '@refinio/one.models/lib/recipes/recipes-experimental.js';
import { ReverseMapsStable } from '@refinio/one.models/lib/recipes/reversemaps-stable.js';
import { ReverseMapsExperimental } from '@refinio/one.models/lib/recipes/reversemaps-experimental.js';
// Settings recipe removed - will be handled differently
export class RealBrowserInstance {
    constructor() {
        Object.defineProperty(this, "multiUser", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "leuteModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "connectionsModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        }); // ConnectionsModel for IoM
        Object.defineProperty(this, "initialized", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "ownerId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "browserSettings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "iomSettings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    async initialize() {
        if (this.initialized) {
            console.log('[RealBrowser] Already initialized');
            return;
        }
        // Mark as initializing to prevent double initialization from React StrictMode
        if (this.initializing) {
            console.log('[RealBrowser] Already initializing, waiting...');
            // Wait for the other initialization to complete
            while (this.initializing && !this.initialized) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            return;
        }
        this.initializing = true;
        console.log('[RealBrowser] Initializing REAL ONE.CORE...');
        try {
            // Wait for platform to be loaded
            let attempts = 0;
            while (!window.ONE_CORE_PLATFORM_LOADED && attempts < 10) {
                console.log('[RealBrowser] Waiting for platform loader...');
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            if (!window.ONE_CORE_PLATFORM_LOADED) {
                throw new Error('Platform failed to load');
            }
            // Create MultiUser instance with all necessary recipes
            console.log('[RealBrowser] Creating MultiUser instance with recipes...');
            this.multiUser = new MultiUser({
                directory: 'lama-browser-data',
                recipes: [
                    ...RecipesStable,
                    ...RecipesExperimental
                    // Settings will be handled differently, not as a Recipe
                ],
                reverseMaps: new Map([
                    ...ReverseMapsStable,
                    ...ReverseMapsExperimental
                ])
            });
            // Set up event handlers for authentication state changes
            await this.attachAuthHandlers();
            console.log('[RealBrowser] MultiUser instance created with event handlers');
            // Mark as initialized
            this.initialized = true;
            this.initializing = false;
            console.log('[RealBrowser] ✅ REAL ONE.CORE initialized!');
        }
        catch (error) {
            console.error('[RealBrowser] Failed to initialize:', error);
            this.initializing = false;
            throw error;
        }
    }
    async attachAuthHandlers() {
        if (!this.multiUser) {
            throw new Error('MultiUser not initialized');
        }
        console.log('[RealBrowser] Attaching authentication event handlers...');
        // Listen for login events (including session restoration)
        this.multiUser.onLogin.listen(async (instanceName, secret) => {
            console.log('[RealBrowser] onLogin event fired for:', instanceName);
            // Prevent duplicate initialization
            if (this.ownerId) {
                console.log('[RealBrowser] Already initialized, skipping');
                return;
            }
            try {
                // Get the instance owner ID
                const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js');
                const ownerId = getInstanceOwnerIdHash();
                if (ownerId) {
                    console.log('[RealBrowser] Login successful, owner:', ownerId);
                    this.ownerId = ownerId;
                    await this.completeInitializationAfterAuth();
                }
                else {
                    console.warn('[RealBrowser] Login event fired but no owner ID found');
                }
            }
            catch (error) {
                console.error('[RealBrowser] Error handling login event:', error);
            }
        });
        // Listen for logout events
        this.multiUser.onLogout.listen(async () => {
            console.log('[RealBrowser] onLogout event fired');
            // Clear our state
            this.ownerId = null;
            this.leuteModel = null;
            this.browserSettings = null;
            this.iomSettings = null;
        });
        // Listen for auth state changes
        if (this.multiUser.authState && this.multiUser.authState.onStateChange) {
            this.multiUser.authState.onStateChange.listen((oldState, newState) => {
                console.log('[RealBrowser] Auth state change:', oldState, '->', newState);
            });
        }
        console.log('[RealBrowser] Authentication event handlers attached');
    }
    async initializeSettings() {
        try {
            const { default: PropertyTreeStore } = await import('@refinio/one.models/lib/models/SettingsModel.js');
            // Create browser-specific settings store
            this.browserSettings = new PropertyTreeStore(`browser-settings-${this.ownerId || 'default'}`);
            await this.browserSettings.init();
            // Set default browser settings
            await this.browserSettings.setValue('instance.type', 'browser');
            await this.browserSettings.setValue('instance.id', `browser-${this.ownerId || Date.now()}`);
            await this.browserSettings.setValue('theme', 'dark');
            await this.browserSettings.setValue('language', 'en');
            await this.browserSettings.setValue('notifications', 'true');
            await this.browserSettings.setValue('storage.role', 'cache');
            // Create shared IoM settings store
            this.iomSettings = new PropertyTreeStore('iom-shared-settings');
            await this.iomSettings.init();
            // Set shared IoM settings
            await this.iomSettings.setValue('iom.browser.connected', 'true');
            await this.iomSettings.setValue('iom.browser.lastUpdate', new Date().toISOString());
            console.log('[RealBrowser] Settings stores initialized');
        }
        catch (error) {
            console.error('[RealBrowser] Failed to initialize settings:', error);
            throw error;
        }
    }
    async initializeModels() {
        try {
            const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js');
            const ownerId = getInstanceOwnerIdHash();
            if (ownerId) {
                console.log('[RealBrowser] Instance has owner:', ownerId);
                // Check if MultiUser has a LeuteModel we can use
                if (this.multiUser && this.multiUser.leuteModel) {
                    console.log('[RealBrowser] Using LeuteModel from MultiUser');
                    this.leuteModel = this.multiUser.leuteModel;
                }
                else {
                    console.log('[RealBrowser] Creating new LeuteModel...');
                    const { default: LeuteModelClass } = await import('@refinio/one.models/lib/models/Leute/LeuteModel.js');
                    this.leuteModel = new LeuteModelClass();
                    await this.leuteModel.init();
                }
                console.log('[RealBrowser] ✅ LeuteModel initialized!');
                // Set up ConnectionsModel for local IoM with Node.js
                if (window.electronAPI) {
                    await this.setupLocalIoMConnection();
                }
                // Store the owner ID for later use
                this.ownerId = ownerId;
            }
            else {
                console.log('[RealBrowser] No instance owner, models not initialized');
            }
        }
        catch (error) {
            console.error('[RealBrowser] Failed to initialize models:', error);
            throw error;
        }
    }
    async createObject(obj) {
        if (!this.initialized) {
            throw new Error('Instance not initialized');
        }
        if (!this.ownerId) {
            throw new Error('User not authenticated');
        }
        // Use ONE.core storage functions directly after initialization
        const { storeVersionedObject } = await import('@refinio/one.core/lib/storage-versioned-objects.js');
        return await storeVersionedObject(obj);
    }
    async getObjects(query) {
        if (!this.initialized) {
            throw new Error('Instance not initialized');
        }
        if (!this.ownerId) {
            throw new Error('User not authenticated');
        }
        // For Person queries, return empty array for now
        // TODO: Implement proper person queries with LeuteModel
        if (query.type === 'Person') {
            return [];
        }
        // Otherwise use direct storage query
        const { getObjectsByType } = await import('@refinio/one.core/lib/storage-unversioned-objects.js');
        return await getObjectsByType(query.type);
    }
    async createUser(username, password) {
        console.log('[RealBrowser] Creating/registering user:', username);
        if (!this.multiUser) {
            throw new Error('MultiUser not initialized');
        }
        const email = `${username}@lama.local`;
        const instanceName = `lama-${username}`;
        // If already logged in, we need to logout first before registering a new user
        if (this.ownerId) {
            console.log('[RealBrowser] Already logged in, logging out first...');
            try {
                await this.multiUser.logout();
                // Clear our state
                this.ownerId = null;
                this.leuteModel = null;
                this.browserSettings = null;
                this.iomSettings = null;
            }
            catch (error) {
                console.warn('[RealBrowser] Logout failed:', error);
            }
        }
        try {
            // Register new user with MultiUser
            await this.multiUser.register(email, password, instanceName);
            console.log('[RealBrowser] User registered successfully');
            // Complete initialization after successful registration
            await this.completeInitializationAfterAuth();
            // Return user info with owner ID (consistent format for both browser and node)
            return {
                id: this.ownerId,
                name: username,
                email: email,
                person: {
                    id: this.ownerId,
                    email
                }
            };
        }
        catch (error) {
            console.error('[RealBrowser] Failed to register user:', error);
            throw error;
        }
    }
    async completeInitializationAfterAuth() {
        console.log('[RealBrowser] Completing initialization after authentication...');
        // Ensure all recipes are in the runtime
        console.log('[RealBrowser] Ensuring all recipes are in global runtime...');
        const { addRecipeToRuntime, hasRecipe } = await import('@refinio/one.core/lib/object-recipes.js');
        for (const recipe of [...RecipesStable, ...RecipesExperimental]) {
            if (!hasRecipe(recipe.name)) {
                addRecipeToRuntime(recipe);
            }
        }
        console.log('[RealBrowser] All recipes added to runtime');
        // Get the instance owner ID
        const { getInstanceOwnerIdHash } = await import('@refinio/one.core/lib/instance.js');
        this.ownerId = getInstanceOwnerIdHash();
        console.log('[RealBrowser] Instance owner ID:', this.ownerId);
        // Initialize models
        await this.initializeModels();
        // Initialize Settings stores
        await this.initializeSettings();
        console.log('[RealBrowser] Post-auth initialization complete');
    }
    async login(username, password) {
        console.log('[RealBrowser] Logging in:', username);
        if (!this.multiUser) {
            throw new Error('MultiUser not initialized');
        }
        const email = `${username}@lama.local`;
        const instanceName = `lama-${username}`;
        try {
            // Use loginOrRegister - it handles both new and existing users
            await this.multiUser.loginOrRegister(email, password, instanceName);
            console.log('[RealBrowser] LoginOrRegister completed');
            // Wait for the onLogin event handler to complete initialization
            // The event handler will set this.ownerId
            let attempts = 0;
            while (!this.ownerId && attempts < 20) {
                await new Promise(resolve => setTimeout(resolve, 50));
                attempts++;
            }
            if (!this.ownerId) {
                throw new Error('Login succeeded but initialization did not complete');
            }
            // Return user info with owner ID
            return {
                id: this.ownerId,
                name: username,
                email: email,
                person: {
                    id: this.ownerId,
                    email
                }
            };
        }
        catch (error) {
            console.error('[RealBrowser] Failed to login:', error);
            throw error;
        }
    }
    async setState(path, value) {
        if (!this.browserSettings) {
            console.warn('[RealBrowser] Cannot set state - settings not initialized');
            return;
        }
        // Use the Settings datatype we already have
        await this.browserSettings.setValue(path, JSON.stringify(value));
    }
    async getState(path) {
        if (!this.browserSettings) {
            return undefined;
        }
        // Get from Settings datatype
        const value = this.browserSettings.getValue(path);
        if (value) {
            try {
                return JSON.parse(value);
            }
            catch {
                return value;
            }
        }
        return undefined;
    }
    getLeuteModel() {
        return this.leuteModel;
    }
    async setupLocalIoMConnection() {
        try {
            console.log('[RealBrowser] Setting up ConnectionsModel for local IoM with Node.js...');
            const { default: ConnectionsModel } = await import('@refinio/one.models/lib/models/ConnectionsModel.js');
            const { default: GroupModel } = await import('@refinio/one.models/lib/models/Leute/GroupModel.js');
            // Create or get blacklist group
            let blacklistGroup;
            try {
                blacklistGroup = await GroupModel.constructFromLatestProfileVersionByGroupName('blacklist');
            }
            catch {
                blacklistGroup = await this.leuteModel.createGroup('blacklist');
            }
            // Create ConnectionsModel that connects to local Node.js WebSocket
            this.connectionsModel = new ConnectionsModel(this.leuteModel, {
                localWebSocketUrl: 'ws://localhost:8765', // Connect to Node's local WebSocket
                acceptIncomingConnections: true,
                acceptUnknownInstances: true, // Accept Node instance (same person)
                acceptUnknownPersons: false, // Only accept same person (IoM)
                allowPairing: false, // No external pairing from browser
                establishOutgoingConnections: true,
                allowDebugRequests: true,
                noImport: false,
                noExport: false
            });
            // Initialize ConnectionsModel
            await this.connectionsModel.init(blacklistGroup);
            console.log('[RealBrowser] ✅ ConnectionsModel initialized - connecting to Node.js at ws://localhost:8765');
            // CHUM sync will happen automatically through ConnectionsModel
        }
        catch (error) {
            console.error('[RealBrowser] Failed to set up local IoM connection:', error);
            // Continue without IoM - browser can still work independently
        }
    }
    async shutdown() {
        if (this.multiUser) {
            try {
                await this.multiUser.logout();
            }
            catch (error) {
                console.warn('[RealBrowser] Error during logout:', error);
            }
            this.multiUser = null;
        }
        if (this.leuteModel) {
            // LeuteModel doesn't have shutdown, just clear the reference
            this.leuteModel = null;
        }
        this.initialized = false;
    }
    isInitialized() {
        return this.initialized;
    }
    getOwnerId() {
        return this.ownerId;
    }
    async checkAuth() {
        if (this.multiUser && this.multiUser.authState && this.multiUser.authState.currentState === 'logged_in') {
            const userState = await this.getState('identity.user');
            return {
                authenticated: true,
                user: userState || { id: this.ownerId, name: 'User' }
            };
        }
        return { authenticated: false };
    }
    async logout() {
        console.log('[RealBrowser] Logging out...');
        if (this.multiUser) {
            try {
                await this.multiUser.logout();
            }
            catch (error) {
                console.warn('[RealBrowser] MultiUser logout failed:', error);
            }
        }
        // Clear our state
        this.ownerId = null;
        this.leuteModel = null;
        this.browserSettings = null;
        this.iomSettings = null;
        console.log('[RealBrowser] Logout complete');
    }
    async updateNodeConnectionStatus(connected) {
        if (this.iomSettings) {
            await this.iomSettings.setValue('iom.node.connected', connected ? 'true' : 'false');
            await this.iomSettings.setValue('iom.node.lastUpdate', new Date().toISOString());
        }
    }
    async setSetting(key, value) {
        if (!this.browserSettings) {
            throw new Error('Settings not initialized');
        }
        await this.browserSettings.setValue(key, String(value));
        // If it's an IoM-related setting, also update the shared settings
        if (key.startsWith('iom.')) {
            if (this.iomSettings) {
                await this.iomSettings.setValue(key, String(value));
            }
        }
    }
    async getSetting(key) {
        if (!this.browserSettings) {
            return undefined;
        }
        const value = this.browserSettings.getValue(key);
        return value || undefined;
    }
    getBrowserSettings() {
        return this.browserSettings;
    }
    getIoMSettings() {
        return this.iomSettings;
    }
    async getOrCreateAIPersonId(aiName) {
        // For AI assistants, create deterministic Person IDs based on their name
        // This ensures consistent IDs across sessions
        if (!this.leuteModel) {
            // If no LeuteModel, generate a deterministic hash for the AI
            const { createHash } = await import('crypto');
            const hash = createHash('sha256').update(`ai-${aiName}`).digest('hex');
            return hash;
        }
        try {
            // Try to find existing AI person
            const persons = await this.leuteModel.getPersons();
            const aiPerson = persons.find(p => p.email === `${aiName}@ai.lama`);
            if (aiPerson) {
                return aiPerson.id;
            }
            // Create new AI person identity
            const personId = await this.leuteModel.createNewIdentity(`${aiName}@ai.lama`);
            console.log(`[RealBrowser] Created AI person for ${aiName}:`, personId);
            return personId;
        }
        catch (error) {
            console.error('[RealBrowser] Failed to create AI person:', error);
            // Fallback to deterministic hash
            const { createHash } = await import('crypto');
            const hash = createHash('sha256').update(`ai-${aiName}`).digest('hex');
            return hash;
        }
    }
}
// Export singleton
export const realBrowserInstance = new RealBrowserInstance();
