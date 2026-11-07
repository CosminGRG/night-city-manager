import { DEFAULT_SETTINGS, type Settings } from '@shared/types'
import { readJsonFile, writeJsonFile } from './jsonFile'

const BOOLEAN_SETTINGS = ['nexusLookup', 'autoDeployRequirements'] as const

export class SettingsStore {
  private readonly filePath: string
  private settings: Settings = { ...DEFAULT_SETTINGS }

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async load(): Promise<void> {
    const data = await readJsonFile(this.filePath)
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      this.settings = { ...DEFAULT_SETTINGS, ...data }
    }
    for (const key of BOOLEAN_SETTINGS) {
      if (typeof this.settings[key] !== 'boolean') {
        this.settings[key] = DEFAULT_SETTINGS[key]
      }
    }
  }

  get(): Settings {
    return { ...this.settings }
  }

  async update(changes: Partial<Settings>): Promise<Settings> {
    this.settings = { ...this.settings, ...changes }
    await this.save()
    return this.get()
  }

  private async save(): Promise<void> {
    return writeJsonFile(this.filePath, this.settings)
  }
}
