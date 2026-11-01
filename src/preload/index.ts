import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IpcChannels, type NightCityApi } from '@shared/ipc'

const api: NightCityApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.getAppInfo),
  getSettings: () => ipcRenderer.invoke(IpcChannels.getSettings),
  detectGames: () => ipcRenderer.invoke(IpcChannels.detectGames),
  selectGame: (path) => ipcRenderer.invoke(IpcChannels.selectGame, path),
  browseGame: () => ipcRenderer.invoke(IpcChannels.browseGame),
  listMods: () => ipcRenderer.invoke(IpcChannels.listMods),
  pickArchives: () => ipcRenderer.invoke(IpcChannels.pickArchives),
  importMod: (path) => ipcRenderer.invoke(IpcChannels.importMod, path),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getInstalledFrameworks: () => ipcRenderer.invoke(IpcChannels.getInstalledFrameworks),
  listDeployments: () => ipcRenderer.invoke(IpcChannels.listDeployments),
  deployMod: (modId) => ipcRenderer.invoke(IpcChannels.deployMod, modId),
  undeployMod: (modId) => ipcRenderer.invoke(IpcChannels.undeployMod, modId),
  removeMod: (modId) => ipcRenderer.invoke(IpcChannels.removeMod, modId),
  revealMod: (modId) => ipcRenderer.invoke(IpcChannels.revealMod, modId),
  openNexusPage: (modId) => ipcRenderer.invoke(IpcChannels.openNexusPage, modId),
  purgeMods: (scope) => ipcRenderer.invoke(IpcChannels.purgeMods, scope)
}

contextBridge.exposeInMainWorld('api', api)
