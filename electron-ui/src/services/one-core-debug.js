/**
 * Debug ONE.CORE Loading Issues
 */
export async function debugOneCore() {
    console.log('=== ONE.CORE Debug ===');
    // Check environment
    console.log('Window type:', typeof window);
    console.log('Process:', typeof process);
    console.log('Require:', typeof require);
    console.log('Module:', typeof module);
    console.log('Electron API:', typeof window.electronAPI);
    // Check globals that ONE.CORE might need
    console.log('crypto:', typeof crypto);
    console.log('TextEncoder:', typeof TextEncoder);
    console.log('TextDecoder:', typeof TextDecoder);
    console.log('Buffer:', typeof Buffer);
    try {
        // Try loading browser platform
        console.log('Loading browser platform...');
        await import('@refinio/one.core/lib/system/load-browser.js');
        console.log('✅ Browser platform loaded!');
        // Try using initInstance function (not a class)
        console.log('Initializing instance...');
        const { initInstance } = await import('@refinio/one.core/lib/instance.js');
        const instanceResult = await initInstance({
            name: 'test-browser',
            email: 'test@example.com',
            secret: 'test-secret',
            directory: 'test-data',
            wipeStorage: true
        });
        console.log('✅ Instance initialized:', instanceResult);
        return { success: true, instanceResult };
    }
    catch (error) {
        console.error('❌ ONE.CORE Error:', error);
        console.error('Stack:', error.stack);
        return { success: false, error: error.message };
    }
}
