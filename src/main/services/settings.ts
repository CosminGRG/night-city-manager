import { DEFAULT_SETTINGS, type Settings } from '@shared/types'
import { readJsonFile, writeJsonFile } from './jsonFile'

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
    if (typeof this.settings.nexusLookup !== 'boolean') {
      this.settings.nexusLookup = DEFAULT_SETTINGS.nexusLookup
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
