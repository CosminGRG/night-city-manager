import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { IpcChannels, type NightCityApi } from '@shared/ipc'

const api: NightCityApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.getAppInfo),
  getSettings: () => ipcRenderer.invoke(IpcChannels.getSettings),
  detectGames: () => ipcRenderer.invoke(IpcChannels.detectGames),
  selectGame: (path) => ipcRenderer.invoke(IpcChannels.selectGame, path),
  browseGame: () => ipcRenderer.invoke(IpcChannels.browseGame),
  getGameIcon: () => ipcRenderer.invoke(IpcChannels.getGameIcon),
  launchGame: () => ipcRenderer.invoke(IpcChannels.launchGame),
  setNexusLookup: (enabled) => ipcRenderer.invoke(IpcChannels.setNexusLookup, enabled),
  setAutoDeployRequirements: (enabled) =>
    ipcRenderer.invoke(IpcChannels.setAutoDeployRequirements, enabled),
  listMods: () => ipcRenderer.invoke(IpcChannels.listMods),
  pickArchives: () => ipcRenderer.invoke(IpcChannels.pickArchives),
  importMod: (path) => ipcRenderer.invoke(IpcChannels.importMod, path),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  getInstalledDependencies: () => ipcRenderer.invoke(IpcChannels.getInstalledDependencies),
  getNexusRequirements: () => ipcRenderer.invoke(IpcChannels.getNexusRequirements),
  getModUpdates: () => ipcRenderer.invoke(IpcChannels.getModUpdates),
  onNexusUpdated: (callback) => {
    const listener = (): void => callback()
    ipcRenderer.on(IpcChannels.nexusUpdated, listener)
    return () => ipcRenderer.removeListener(IpcChannels.nexusUpdated, listener)
  },
  listDeployments: () => ipcRenderer.invoke(IpcChannels.listDeployments),
  deployMod: (modId) => ipcRenderer.invoke(IpcChannels.deployMod, modId),
  undeployMod: (modId) => ipcRenderer.invoke(IpcChannels.undeployMod, modId),
  removeMod: (modId, trashLeftovers) =>
    ipcRenderer.invoke(IpcChannels.removeMod, modId, trashLeftovers),
  revealMod: (modId) => ipcRenderer.invoke(IpcChannels.revealMod, modId),
  openNexusPage: (modId) => ipcRenderer.invoke(IpcChannels.openNexusPage, modId),
  runBulk: (request) => ipcRenderer.invoke(IpcChannels.runBulk, request),
  getModsFolder: () => ipcRenderer.invoke(IpcChannels.getModsFolder),
  changeModsFolder: () => ipcRenderer.invoke(IpcChannels.changeModsFolder),
  scanLeftovers: () => ipcRenderer.invoke(IpcChannels.scanLeftovers),
  cleanLeftovers: (paths) => ipcRenderer.invoke(IpcChannels.cleanLeftovers, paths),
  getBisect: () => ipcRenderer.invoke(IpcChannels.getBisect),
  startBisect: (suspects, checkFirst) =>
    ipcRenderer.invoke(IpcChannels.startBisect, suspects, checkFirst),
  answerBisect: (answer) => ipcRenderer.invoke(IpcChannels.answerBisect, answer),
  undoBisect: () => ipcRenderer.invoke(IpcChannels.undoBisect),
  applyBisect: () => ipcRenderer.invoke(IpcChannels.applyBisect),
  endBisect: (keepCulpritOff) => ipcRenderer.invoke(IpcChannels.endBisect, keepCulpritOff),
  listLogs: () => ipcRenderer.invoke(IpcChannels.listLogs),
  openLog: (path) => ipcRenderer.invoke(IpcChannels.openLog, path),
  openLogFolder: (path) => ipcRenderer.invoke(IpcChannels.openLogFolder, path),
  openCrashReports: () => ipcRenderer.invoke(IpcChannels.openCrashReports)
}

contextBridge.exposeInMainWorld('api', api)
