const { app, BrowserWindow } = require('electron')

console.log('Starting simple Electron test...')

let mainWindow = null

function createWindow() {
  console.log('Creating window...')
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true, // Show immediately
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  
  // Load simple HTML content
  mainWindow.loadURL('data:text/html,<!DOCTYPE html><html><body style="background: black; color: white; font-family: sans-serif; padding: 40px;"><h1>Electron Works!</h1><p>If you can see this, Electron is working.</p></body></html>')
  
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  
  console.log('Window created and should be visible')
}

app.on('ready', () => {
  console.log('App ready event fired')
  createWindow()
})

app.on('window-all-closed', () => {
  console.log('All windows closed')
  app.quit()
})

console.log('Script loaded, waiting for app ready...')