import type { NexusRequirement } from '@shared/types'
import { readJsonFile, writeJsonFile } from './jsonFile'
import { toNexusId } from './nexus'

export const MAX_AGE_MS = 24 * 60 * 60 * 1000 //24h

interface CacheEntry {
  fetchedAt: string
  requirements: NexusRequirement[]
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

  return { fetchedAt: value.fetchedAt, requirements: value.requirements }
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

  staleIds(ids: number[], now: Date): number[] {
    return [...new Set(ids)].filter((nexusId) => {
      const entry = this.entries.get(nexusId)
      if (!entry) return true

      const age = now.getTime() - Date.parse(entry.fetchedAt)
      return age < 0 || age >= MAX_AGE_MS
    })
  }

  async store(results: Map<number, NexusRequirement[]>, now: Date): Promise<void> {
    if (results.size === 0) return

    const fetchedAt = now.toISOString()
    for (const [nexusId, requirements] of results) {
      this.entries.set(nexusId, { fetchedAt, requirements: structuredClone(requirements) })
    }

    await writeJsonFile(this.filePath, { version: 1, mods: Object.fromEntries(this.entries) })
  }
}
