const { app, BrowserWindow, screen } = require('electron')

app.whenReady().then(() => {
  // Get primary display info
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  
  console.log('Screen dimensions:', width, 'x', height)
  console.log('Available displays:', screen.getAllDisplays().length)
  
  // Force window to center of screen
  const windowWidth = 1000
  const windowHeight = 700
  const x = Math.floor((width - windowWidth) / 2)
  const y = Math.floor((height - windowHeight) / 2)
  
  console.log('Creating window at:', x, ',', y)
  
  const win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: x,
    y: y,
    show: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    minimizable: true,
    maximizable: true,
    resizable: true,
    fullscreenable: true,
    backgroundColor: '#ffffff',
    titleBarStyle: 'default',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Load simple content first to ensure visibility
  win.loadURL(`data:text/html,<!DOCTYPE html>
<html>
<head><title>LAMA Test</title></head>
<body style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; font-family: system-ui; text-align: center; padding: 50px;">
  <h1 style="font-size: 48px; margin: 50px 0;">LAMA Desktop</h1>
  <p style="font-size: 24px;">Window is now visible!</p>
  <p style="font-size: 16px; margin-top: 40px;">Loading actual app in 3 seconds...</p>
  <script>
    setTimeout(() => {
      window.location.href = 'http://localhost:5179';
    }, 3000);
  </script>
</body>
</html>`)

  // Aggressive visibility methods
  win.show()
  win.focus()
  win.moveTop()
  win.center()
  
  // macOS specific
  if (process.platform === 'darwin') {
    app.dock.show()
    app.dock.bounce('critical')
    
    // Try to activate app
    setTimeout(() => {
      app.activate()
      win.show()
      win.focus()
    }, 100)
  }
  
  console.log('Window created:')
  console.log('- Visible:', win.isVisible())
  console.log('- Focused:', win.isFocused())
  console.log('- Minimized:', win.isMinimized())
  console.log('- Bounds:', win.getBounds())
  
  // Remove always on top after 5 seconds
  setTimeout(() => {
    win.setAlwaysOnTop(false)
    console.log('Removed always on top')
  }, 5000)
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  console.log('App activated')
})