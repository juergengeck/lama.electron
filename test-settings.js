/**
 * Test script to verify Settings integration
 */

const { ipcRenderer } = require('electron')

async function testSettings() {
  console.log('Testing Settings Integration...')
  
  try {
    // Get instance configuration
    const config = await ipcRenderer.invoke('settings:getConfig')
    console.log('Instance Configuration:', JSON.stringify(config, null, 2))
    
    // Test setting a value
    await ipcRenderer.invoke('settings:set', { 
      key: 'test.setting', 
      value: 'test-value' 
    })
    console.log('Setting stored: test.setting = test-value')
    
    // Get the value back
    const value = await ipcRenderer.invoke('settings:get', 'test.setting')
    console.log('Retrieved value:', value)
    
    // Sync IoM settings
    const iomSettings = await ipcRenderer.invoke('settings:syncIoM', {
      'iom.browser.status': 'active',
      'iom.browser.version': '1.0.0'
    })
    console.log('IoM Settings:', JSON.stringify(iomSettings, null, 2))
    
    console.log('✅ Settings integration working!')
  } catch (error) {
    console.error('❌ Settings test failed:', error)
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testSettings()
}

module.exports = testSettings