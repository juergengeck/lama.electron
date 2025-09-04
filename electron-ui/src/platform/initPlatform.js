/**
 * Platform initialization for Electron environment
 * Based on one.leute web initialization pattern
 */
// CRITICAL: Load browser platform modules first
import '@refinio/one.core/lib/system/load-browser.js';
// Load browser-specific crypto and storage implementations
import '@refinio/one.core/lib/system/browser/crypto-helpers.js';
import '@refinio/one.core/lib/system/browser/crypto-scrypt.js';
import '@refinio/one.core/lib/system/browser/settings-store.js';
import '@refinio/one.core/lib/system/browser/storage-base.js';
import '@refinio/one.core/lib/system/browser/storage-base-delete-file.js';
import '@refinio/one.core/lib/system/browser/storage-streams.js';
// Initialize storage directory for Electron
import { setBaseDirOrName } from '@refinio/one.core/lib/system/storage-base.js';
import { initInstance, closeInstance, getInstanceOwnerIdHash } from '@refinio/one.core/lib/instance.js';
import { SettingsStore } from '@refinio/one.core/lib/system/settings-store.js';
import { createRandomString } from '@refinio/one.core/lib/system/crypto-helpers.js';
// Import recipes for ONE platform
import RecipesStable from '@refinio/one.models/lib/recipes/recipes-stable.js';
import RecipesExperimental from '@refinio/one.models/lib/recipes/recipes-experimental.js';
import { ReverseMapsForIdObjectsStable, ReverseMapsStable } from '@refinio/one.models/lib/recipes/reversemaps-stable.js';
import { ReverseMapsExperimental, ReverseMapsForIdObjectsExperimental } from '@refinio/one.models/lib/recipes/reversemaps-experimental.js';
// Certificate recipes needed for authentication
import '@refinio/one.models/lib/recipes/Certificates/AffirmationCertificate.js';
import '@refinio/one.models/lib/recipes/Certificates/TrustKeysCertificate.js';
import '@refinio/one.models/lib/recipes/Certificates/RightToDeclareTrustedKeysForEverybodyCertificate.js';
import '@refinio/one.models/lib/recipes/Certificates/RightToDeclareTrustedKeysForSelfCertificate.js';
/**
 * Initialize the ONE platform for Electron
 * This must be called before any ONE.core functions are used
 */
export async function initializePlatform(config) {
    console.log('[Platform] Starting platform initialization...');
    // Set the storage directory
    setBaseDirOrName(config.directory);
    console.log('[Platform] Storage directory set to:', config.directory);
    // Check if instance already exists
    const storedInstanceName = await SettingsStore.getItem('instance');
    const storedEmail = await SettingsStore.getItem('email');
    console.log('[Platform] Stored instance:', storedInstanceName, 'email:', storedEmail);
    let instanceOptions;
    // In Electron, get credentials from Node.js for IoM sync
    if (window.electronAPI) {
        try {
            console.log('[Platform] Getting credentials from Node.js for IoM sync...');
            const nodeCredentials = await window.electronAPI.invoke('oneCore:getBrowserCredentials');
            if (nodeCredentials?.success && nodeCredentials.email) {
                // Use same person (email/secret) but different instance name for IoM
                instanceOptions = {
                    name: nodeCredentials.browserInstanceName || 'browser',
                    email: nodeCredentials.email,
                    secret: config.secret // Same secret as Node.js
                };
                console.log('[Platform] Using Node.js credentials for IoM - same person, different instance');
                console.log('[Platform] Email:', instanceOptions.email);
                console.log('[Platform] Instance name:', instanceOptions.name);
            }
            else {
                throw new Error('Could not get credentials from Node.js');
            }
        }
        catch (error) {
            console.warn('[Platform] Failed to get Node.js credentials:', error);
            // Fall back to stored or new credentials
            if (storedInstanceName && storedEmail) {
                instanceOptions = {
                    name: storedInstanceName,
                    email: storedEmail,
                    secret: config.secret
                };
            }
            else {
                instanceOptions = {
                    name: config.instanceName || `electron-${await createRandomString(32)}`,
                    email: config.email || `electron@${await createRandomString(32)}.com`,
                    secret: config.secret
                };
            }
        }
    }
    else if (storedInstanceName && storedEmail) {
        // Use existing instance (non-Electron)
        instanceOptions = {
            name: storedInstanceName,
            email: storedEmail,
            secret: config.secret
        };
        console.log('[Platform] Using existing instance:', instanceOptions.name);
    }
    else {
        // Create new instance (non-Electron)
        instanceOptions = {
            name: config.instanceName || `electron-${await createRandomString(32)}`,
            email: config.email || `electron@${await createRandomString(32)}.com`,
            secret: config.secret
        };
        console.log('[Platform] Creating new instance:', instanceOptions.name);
    }
    try {
        // Initialize the ONE.core instance
        await initInstance({
            ...instanceOptions,
            directory: config.directory,
            initialRecipes: [...RecipesStable, ...RecipesExperimental],
            initiallyEnabledReverseMapTypes: new Map([
                ...ReverseMapsStable,
                ...ReverseMapsExperimental
            ]),
            initiallyEnabledReverseMapTypesForIdObjects: new Map([
                ...ReverseMapsForIdObjectsStable,
                ...ReverseMapsForIdObjectsExperimental
            ])
        });
        console.log('[Platform] Instance initialized successfully');
        // Store instance info if new
        if (!storedInstanceName || !storedEmail) {
            await SettingsStore.setItem('instance', instanceOptions.name);
            await SettingsStore.setItem('email', instanceOptions.email);
            console.log('[Platform] Instance info stored');
        }
        // Get instance owner ID for verification
        const ownerIdHash = getInstanceOwnerIdHash();
        console.log('[Platform] Instance owner ID hash:', ownerIdHash);
    }
    catch (error) {
        console.error('[Platform] Failed to initialize instance:', error);
        if (error.code === 'CYENC-SYMDEC') {
            throw new Error('Invalid password');
        }
        throw error;
    }
}
/**
 * Check if platform is initialized
 */
export async function isPlatformInitialized() {
    try {
        const ownerIdHash = getInstanceOwnerIdHash();
        return !!ownerIdHash;
    }
    catch {
        return false;
    }
}
/**
 * Shutdown the platform
 */
export function shutdownPlatform() {
    console.log('[Platform] Shutting down platform...');
    closeInstance();
}
console.log('[Platform] Platform initialization module loaded');
