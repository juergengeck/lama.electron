// Auto-login test script for Electron main process
// This can be added to lama-electron-shadcn.js temporarily for testing

async function autoLogin(mainWindow) {
  console.log('[AutoLogin] Waiting for app to load...')
  
  // Wait for the app to fully load
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  console.log('[AutoLogin] Attempting automatic login...')
  
  // Execute login in the renderer process
  mainWindow.webContents.executeJavaScript(`
    (async () => {
      console.log('[AutoLogin] Running in renderer process...')
      
      // Wait for login form to appear
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Try to find and fill the login form
      const usernameInput = document.querySelector('input[name="username"]')
      const passwordInput = document.querySelector('input[type="password"]')
      const loginButton = document.querySelector('button[type="submit"]')
      
      if (usernameInput && passwordInput && loginButton) {
        console.log('[AutoLogin] Found login form, filling...')
        
        // Set values
        usernameInput.value = 'testuser'
        passwordInput.value = 'testpass123'
        
        // Dispatch events to trigger React updates
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }))
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }))
        
        // Wait for React to process
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Click login
        console.log('[AutoLogin] Clicking login button...')
        loginButton.click()
        
        return 'Login triggered'
      } else {
        return 'Login form not found'
      }
    })()
  `).then(result => {
    console.log('[AutoLogin] Result:', result)
  }).catch(error => {
    console.error('[AutoLogin] Error:', error)
  })
}

module.exports = { autoLogin }