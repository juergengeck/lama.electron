const { app, BrowserWindow } = require('electron')
const path = require('path')

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    x: 200,
    y: 200,
    show: true,
    backgroundColor: '#09090b',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Load test HTML to verify platform works
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Platform Test</title>
      <style>
        body { 
          background: #09090b; 
          color: white; 
          font-family: system-ui; 
          padding: 20px;
        }
        #status { 
          padding: 20px; 
          background: #1a1a1a; 
          border-radius: 8px;
          margin: 20px 0;
        }
        .success { color: #10b981; }
        .error { color: #ef4444; }
      </style>
    </head>
    <body>
      <h1>LAMA Electron Platform Test</h1>
      <div id="status">Loading platform modules...</div>
      
      <script type="module">
        const statusEl = document.getElementById('status');
        
        try {
          // Test loading platform modules
          statusEl.innerHTML = 'Loading ONE.core platform...';
          
          await import('@refinio/one.core/lib/system/load-browser.js');
          statusEl.innerHTML += '<br><span class="success">✓ load-browser loaded</span>';
          
          await import('@refinio/one.core/lib/system/browser/crypto-helpers.js');
          statusEl.innerHTML += '<br><span class="success">✓ crypto-helpers loaded</span>';
          
          await import('@refinio/one.core/lib/system/browser/settings-store.js');
          statusEl.innerHTML += '<br><span class="success">✓ settings-store loaded</span>';
          
          await import('@refinio/one.core/lib/system/browser/storage-base.js');
          statusEl.innerHTML += '<br><span class="success">✓ storage-base loaded</span>';
          
          // Test platform functions
          const { ensurePlatformLoaded } = await import('@refinio/one.core/lib/system/platform.js');
          ensurePlatformLoaded();
          statusEl.innerHTML += '<br><span class="success">✓ Platform loaded successfully!</span>';
          
          // Try to load the actual app after success
          statusEl.innerHTML += '<br><br>Platform test complete. Loading app...';
          setTimeout(() => {
            window.location.href = 'http://localhost:5175';
          }, 2000);
          
        } catch (error) {
          statusEl.innerHTML += '<br><span class="error">✗ Error: ' + error.message + '</span>';
          console.error('Platform test error:', error);
        }
      </script>
    </body>
    </html>
  `;
  
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  
  win.webContents.openDevTools()
  
  console.log('Test window created')
  console.log('Window visible:', win.isVisible())
  console.log('Window bounds:', win.getBounds())
})

app.on('window-all-closed', () => {
  app.quit()
})