import { app, ipcMain } from 'electron'
import { IpcChannels, type AppInfo } from '../shared/ipc'
import type { Settings } from '../shared/types'
import type { SettingsStore } from './services/settings'

export function registerIpcHandlers(settings: SettingsStore): void {
  ipcMain.handle(IpcChannels.getAppInfo, (): AppInfo => ({
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    userDataPath: app.getPath('userData')
  }))
  ipcMain.handle(IpcChannels.getSettings, (): Settings => settings.get())
}
