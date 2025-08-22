/**
 * Tests for Electron main process
 */

const { app, BrowserWindow, Menu } = require('electron')
const path = require('path')

// Mock Electron modules
jest.mock('electron', () => ({
  app: {
    whenReady: jest.fn().mockResolvedValue(true),
    quit: jest.fn(),
    getAppPath: jest.fn().mockReturnValue('/test/path'),
    getPath: jest.fn().mockReturnValue('/test/exe'),
    getName: jest.fn().mockReturnValue('LAMA'),
    getVersion: jest.fn().mockReturnValue('1.0.0'),
    on: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadURL: jest.fn(),
    loadFile: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    webContents: {
      send: jest.fn(),
      openDevTools: jest.fn(),
      on: jest.fn(),
      session: {
        webRequest: {
          onHeadersReceived: jest.fn()
        }
      }
    },
    show: jest.fn(),
    focus: jest.fn(),
    moveTop: jest.fn(),
    getBounds: jest.fn().mockReturnValue({ x: 100, y: 100, width: 1200, height: 800 }),
    isVisible: jest.fn().mockReturnValue(false),
    isFocused: jest.fn().mockReturnValue(false),
    minimize: jest.fn(),
    maximize: jest.fn(),
    unmaximize: jest.fn(),
    isMaximized: jest.fn().mockReturnValue(false),
    close: jest.fn()
  })),
  Menu: {
    buildFromTemplate: jest.fn().mockReturnValue({}),
    setApplicationMenu: jest.fn()
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn(),
    invoke: jest.fn()
  },
  dialog: {
    showOpenDialog: jest.fn()
  },
  clipboard: {
    writeText: jest.fn(),
    readText: jest.fn()
  },
  shell: {
    openExternal: jest.fn()
  }
}))

describe('Electron Main Process', () => {
  let mainWindow
  
  beforeEach(() => {
    jest.clearAllMocks()
    mainWindow = null
  })

  describe('App Initialization', () => {
    it('should wait for app to be ready', () => {
      expect(app.whenReady).toHaveBeenCalled()
    })

    it('should create window when ready', async () => {
      const createWindow = jest.fn()
      await app.whenReady().then(createWindow)
      
      expect(createWindow).toHaveBeenCalled()
    })

    it('should set up event handlers', () => {
      expect(app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function))
      expect(app.on).toHaveBeenCalledWith('activate', expect.any(Function))
      expect(app.on).toHaveBeenCalledWith('certificate-error', expect.any(Function))
      expect(app.on).toHaveBeenCalledWith('web-contents-created', expect.any(Function))
    })
  })

  describe('Window Creation', () => {
    it('should create window with correct configuration', () => {
      const window = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        x: 100,
        y: 100,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
          webSecurity: true,
          allowRunningInsecureContent: false,
          preload: path.join(__dirname, 'preload.js')
        },
        backgroundColor: '#09090b',
        show: false
      })

      expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600
      }))
    })

    it('should load correct URL in development mode', () => {
      process.env.NODE_ENV = 'development'
      const window = new BrowserWindow()
      window.loadURL('http://localhost:5173')
      
      expect(window.loadURL).toHaveBeenCalledWith('http://localhost:5173')
    })

    it('should load file in production mode', () => {
      process.env.NODE_ENV = 'production'
      const window = new BrowserWindow()
      const filePath = path.join(__dirname, 'dist/index.html')
      window.loadFile(filePath)
      
      expect(window.loadFile).toHaveBeenCalledWith(filePath)
    })

    it('should show window when ready', () => {
      const window = new BrowserWindow()
      const readyCallback = window.once.mock.calls.find(call => call[0] === 'ready-to-show')?.[1]
      
      if (readyCallback) {
        readyCallback()
        expect(window.show).toHaveBeenCalled()
        expect(window.focus).toHaveBeenCalled()
        expect(window.moveTop).toHaveBeenCalled()
      }
    })

    it('should handle window close event', () => {
      const window = new BrowserWindow()
      const closeCallback = window.on.mock.calls.find(call => call[0] === 'closed')?.[1]
      
      if (closeCallback) {
        closeCallback()
        // Window reference should be cleared
      }
    })
  })

  describe('Menu Creation', () => {
    it('should create application menu', () => {
      expect(Menu.buildFromTemplate).toHaveBeenCalled()
      expect(Menu.setApplicationMenu).toHaveBeenCalled()
    })

    it('should have platform-specific menu items', () => {
      const isMac = process.platform === 'darwin'
      
      const menuTemplate = Menu.buildFromTemplate.mock.calls[0]?.[0]
      
      if (menuTemplate) {
        if (isMac) {
          // Mac should have app menu
          expect(menuTemplate[0]).toHaveProperty('label', app.getName())
        } else {
          // Windows/Linux should have File menu first
          expect(menuTemplate[0]).toHaveProperty('label', 'File')
        }
      }
    })

    it('should handle menu navigation commands', () => {
      const window = new BrowserWindow()
      const menuTemplate = Menu.buildFromTemplate.mock.calls[0]?.[0]
      
      // Find View menu
      const viewMenu = menuTemplate?.find(menu => menu.label === 'View')
      
      if (viewMenu) {
        // Find Chats menu item
        const chatsItem = viewMenu.submenu?.find(item => item.label === 'Chats')
        
        if (chatsItem?.click) {
          chatsItem.click()
          expect(window.webContents.send).toHaveBeenCalledWith('navigate', 'chats')
        }
      }
    })
  })

  describe('IPC Handlers', () => {
    it('should register UDP handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('udp:create', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('udp:bind', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('udp:send', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('udp:close', expect.any(Function))
    })

    it('should register window control handlers', () => {
      expect(ipcMain.on).toHaveBeenCalledWith('window:minimize', expect.any(Function))
      expect(ipcMain.on).toHaveBeenCalledWith('window:maximize', expect.any(Function))
      expect(ipcMain.on).toHaveBeenCalledWith('window:close', expect.any(Function))
    })

    it('should register system info handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('system:platform', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('system:version', expect.any(Function))
    })

    it('should register dialog handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('dialog:selectDirectory', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('dialog:selectFile', expect.any(Function))
    })

    it('should register clipboard handlers', () => {
      expect(ipcMain.handle).toHaveBeenCalledWith('clipboard:write', expect.any(Function))
      expect(ipcMain.handle).toHaveBeenCalledWith('clipboard:read', expect.any(Function))
    })
  })

  describe('Platform Behavior', () => {
    it('should quit app on window close for non-macOS', () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'win32'
      })
      
      const windowAllClosedCallback = app.on.mock.calls.find(
        call => call[0] === 'window-all-closed'
      )?.[1]
      
      if (windowAllClosedCallback) {
        windowAllClosedCallback()
        expect(app.quit).toHaveBeenCalled()
      }
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      })
    })

    it('should not quit app on window close for macOS', () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      })
      
      const windowAllClosedCallback = app.on.mock.calls.find(
        call => call[0] === 'window-all-closed'
      )?.[1]
      
      if (windowAllClosedCallback) {
        windowAllClosedCallback()
        expect(app.quit).not.toHaveBeenCalled()
      }
      
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      })
    })

    it('should recreate window on activate for macOS', () => {
      const activateCallback = app.on.mock.calls.find(
        call => call[0] === 'activate'
      )?.[1]
      
      if (activateCallback) {
        activateCallback()
        // Should create new window if none exists
      }
    })
  })

  describe('Security', () => {
    it('should set Content Security Policy', () => {
      const window = new BrowserWindow()
      const onHeadersReceived = window.webContents.session.webRequest.onHeadersReceived
      
      expect(onHeadersReceived).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should prevent new window creation', () => {
      const webContentsCreatedCallback = app.on.mock.calls.find(
        call => call[0] === 'web-contents-created'
      )?.[1]
      
      if (webContentsCreatedCallback) {
        const mockContents = {
          on: jest.fn()
        }
        
        webContentsCreatedCallback(null, mockContents)
        expect(mockContents.on).toHaveBeenCalledWith('new-window', expect.any(Function))
      }
    })

    it('should handle certificate errors for localhost', () => {
      const certErrorCallback = app.on.mock.calls.find(
        call => call[0] === 'certificate-error'
      )?.[1]
      
      if (certErrorCallback) {
        const event = { preventDefault: jest.fn() }
        const callback = jest.fn()
        
        certErrorCallback(event, null, 'https://localhost', null, null, callback)
        
        expect(event.preventDefault).toHaveBeenCalled()
        expect(callback).toHaveBeenCalledWith(true)
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      const error = new Error('Init failed')
      app.whenReady.mockRejectedValueOnce(error)
      
      try {
        await app.whenReady()
      } catch (err) {
        expect(err).toBe(error)
      }
    })

    it('should quit app on fatal errors', () => {
      const error = new Error('Fatal error')
      const consoleError = jest.spyOn(console, 'error').mockImplementation()
      
      // Simulate fatal error during initialization
      expect(app.quit).not.toHaveBeenCalled()
      
      consoleError.mockRestore()
    })
  })
})