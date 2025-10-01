/**
 * CHUM Settings Helper
 * Creates Settings objects with verifiable credentials for CHUM sync
 */
import credentialsManager from './credentials-manager.js';
import nodeOneCore from '../core/node-one-core.js';
class ChumSettingsHelper {
    /**
     * Create a Settings object for CHUM sync with embedded credentials
     */
    async createSettingsObject(category, data, authority = 'DEVICE_ADMIN') {
        // Create credential for this settings update
        const credential = await credentialsManager.createSettingsCredential({
            instanceId: credentialsManager.getOwnInstanceId(),
            name: this.getInstanceName(),
            platform: 'nodejs'
        }, authority, [`settings.${category}`]);
        // Create the Settings object for CHUM sync
        const settingsObject = {
            $type$: 'Settings',
            id: `settings-${category}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            category: category,
            data: data,
            credential: credential,
            timestamp: new Date().toISOString(),
            schemaVersion: '1.0.0',
            sourceInstance: credentialsManager.getOwnInstanceId()
        };
        console.log(`[ChumSettings] Created Settings object for category: ${category}`);
        return settingsObject;
    }
    /**
     * Create and sync connection settings
     */
    async syncConnectionSettings(connectionSettings) {
        console.log('[ChumSettings] Syncing connection settings via CHUM');
        const settingsObject = await this.createSettingsObject('connections', connectionSettings, 'DEVICE_ADMIN');
        // Add to CHUM sync for replication
        await this.addSettingsToChumSync(settingsObject);
        return settingsObject;
    }
    /**
     * Create and sync network settings
     */
    async syncNetworkSettings(networkSettings) {
        console.log('[ChumSettings] Syncing network settings via CHUM');
        const settingsObject = await this.createSettingsObject('network', networkSettings, 'DEVICE_ADMIN');
        // Add to CHUM sync for replication
        await this.addSettingsToChumSync(settingsObject);
        return settingsObject;
    }
    /**
     * Add Settings object to CHUM sync for peer replication
     */
    async addSettingsToChumSync(settingsObject) {
        try {
            // In a real CHUM implementation, this would add the object to ONE.core storage
            // which would then be replicated via CHUM to connected peers
            // For now, we'll simulate this by directly calling the CHUM sync handler
            // Store locally first
            await nodeOneCore.setState(`chum.settings.${settingsObject.category}`, settingsObject);
            // Simulate peer replication (in production this would be automatic via CHUM)
            console.log(`[ChumSettings] Settings object added to CHUM sync: ${settingsObject.id}`);
            // Emit event for testing/monitoring
            // TODO: Implement chumSync when available
            // chumSync.emit('settingsObjectCreated', {
            //   category: settingsObject.category,
            //   id: settingsObject.id,
            //   timestamp: settingsObject.timestamp
            // })
        }
        catch (error) {
            console.error('[ChumSettings] Error adding settings to CHUM sync:', error);
            throw error;
        }
    }
    /**
     * Test credential validation with a sample Settings object
     */
    async testSettingsValidation(category, data) {
        console.log(`[ChumSettings] Testing settings validation for: ${category}`);
        // Create a Settings object
        const settingsObject = await this.createSettingsObject(category, data);
        // Test validation
        // TODO: Implement chumSync when available
        const result = null; // await chumSync.handleIncomingChumObject(
        //   settingsObject, 
        //   credentialsManager.getOwnInstanceId() // Simulate from ourselves
        // )
        console.log(`[ChumSettings] Validation test result:`, result);
        return result;
    }
    /**
     * Get instance name (placeholder)
     */
    getInstanceName() {
        return nodeOneCore.instanceName || 'Node.js Hub';
    }
    /**
     * Example: Create connection settings update
     */
    async exampleConnectionSettingsUpdate() {
        const connectionSettings = {
            commServerUrl: 'wss://comm10.dev.refinio.one',
            acceptIncomingConnections: true,
            directConnections: true,
            maxConnections: 50,
            pairingTokenExpiry: 900000 // 15 minutes
        };
        return await this.syncConnectionSettings(connectionSettings);
    }
    /**
     * Example: Create network settings update
     */
    async exampleNetworkSettingsUpdate() {
        const networkSettings = {
            protocols: ['https', 'wss', 'udp'],
            p2pEnabled: true,
            iomServer: {
                enabled: true,
                port: 8765,
                maxConnections: 100
            }
        };
        return await this.syncNetworkSettings(networkSettings);
    }
}
// Singleton
export default new ChumSettingsHelper();
