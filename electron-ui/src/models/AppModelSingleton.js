/**
 * AppModel Singleton
 *
 * Ensures AppModel is created and initialized exactly once,
 * regardless of React component lifecycle or StrictMode
 */
import { AppModel } from './AppModel';
class AppModelSingleton {
    /**
     * Get or create the AppModel instance
     * This is idempotent - multiple calls return the same instance
     */
    static async getInstance(ownerId) {
        // If we're already initializing, wait for it
        if (this.initPromise) {
            return this.initPromise;
        }
        // If already initialized, return it
        if (this.instance) {
            return this.instance;
        }
        // Start initialization
        this.initPromise = this.createInstance(ownerId);
        try {
            this.instance = await this.initPromise;
            return this.instance;
        }
        catch (error) {
            // Reset on failure so it can be retried
            this.initPromise = null;
            this.instance = null;
            throw error;
        }
    }
    static async createInstance(ownerId) {
        console.log('[AppModelSingleton] Creating AppModel instance...');
        const config = {
            name: 'LAMA-Desktop',
            version: '1.0.0',
            commServerUrl: process.env.NODE_ENV === 'development'
                ? 'wss://comm10.dev.refinio.one'
                : 'wss://comm.refinio.net'
        };
        const model = new AppModel(config);
        await model.init(ownerId);
        console.log('[AppModelSingleton] AppModel instance created and initialized');
        return model;
    }
    /**
     * Reset the singleton (for testing or cleanup)
     */
    static async reset() {
        if (this.instance) {
            try {
                await this.instance.shutdown();
            }
            catch (error) {
                console.error('[AppModelSingleton] Error during shutdown:', error);
            }
        }
        this.instance = null;
        this.initPromise = null;
    }
    /**
     * Check if initialized
     */
    static isInitialized() {
        return this.instance !== null;
    }
}
Object.defineProperty(AppModelSingleton, "instance", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(AppModelSingleton, "initPromise", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
export default AppModelSingleton;
