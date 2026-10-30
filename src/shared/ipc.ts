import type { DetectedGame, Settings, Result, ModRecord } from './types'

export const IpcChannels = {
  getAppInfo: 'app:get-info',
  getSettings: 'settings:get',
  detectGames: 'game:detect',
  selectGame: 'game:select',
  browseGame: 'game:browse',
  listMods: 'mod:list',
  importMod: 'mod:import'
} as const

export interface AppInfo {
  version: string
  electronVersion: string
  userDataPath: string
}

export interface NightCityApi {
  getAppInfo(): Promise<AppInfo>
  getSettings(): Promise<Settings>
  detectGames(): Promise<DetectedGame[]>
  selectGame(path: string): Promise<Result<Settings>>
  browseGame(): Promise<Result<Settings> | null>
  listMods(): Promise<ModRecord[]>
  importMod(): Promise<Result<ModRecord> | null>
}
