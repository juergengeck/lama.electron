/**
 * ObjectEvents Singleton
 *
 * Ensures ObjectEventDispatcher is initialized exactly once globally
 */
let initialized = false;
let initPromise = null;
export async function initializeObjectEvents() {
    // If already initializing, wait for it
    if (initPromise) {
        return initPromise;
    }
    // If already initialized, return immediately
    if (initialized) {
        return;
    }
    // Start initialization
    initPromise = doInit();
    try {
        await initPromise;
        initialized = true;
    }
    catch (error) {
        // Reset on failure so it can be retried
        initPromise = null;
        throw error;
    }
}
async function doInit() {
    console.log('[ObjectEventsSingleton] Initializing ObjectEventDispatcher...');
    const { objectEvents } = await import('@refinio/one.models/lib/misc/ObjectEventDispatcher.js');
    // Set priority overrides for Person and Profile objects
    objectEvents.determinePriorityOverride = (result) => {
        if (result.obj.$type$ === 'Person') {
            return 11;
        }
        if (result.obj.$type$ === 'Profile') {
            return 10;
        }
        return 0;
    };
    await objectEvents.init();
    console.log('[ObjectEventsSingleton] ObjectEventDispatcher initialized');
}
