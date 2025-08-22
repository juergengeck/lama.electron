const { app, BrowserWindow } = require('electron')

console.log('Debug Electron starting...')

app.on('ready', () => {
  console.log('App ready, creating window...')
  
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    x: 200,
    y: 200,
    show: true,
    alwaysOnTop: true,
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  
  console.log('Loading localhost:5173...')
  
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log('Failed to load:', errorDescription)
    win.loadURL(`data:text/html,
      <html>
        <body style="background: #222; color: white; padding: 40px; font-family: system-ui;">
          <h1>Connection Failed</h1>
          <p>Could not connect to localhost:5173</p>
          <p>Error: ${errorDescription}</p>
        </body>
      </html>
    `)
  })
  
  win.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully')
  })
  
  win.loadURL('http://localhost:5173')
  
  // Force show
  setTimeout(() => {
    win.show()
    win.focus()
    win.moveTop()
    const bounds = win.getBounds()
    console.log('Window forced to show at:', bounds)
    console.log('Is visible?', win.isVisible())
    console.log('Is minimized?', win.isMinimized())
  }, 1000)
})

app.on('window-all-closed', () => {
  app.quit()
})