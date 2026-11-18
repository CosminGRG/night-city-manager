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
  NexusRequirement,
  GameLogs,
  ModUpdate,
  ImportOutcome,
  VersionGroup,
  LanguageInfo
} from './types'
import type { Dependency } from './requirements'
import type { LanguagePack } from './i18n/pack'

export const IpcChannels = {
  getAppInfo: 'app:get-info',
  getSettings: 'settings:get',
  detectGames: 'game:detect',
  selectGame: 'game:select',
  browseGame: 'game:browse',
  getGameIcon: 'game:icon',
  launchGame: 'game:launch',
  launchCompiling: 'game:compiling',
  setNexusLookup: 'settings:set-nexus-lookup',
  setAutoDeployRequirements: 'settings:set-auto-deploy-requirements',
  listMods: 'mod:list',
  importMod: 'mod:import',
  getInstalledDependencies: 'dependencies:installed',
  getNexusRequirements: 'nexus:requirements',
  getModUpdates: 'nexus:updates',
  getVersionGroups: 'nexus:versions',
  nexusUpdated: 'nexus:updated',
  listDeployments: 'deploy:list',
  deployMod: 'mod:deploy',
  undeployMod: 'mod:undeploy',
  removeMod: 'mod:remove',
  openNexusFiles: 'mod:open-nexus-files',
  setVersionOf: 'mod:set-version-of',
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
  endBisect: 'bisect:end',
  listLogs: 'logs:list',
  openLog: 'logs:open',
  openLogFolder: 'logs:open-folder',
  openCrashReports: 'logs:open-crash-reports',
  openAppLog: 'logs:open-app-log',
  listLanguages: 'languages:list',
  getLanguage: 'languages:current',
  setLanguage: 'settings:set-language',
  addLanguage: 'languages:add',
  openLanguagesFolder: 'languages:open-folder',
  saveLanguageTemplate: 'languages:save-template'
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
  getGameIcon(): Promise<string | null>
  launchGame(): Promise<Result<null>>
  onLaunchCompiling(callback: () => void): () => void
  setNexusLookup(enabled: boolean): Promise<Result<Settings>>
  setAutoDeployRequirements(enabled: boolean): Promise<Result<Settings>>
  listMods(): Promise<ModRecord[]>
  pickArchives(): Promise<string[] | null>
  importMod(path: string): Promise<Result<ImportOutcome>>
  getPathForFile(file: File): string
  getInstalledDependencies(): Promise<Dependency[]>
  getNexusRequirements(): Promise<Record<number, NexusRequirement[]>>
  getModUpdates(): Promise<Record<string, ModUpdate>>
  getVersionGroups(): Promise<VersionGroup[]>
  onNexusUpdated(callback: () => void): () => void
  listDeployments(): Promise<Record<string, DeployStatus>>
  deployMod(modId: string): Promise<Result<string[]>>
  undeployMod(modId: string): Promise<Result<UndeployResult>>
  removeMod(
    modId: string,
    trashLeftovers: boolean,
    allVersions: boolean
  ): Promise<Result<UndeployResult>>
  revealMod(modId: string): Promise<Result<null>>
  openNexusPage(modId: string): Promise<Result<null>>
  openNexusFiles(modId: string): Promise<Result<null>>
  setVersionOf(modId: string, targetId: string | null): Promise<Result<null>>
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
  listLogs(): Promise<Result<GameLogs>>
  openLog(path: string): Promise<Result<null>>
  openLogFolder(path: string): Promise<Result<null>>
  openCrashReports(): Promise<Result<null>>
  openAppLog(): Promise<Result<null>>
  listLanguages(): Promise<LanguageInfo[]>
  getLanguage(): Promise<LanguagePack | null>
  setLanguage(file: string | null): Promise<Result<Settings>>
  addLanguage(): Promise<Result<LanguageInfo[]> | null>
  openLanguagesFolder(): Promise<Result<null>>
  saveLanguageTemplate(): Promise<Result<string> | null>
}
