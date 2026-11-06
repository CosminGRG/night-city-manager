import type {
  DetectedGame,
  Settings,
  Result,
  ModRecord,
  DeployStatus,
  UndeployResult,
  BulkResult,
  BulkRequest,
  ModsFolderInfo,
  LeftoverGroup,
  CleanResult,
  BisectView,
  BisectAnswer,
  NexusRequirement
} from './types'
import type { Dependency } from './requirements'

export const IpcChannels = {
  getAppInfo: 'app:get-info',
  getSettings: 'settings:get',
  detectGames: 'game:detect',
  selectGame: 'game:select',
  browseGame: 'game:browse',
  setNexusLookup: 'settings:set-nexus-lookup',
  listMods: 'mod:list',
  importMod: 'mod:import',
  getInstalledDependencies: 'dependencies:installed',
  getNexusRequirements: 'nexus:requirements',
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
  cleanLeftovers: 'leftovers:clean',
  getBisect: 'bisect:get',
  startBisect: 'bisect:start',
  answerBisect: 'bisect:answer',
  undoBisect: 'bisect:undo',
  applyBisect: 'bisect:apply',
  endBisect: 'bisect:end'
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
  setNexusLookup(enabled: boolean): Promise<Result<Settings>>
  listMods(): Promise<ModRecord[]>
  pickArchives(): Promise<string[] | null>
  importMod(path: string): Promise<Result<ModRecord>>
  getPathForFile(file: File): string
  getInstalledDependencies(): Promise<Dependency[]>
  getNexusRequirements(): Promise<Record<number, NexusRequirement[]>>
  listDeployments(): Promise<Record<string, DeployStatus>>
  deployMod(modId: string): Promise<Result<null>>
  undeployMod(modId: string): Promise<Result<UndeployResult>>
  removeMod(modId: string, trashLeftovers: boolean): Promise<Result<UndeployResult>>
  revealMod(modId: string): Promise<Result<null>>
  openNexusPage(modId: string): Promise<Result<null>>
  runBulk(request: BulkRequest): Promise<Result<BulkResult>>
  getModsFolder(): Promise<ModsFolderInfo>
  changeModsFolder(): Promise<Result<Settings> | null>
  scanLeftovers(): Promise<Result<LeftoverGroup[]>>
  cleanLeftovers(paths: string[]): Promise<Result<CleanResult>>
  getBisect(): Promise<Result<BisectView | null>>
  startBisect(suspects: string[], checkFirst: boolean): Promise<Result<BisectView>>
  answerBisect(answer: BisectAnswer): Promise<Result<BisectView>>
  undoBisect(): Promise<Result<BisectView>>
  applyBisect(): Promise<Result<BisectView>>
  endBisect(keepCulpritOff: boolean): Promise<Result<null>>
}
