export type GameStore = 'steam' | 'gog' | 'epic'

export interface Settings {
  version: 1
  gamePath: string | null
  modsPath: string | null
  downloadsPath: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  gamePath: null,
  modsPath: null,
  downloadsPath: null
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

export type Framework = 'cet' | 'red4ext' | 'redscript' | 'archivexl' | 'tweakxl' | 'codeware'

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
}

export type PurgeScope = 'all' | 'non-core'

export interface PurgeResult {
  undeployed: number
  kept: { name: string; files: string[] }[]
  failed: { name: string; error: string }[]
}
