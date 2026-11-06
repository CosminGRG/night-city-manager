import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModRecord } from '@shared/types'
import type { Fetch } from './nexus'
import { NexusCache } from './nexusCache'
import { NexusLookup } from './nexusLookup'

const NOW = new Date('2026-11-06T12:00:00.000Z')
const REDSCRIPT = { modId: '1511', modName: 'redscript', notes: '', externalRequirement: false }

let dir: string
let cache: NexusCache

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-lookup-'))
  cache = new NexusCache(join(dir, 'nexus.json'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function mod(nexusModId: number | null): ModRecord {
  return {
    id: `mod-${nexusModId}`,
    name: `Mod ${nexusModId}`,
    version: null,
    nexusModId,
    archive: 'mod.zip',
    folder: 'mod',
    plan: { providers: [], files: [], types: [], ignored: [], unmatched: [], warnings: [] },
    importedAt: '2026-11-06T00:00:00.000Z'
  }
}

// Answers every requested id: each mod needs redscript.
function nexusFetch(): ReturnType<typeof vi.fn<Fetch>> {
  return vi.fn<Fetch>(async (_url, init) => {
    const { ids } = JSON.parse(String(init.body)).variables
    const nodes = ids.map(({ modId }: { modId: number }) => ({
      modId,
      modRequirements: { nexusRequirements: { nodes: [REDSCRIPT] } }
    }))
    return new Response(JSON.stringify({ data: { legacyMods: { nodes } } }))
  })
}

function requestedIds(fetch: ReturnType<typeof vi.fn<Fetch>>, call: number): number[] {
  const { ids } = JSON.parse(String(fetch.mock.calls[call][1].body)).variables
  return ids.map(({ modId }: { modId: number }) => modId)
}

function lookup(fetch: Fetch, mods: ModRecord[], enabled = true): NexusLookup {
  return new NexusLookup({
    cache,
    fetch,
    appVersion: '1.0.0',
    enabled: () => enabled,
    mods: () => mods
  })
}

describe('NexusLookup', () => {
  it('looks up mods with a Nexus id and keeps the answers', async () => {
    const fetch = nexusFetch()
    const nexus = lookup(fetch, [mod(2557), mod(null)])

    expect(await nexus.refresh(NOW)).toBe(true)
    expect(requestedIds(fetch, 0)).toEqual([2557])
    expect(nexus.requirements()).toEqual({
      2557: [{ nexusId: 1511, name: 'redscript', optional: false }]
    })
  })

  it('asks only for mods without a fresh answer', async () => {
    const fetch = nexusFetch()
    const mods = [mod(2557)]
    const nexus = lookup(fetch, mods)
    await nexus.refresh(NOW)

    mods.push(mod(790))
    expect(await nexus.refresh(NOW)).toBe(true)
    expect(requestedIds(fetch, 1)).toEqual([790])

    expect(await nexus.refresh(NOW)).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('runs overlapping refreshes one after the other, without asking twice', async () => {
    const fetch = nexusFetch()
    const nexus = lookup(fetch, [mod(2557)])

    await Promise.all([nexus.refresh(NOW), nexus.refresh(NOW)])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does nothing and shows nothing while the setting is off', async () => {
    const fetch = nexusFetch()
    const nexus = lookup(fetch, [mod(2557)], false)

    expect(await nexus.refresh(NOW)).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
    expect(nexus.requirements()).toEqual({})
  })

  it('keeps the saved answers when Nexus cannot be reached', async () => {
    const mods = [mod(2557)]
    await lookup(nexusFetch(), mods).refresh(NOW)

    const later = new Date(NOW.getTime() + 25 * 60 * 60 * 1000)
    const offline = vi.fn<Fetch>(async () => {
      throw new TypeError('fetch failed')
    })
    const nexus = lookup(offline, mods)

    await expect(nexus.refresh(later)).rejects.toThrow('fetch failed')
    expect(nexus.requirements()[2557]).toHaveLength(1)
  })

  it('only logs a failed background refresh', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const offline = vi.fn<Fetch>(async () => new Response('', { status: 503 }))

    lookup(offline, [mod(2557)]).refreshInBackground()
    await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce())
    expect(warn.mock.calls[0][0]).toContain('HTTP 503')
    warn.mockRestore()
  })
})
