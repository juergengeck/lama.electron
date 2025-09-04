// Simple test to trigger login from browser console
// Run this in the browser DevTools console after the app loads

// Check what's available
console.log('=== Federation Test Environment ===')
console.log('window.browserInit:', typeof window.browserInit)
console.log('window.appModel:', typeof window.appModel)
console.log('window.lamaBridge:', typeof window.lamaBridge)
console.log('window.nodeInstanceInfo:', typeof window.nodeInstanceInfo)

// Try to trigger login programmatically
async function testLogin() {
  try {
    console.log('Attempting login via browser console...')
    
    // Check if we can find the login button
    const loginButton = document.querySelector('button[type="submit"]')
    if (loginButton) {
      // Fill in the form fields
      const usernameInput = document.querySelector('input[name="username"]')
      const passwordInput = document.querySelector('input[type="password"]')
      
      if (usernameInput && passwordInput) {
        usernameInput.value = 'testuser'
        passwordInput.value = 'testpass123'
        
        // Trigger input events to update React state
        usernameInput.dispatchEvent(new Event('input', { bubbles: true }))
        passwordInput.dispatchEvent(new Event('input', { bubbles: true }))
        
        // Wait a bit for state to update
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Click the login button
        console.log('Clicking login button...')
        loginButton.click()
        
        console.log('Login triggered - watch the console for federation logs')
      } else {
        console.log('Could not find login form fields')
      }
    } else {
      console.log('No login button found - app may already be authenticated')
    }
    
  } catch (error) {
    console.error('Test login failed:', error)
  }
}

console.log('Run testLogin() to trigger login automatically')