import type { ModRecord, NexusRequirement, ModUpdate } from '@shared/types'
import { fetchFiles, fetchRequirements, type Fetch } from './nexus'
import type { NexusAnswer, NexusCache } from './nexusCache'
import { createQueue } from './queue'
import { findUpdates } from './updates'

export interface NexusLookupOptions {
  cache: NexusCache
  fetch: Fetch
  appVersion: string
  enabled: () => boolean
  mods: () => ModRecord[]
  onUpdated?: () => void
}

export class NexusLookup {
  private readonly options: NexusLookupOptions
  private readonly queue = createQueue()

  constructor(options: NexusLookupOptions) {
    this.options = options
  }

  requirements(): Record<number, NexusRequirement[]> {
    return this.options.enabled() ? this.options.cache.requirements() : {}
  }

  updates(): Record<string, ModUpdate> {
    return this.options.enabled()
      ? findUpdates(this.options.mods(), this.options.cache.files())
      : {}
  }

  refresh(now = new Date()): Promise<boolean> {
    return this.queue(async () => {
      if (!this.options.enabled()) return false

      const ids = this.options
        .mods()
        .map((mod) => mod.nexusModId)
        .filter((id) => id !== null)

      const stale = this.options.cache.staleIds(ids, now)

      if (stale.length === 0) return false

      const { fetch, appVersion } = this.options
      const [requirements, files] = await Promise.all([
        fetchRequirements(stale, fetch, appVersion),
        fetchFiles(stale, fetch, appVersion)
      ])

      const answers = new Map<number, NexusAnswer>()
      for (const [nexusId, modRequirements] of requirements) {
        answers.set(nexusId, { requirements: modRequirements, files: files.get(nexusId) ?? [] })
      }

      await this.options.cache.store(answers, now)

      return true
    })
  }

  refreshInBackground(): void {
    this.refresh()
      .then((update) => {
        if (update) {
          this.options.onUpdated?.()
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`Nexus lookup failed, keeping the saved answeres: ${message}`)
      })
  }
}
