import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels, type NightCityApi } from '../shared/ipc'

const api: NightCityApi = {
  getAppInfo: () => ipcRenderer.invoke(IpcChannels.getAppInfo)
}

contextBridge.exposeInMainWorld('api', api)
