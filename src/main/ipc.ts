import { app, ipcMain } from 'electron'
import { IpcChannels, type AppInfo } from '../shared/ipc'

export function registerIpcHandler(): void {
  ipcMain.handle(IpcChannels.getAppInfo, (): AppInfo => ({
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    userDataPath: app.getPath('userData')
  }))
}
