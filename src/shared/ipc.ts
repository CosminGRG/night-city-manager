export const IpcChannels = {
  getAppInfo: 'app:get-info'
} as const

export interface AppInfo {
  version: string
  electronVersion: string
  userDataPath: string
}

export interface NightCityApi {
  getAppInfo(): Promise<AppInfo>
}
