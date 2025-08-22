const { app, BrowserWindow } = require('electron')
const path = require('path')

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    center: true,
    show: true,  // Show immediately
    alwaysOnTop: true,  // Force on top
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Load the dev server
  win.loadURL('http://localhost:5173')
  
  // Open dev tools
  win.webContents.openDevTools()
  
  // Force focus
  win.focus()
  win.show()
  
  console.log('Window created and should be visible')
  console.log('Bounds:', win.getBounds())
  console.log('Visible:', win.isVisible())
  console.log('Focused:', win.isFocused())
  
  // Remove always on top after 2 seconds
  setTimeout(() => {
    win.setAlwaysOnTop(false)
    console.log('Removed always on top')
  }, 2000)
})

app.on('window-all-closed', () => {
  app.quit()
})