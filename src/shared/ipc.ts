import type {
  DetectedGame,
  Settings,
  Result,
  ModRecord,
  Framework,
  DeployStatus,
  UndeployResult,
  BulkResult,
  BulkRequest,
  ModsFolderInfo,
  LeftoverGroup,
  CleanResult
} from './types'

export const IpcChannels = {
  getAppInfo: 'app:get-info',
  getSettings: 'settings:get',
  detectGames: 'game:detect',
  selectGame: 'game:select',
  browseGame: 'game:browse',
  listMods: 'mod:list',
  importMod: 'mod:import',
  getInstalledFrameworks: 'frameworks:installed',
  listDeployments: 'deploy:list',
  deployMod: 'mod:deploy',
  undeployMod: 'mod:undeploy',
  removeMod: 'mod:remove',
  revealMod: 'mod:reveal',
  openNexusPage: 'mod:open-nexus',
  pickArchives: 'mod:pick-archives',
  runBulk: 'mod:bulk',
  getModsFolder: 'mods-folder:get',
  changeModsFolder: 'mods-folder:change',
  scanLeftovers: 'leftovers:scan',
  cleanLeftovers: 'leftovers:clean'
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
  pickArchives(): Promise<string[] | null>
  importMod(path: string): Promise<Result<ModRecord>>
  getPathForFile(file: File): string
  getInstalledFrameworks(): Promise<Framework[]>
  listDeployments(): Promise<Record<string, DeployStatus>>
  deployMod(modId: string): Promise<Result<null>>
  undeployMod(modId: string): Promise<Result<UndeployResult>>
  removeMod(modId: string): Promise<Result<UndeployResult>>
  revealMod(modId: string): Promise<Result<null>>
  openNexusPage(modId: string): Promise<Result<null>>
  runBulk(request: BulkRequest): Promise<Result<BulkResult>>
  getModsFolder(): Promise<ModsFolderInfo>
  changeModsFolder(): Promise<Result<Settings>> | null
  scanLeftovers(): Promise<Result<LeftoverGroup[]>>
  cleanLeftovers(paths: string[]): Promise<Result<CleanResult>>
}
