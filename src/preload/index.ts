import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type NightCityApi } from '@shared/ipc'

const api: NightCityApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.getAppInfo),
  getSettings: () => ipcRenderer.invoke(IpcChannels.getSettings),
  detectGames: () => ipcRenderer.invoke(IpcChannels.detectGames),
  selectGame: (path) => ipcRenderer.invoke(IpcChannels.selectGame, path),
  browseGame: () => ipcRenderer.invoke(IpcChannels.browseGame),
  listMods: () => ipcRenderer.invoke(IpcChannels.listMods),
  importMod: () => ipcRenderer.invoke(IpcChannels.importMod),
  getInstalledFrameworks: () => ipcRenderer.invoke(IpcChannels.getInstalledFrameworks)
}

contextBridge.exposeInMainWorld('api', api)
