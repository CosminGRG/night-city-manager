import type { NexusRequirement } from '@shared/types'
import { readJsonFile, writeJsonFile } from './jsonFile'
import { toNexusId, isCategory, type NexusFile } from './nexus'

export const MAX_AGE_MS = 24 * 60 * 60 * 1000 //24h

export interface NexusAnswer {
  requirements: NexusRequirement[]
  files: NexusFile[]
}

interface CacheEntry extends NexusAnswer {
  fetchedAt: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isRequirement(value: unknown): value is NexusRequirement {
  return (
    isRecord(value) &&
    typeof value.nexusId === 'number' &&
    toNexusId(value.nexusId) !== null &&
    typeof value.name === 'string' &&
    typeof value.optional === 'boolean'
  )
}

function isFile(value: unknown): value is NexusFile {
  return (
    isRecord(value) &&
    toNexusId(value.fileId) === value.fileId &&
    typeof value.sqid === 'string' &&
    value.sqid !== '' &&
    (value.groupId === null || toNexusId(value.groupId) === value.groupId) &&
    typeof value.name === 'string' &&
    typeof value.version === 'string' &&
    isCategory(value.category) &&
    toNexusId(value.uploadedAt) === value.uploadedAt
  )
}

function parseEntry(value: unknown): CacheEntry | null {
  if (!isRecord(value) || typeof value.fetchedAt !== 'string') {
    return null
  }
  if (Number.isNaN(Date.parse(value.fetchedAt))) {
    return null
  }
  if (!Array.isArray(value.requirements) || !value.requirements.every(isRequirement)) {
    return null
  }

  if (!Array.isArray(value.files) || !value.files.every(isFile)) {
    return null
  }

  return { fetchedAt: value.fetchedAt, requirements: value.requirements, files: value.files }
}

export class NexusCache {
  private readonly filePath: string
  private entries = new Map<number, CacheEntry>()

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async load(): Promise<void> {
    const data = await readJsonFile(this.filePath)
    const mods = isRecord(data) && isRecord(data.mods) ? data.mods : {}

    const entries = new Map<number, CacheEntry>()
    for (const [key, value] of Object.entries(mods)) {
      const nexusId = toNexusId(key)
      const entry = parseEntry(value)

      if (nexusId !== null && entry) {
        entries.set(nexusId, entry)
      }
    }

    this.entries = entries
  }

  requirements(): Record<number, NexusRequirement[]> {
    const result: Record<number, NexusRequirement[]> = {}

    for (const [nexusId, entry] of this.entries) {
      result[nexusId] = structuredClone(entry.requirements)
    }

    return result
  }

  files(): Record<number, NexusFile[]> {
    const result: Record<number, NexusFile[]> = {}

    for (const [nexusId, entry] of this.entries) {
      result[nexusId] = structuredClone(entry.files)
    }

    return result
  }

  staleIds(ids: number[], now: Date): number[] {
    return [...new Set(ids)].filter((nexusId) => {
      const entry = this.entries.get(nexusId)
      if (!entry) return true

      const age = now.getTime() - Date.parse(entry.fetchedAt)
      return age < 0 || age >= MAX_AGE_MS
    })
  }

  async store(results: Map<number, NexusAnswer>, now: Date): Promise<void> {
    if (results.size === 0) return

    const fetchedAt = now.toISOString()
    for (const [nexusId, answer] of results) {
      this.entries.set(nexusId, { fetchedAt, ...structuredClone(answer) })
    }

    await writeJsonFile(this.filePath, { version: 1, mods: Object.fromEntries(this.entries) })
  }
}
