export interface Settings {
  version: 1
  gamePath: string | null
  modsPath: string | null
  donwloadsPath: string | null
}

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  gamePath: null,
  modsPath: null,
  donwloadsPath: null
}
