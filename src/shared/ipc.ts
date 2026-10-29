import type { Settings } from './types'

export const IpcChannels = {
  getAppInfo: 'app:get-info',
  getSettings: 'settings:get'
} as const

export interface AppInfo {
  version: string
  electronVersion: string
  userDataPath: string
}

export interface NightCityApi {
  getAppInfo(): Promise<AppInfo>
  getSettings(): Promise<Settings>
}
