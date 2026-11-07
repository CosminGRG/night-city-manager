import type { ModRecord, NexusRequirement } from '@shared/types'
import { fetchRequirements, type Fetch } from './nexus'
import type { NexusCache } from './nexusCache'
import { createQueue } from './queue'

export interface NexusLookupOptions {
  cache: NexusCache
  fetch: Fetch
  appVersion: string
  enabled: () => boolean
  mods: () => ModRecord[]
  onUpdated: () => void
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

  refresh(now = new Date()): Promise<boolean> {
    return this.queue(async () => {
      if (!this.options.enabled()) return false

      const ids = this.options
        .mods()
        .map((mod) => mod.nexusModId)
        .filter((id) => id !== null)

      const stale = this.options.cache.staleIds(ids, now)

      if (stale.length === 0) return false

      const results = await fetchRequirements(stale, this.options.fetch, this.options.appVersion)
      await this.options.cache.store(results, now)
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
