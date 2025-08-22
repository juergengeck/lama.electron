const { app, BrowserWindow, screen } = require('electron')

app.whenReady().then(() => {
  // Get display information
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  
  console.log('Display info:', {
    width,
    height,
    bounds: primaryDisplay.bounds,
    workArea: primaryDisplay.workArea
  })
  
  // Create window in center of screen
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    x: Math.floor((width - 800) / 2),
    y: Math.floor((height - 600) / 2),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  
  win.loadURL('data:text/html,<h1 style="text-align:center;margin-top:100px">Test Window at Center</h1>')
  
  win.once('ready-to-show', () => {
    win.show()
    win.focus()
    win.moveTop()
    console.log('Window shown and focused')
  })
  
  // Also log window bounds after showing
  setTimeout(() => {
    const bounds = win.getBounds()
    console.log('Window bounds:', bounds)
    console.log('Is visible:', win.isVisible())
    console.log('Is focused:', win.isFocused())
  }, 1000)
})

app.on('window-all-closed', () => {
  app.quit()
})