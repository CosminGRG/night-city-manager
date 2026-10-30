import type { ModRecord } from '@shared/types'
import { readJsonFile, writeJsonFile } from './jsonFile'

interface LibraryFile {
  version: 1
  mods: ModRecord[]
}

function isLibraryFile(data: unknown): data is LibraryFile {
  return typeof data === 'object' && data !== null && Array.isArray((data as LibraryFile).mods)
}

export class ModLibrary {
  private readonly filePath: string
  private mods: ModRecord[] = []

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async load(): Promise<void> {
    const data = await readJsonFile(this.filePath)
    if (isLibraryFile(data)) this.mods = data.mods
  }

  list(): ModRecord[] {
    return structuredClone(this.mods)
  }

  async add(mod: ModRecord): Promise<void> {
    this.mods.push(structuredClone(mod))
    try {
      await this.save()
    } catch (error) {
      this.mods = this.mods.filter((existing) => existing.id !== mod.id)
      throw error
    }
  }

  private save(): Promise<void> {
    const file: LibraryFile = { version: 1, mods: this.mods }
    return writeJsonFile(this.filePath, file)
  }
}
