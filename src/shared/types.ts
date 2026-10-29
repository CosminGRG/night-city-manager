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
