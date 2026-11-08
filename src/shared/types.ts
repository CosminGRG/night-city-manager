export type GameStore = 'steam' | 'gog' | 'epic'

export interface Settings {
  version: 1
  gamePath: string | null
  modsPath: string | null
  downloadsPath: string | null
  nexusLookup: boolean
  autoDeployRequirements: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  gamePath: null,
  modsPath: null,
  downloadsPath: null,
  nexusLookup: true,
  autoDeployRequirements: true
}

export interface DetectedGame {
  path: string
  store: GameStore
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

export type ModType =
  | 'archive'
  | 'archivexl'
  | 'redmod'
  | 'cet'
  | 'red4ext'
  | 'redscript'
  | 'tweakxl'
  | 'input'
  | 'config'

export interface PlannedFile {
  source: string
  target: string
}

export interface InstallPlan {
  providers: Framework[]
  files: PlannedFile[]
  types: ModType[]
  ignored: string[]
  unmatched: string[]
  warnings: string[]
}

export const FRAMEWORKS = [
  'cet',
  'red4ext',
  'redscript',
  'archivexl',
  'tweakxl',
  'codeware'
] as const

export type Framework = (typeof FRAMEWORKS)[number]

export interface ModRecord {
  id: string
  name: string
  version: string | null
  nexusModId: number | null
  archive: string
  folder: string
  plan: InstallPlan
  importedAt: string
}

export type DeployStatus = 'deploying' | 'deployed' | 'undeploying'

export interface UndeployResult {
  kept: string[]
  cleaned?: CleanResult
}

export type BulkAction = 'deploy' | 'purge' | 'remove'
export type BulkScope = 'all' | 'core' | 'non-core'

export interface BulkRequest {
  action: BulkAction
  scope: BulkScope
  trashLeftovers?: boolean
}

export interface BulkResult {
  done: number
  skipped: number
  kept: { name: string; files: string[] }[]
  failed: { name: string; error: string }[]
  cleaned?: CleanResult
}

export interface ModsFolderInfo {
  path: string
  sameDriveAsGame: boolean | null
}

export interface LeftoverFile {
  path: string
  size: number
  changed: boolean
}

export interface LeftoverGroup {
  folder: string
  inUse: boolean
  files: LeftoverFile[]
}

export interface CleanResult {
  trashed: number
  failed: { path: string; error: string }[]
}

export type BisectAnswer = 'broken' | 'works'

export type BisectStatus =
  | {
      kind: 'testing'
      round: number
      checking: boolean
      suspects: string[]
      off: string[]
      roundsLeft: number
    }
  | { kind: 'found'; culprit: string }
  | { kind: 'not-in-suspects' }

export interface BisectView {
  status: BisectStatus
  total: number
  answered: number
  ready: boolean
}

export interface NexusRequirement {
  nexusId: number
  name: string
  optional: boolean
}

export type LogSource = 'cet' | 'redscript' | 'red4ext'

export interface LogFile {
  path: string
  title: string
  source: LogSource
  modifiedAt: string
  size: number
  older: number
}

export interface GameLogs {
  logs: LogFile[]
  crashReports: number
  lastCrashAt: string | null
}

export type NexusFileRef = { kind: 'sqid'; sqid: string } | { kind: 'uploaded'; uploadedAt: number }

export interface ModUpdate {
  name: string
  version: string
  uploadedAt: string
}
