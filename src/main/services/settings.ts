import { mkdir, readFile, rename, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { DEFAULT_SETTINGS, type Settings } from '../../shared/types'

export class SettingsStore {
  private readonly filePath: string
  private settings: Settings = { ...DEFAULT_SETTINGS }

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async load(): Promise<void> {
    let raw: string
    try {
      raw = await readFile(this.filePath, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }

    try {
      this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
    } catch {
      await rename(this.filePath, `${this.filePath}.corrupt`)
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
    await mkdir(dirname(this.filePath), { recursive: true })
    const tempPath = `${this.filePath}.tmp`
    await writeFile(tempPath, JSON.stringify(this.settings, null, 2), 'utf8')
    await rename(tempPath, this.filePath)
  }
}
