import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type NightCityApi } from '../shared/ipc'

const api: NightCityApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.getAppInfo),
  getSettings: () => ipcRenderer.invoke(IpcChannels.getSettings)
}

contextBridge.exposeInMainWorld('api', api)
