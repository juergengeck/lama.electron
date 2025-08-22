const { app, BrowserWindow } = require('electron')

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })
  
  win.loadURL('data:text/html,<h1>Test Window Works!</h1>')
  win.show()
  
  console.log('Window created successfully')
})

app.on('window-all-closed', () => {
  app.quit()
})