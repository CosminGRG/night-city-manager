import { app, ipcMain, BrowserWindow, dialog } from 'electron'
import { IpcChannels, type AppInfo } from '@shared/ipc'
import type { DetectedGame, Settings, Result, ModRecord } from '@shared/types'
import type { SettingsStore } from './services/settings'
import { detectGames, isGameFolder } from './services/gameDetector'
import { ModLibrary } from './services/modLibrary'
import { AppPaths } from './services/paths'
import { importMod } from './services/importer'

interface IpcDependencies {
  settings: SettingsStore
  library: ModLibrary
  paths: AppPaths
}

export function registerIpcHandlers({ settings, library, paths }: IpcDependencies): void {
  ipcMain.handle(IpcChannels.getAppInfo, (): AppInfo => ({
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    userDataPath: app.getPath('userData')
  }))

  ipcMain.handle(IpcChannels.getSettings, (): Settings => settings.get())

  async function setGamePath(path: string): Promise<Result<Settings>> {
    if (!(await isGameFolder(path))) {
      return {
        ok: false,
        error: `Cyberpunk2077.exe was not found in "${path}\\bin\\x64". Select the folder that contains "bin", "archive" and "r6".`
      }
    }

    return { ok: true, value: await settings.update({ gamePath: path }) }
  }

  ipcMain.handle(IpcChannels.detectGames, (): Promise<DetectedGame[]> => detectGames())

  ipcMain.handle(IpcChannels.selectGame, (_event, path: unknown): Promise<Result<Settings>> => {
    if (typeof path !== 'string') throw new Error('selectGame: path must be a string')
    return setGamePath(path)
  })

  ipcMain.handle(IpcChannels.browseGame, async (event): Promise<Result<Settings> | null> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null

    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Select your Cyberpunk 2077 folder',
      properties: ['openDirectory']
    })
    if (canceled) return null

    return setGamePath(filePaths[0])
  })

  ipcMain.handle(IpcChannels.listMods, (): ModRecord[] => library.list())

  ipcMain.handle(IpcChannels.importMod, async (event): Promise<Result<ModRecord> | null> => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return null

    const { canceled, filePaths } = await dialog.showOpenDialog(window, {
      title: 'Import a mod archive',
      properties: ['openFile'],
      filters: [{ name: 'Mod archives', extensions: ['zip', '7z', 'rar'] }]
    })

    if (canceled) return null

    try {
      const modsDir = settings.get().modsPath ?? paths.mods
      const mod = await importMod({ sevenZip: paths.sevenZip, modsDir, library }, filePaths[0])
      return { ok: true, value: mod }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}
