const { app, BrowserWindow, screen } = require('electron')

app.whenReady().then(() => {
  // Get the primary display
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize
  
  // Calculate center position
  const windowWidth = 1200
  const windowHeight = 800
  const x = Math.floor((width - windowWidth) / 2)
  const y = Math.floor((height - windowHeight) / 2)
  
  console.log('Screen size:', width, 'x', height)
  console.log('Window position:', x, ',', y)
  console.log('Window size:', windowWidth, 'x', windowHeight)
  
  const win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: x,
    y: y,
    show: true,
    alwaysOnTop: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Load a simple HTML content to make sure something is visible
  win.loadURL(`data:text/html,
    <!DOCTYPE html>
    <html>
    <head>
      <title>LAMA Electron Test</title>
      <style>
        body { 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white; 
          font-family: system-ui; 
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        h1 { font-size: 48px; }
      </style>
    </head>
    <body>
      <div>
        <h1>LAMA Electron Window Test</h1>
        <p>Window is visible at position ${x}, ${y}</p>
        <p>Connecting to: <a href="http://localhost:5173" style="color: white;">http://localhost:5173</a></p>
      </div>
    </body>
    </html>
  `)
  
  // Try to load the actual app after showing test content
  setTimeout(() => {
    console.log('Loading actual app...')
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  }, 3000)
  
  win.focus()
  win.show()
  
  console.log('Test window created')
  console.log('Visible:', win.isVisible())
  console.log('Focused:', win.isFocused())
  console.log('Bounds:', win.getBounds())
  
  // Remove always on top after 2 seconds
  setTimeout(() => {
    win.setAlwaysOnTop(false)
    console.log('Removed always on top')
  }, 2000)
})

app.on('window-all-closed', () => {
  app.quit()
})