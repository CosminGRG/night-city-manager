import { app, shell, BrowserWindow, screen, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc'
import { IpcChannels } from '@shared/ipc'
import { initPaths } from './services/paths'
import { dialog } from 'electron'
import { SettingsStore } from './services/settings'
import { isWritable } from './services/folders'
import { ModLibrary } from './services/modLibrary'
import { GameManifests } from './services/manifests'
import { NexusCache } from './services/nexusCache'
import { NexusLookup } from './services/nexusLookup'

const paths = initPaths()

const MIN_SIZE = { width: 960, height: 600 }
const MAX_START_SIZE = { width: 1440, height: 900 }

function startSize(available: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(available * 0.85)))
}

function createWindow(): void {
  const { workAreaSize } = screen.getPrimaryDisplay()
  const mainWindow = new BrowserWindow({
    width: startSize(workAreaSize.width, MIN_SIZE.width, MAX_START_SIZE.width),
    height: startSize(workAreaSize.height, MIN_SIZE.height, MAX_START_SIZE.height),
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    backgroundColor: '#0b0d12',
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault()
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  if (!(await isWritable(paths.data))) {
    dialog.showErrorBox(
      'Cannot write to the app folder',
      `Night City Mod Manager stores its data next to the exe, but it cannot write to:\n${paths.root}\n\nMove the app to a folder you own, e.g. D:\\Tools\\NightCityModManager.`
    )
    app.quit()
    return
  }

  const settings = new SettingsStore(join(paths.data, 'settings.json'))
  await settings.load()

  const library = new ModLibrary(join(paths.data, 'mods.json'))
  await library.load()

  const games = new GameManifests(join(paths.data, 'manifests'))

  const nexusCache = new NexusCache(join(paths.data, 'nexus.json'))
  await nexusCache.load().catch((error: unknown) => {
    console.warn('Could not read teh saved Nexus answers, starting without them.', error)
  })

  const nexus = new NexusLookup({
    cache: nexusCache,
    fetch: (url, init) => net.fetch(url, init),
    appVersion: app.getVersion(),
    enabled: () => settings.get().nexusLookup,
    mods: () => library.list(),
    onUpdated: () => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(IpcChannels.nexusUpdated)
      }
    }
  })

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.cosmingrg.nightcitymanager')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers({ settings, library, games, paths, nexus })
  createWindow()

  nexus.refreshInBackground()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
