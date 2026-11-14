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

const FILE = {
  fileId: 1,
  sqid: 'abc',
  groupId: 2,
  name: 'Main file',
  version: '1.0',
  category: 'MAIN',
  date: 1792978138
}

function variablesOf(init: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init.body)).variables
}

// Answers every requested id: each mod needs redscript and has one file.
function nexusFetch(): ReturnType<typeof vi.fn<Fetch>> {
  return vi.fn<Fetch>(async (_url, init) => {
    const variables = variablesOf(init)

    if (Array.isArray(variables.ids)) {
      const nodes = variables.ids.map(({ modId }: { modId: number }) => ({
        modId,
        modRequirements: { nexusRequirements: { nodes: [REDSCRIPT] } }
      }))
      return new Response(JSON.stringify({ data: { legacyMods: { nodes } } }))
    }

    const count = Object.keys(variables).length - 1
    const data = Object.fromEntries(Array.from({ length: count }, (_, i) => [`f${i}`, [FILE]]))
    return new Response(JSON.stringify({ data }))
  })
}

// The ids of each requirements request (every refresh also sends one files request).
function requestedIds(fetch: ReturnType<typeof vi.fn<Fetch>>): number[][] {
  return fetch.mock.calls
    .map(([, init]) => variablesOf(init).ids)
    .filter((ids) => Array.isArray(ids))
    .map((ids) => ids.map(({ modId }: { modId: number }) => modId))
}

function lookup(
  fetch: Fetch,
  mods: ModRecord[],
  enabled = true,
  onUpdated?: () => void,
  onError?: (error: unknown) => void
): NexusLookup {
  return new NexusLookup({
    cache,
    fetch,
    appVersion: '1.0.0',
    enabled: () => enabled,
    mods: () => mods,
    onUpdated,
    onError
  })
}

describe('NexusLookup', () => {
  it('looks up mods with a Nexus id and keeps the answers', async () => {
    const fetch = nexusFetch()
    const nexus = lookup(fetch, [mod(2557), mod(null)])

    expect(await nexus.refresh(NOW)).toBe(true)
    expect(requestedIds(fetch)).toEqual([[2557]])
    expect(nexus.requirements()).toEqual({
      2557: [{ nexusId: 1511, name: 'redscript', optional: false }]
    })
    expect(cache.files()[2557].map((file) => file.sqid)).toEqual(['abc'])
  })

  it('asks only for mods without a fresh answer', async () => {
    const fetch = nexusFetch()
    const mods = [mod(2557)]
    const nexus = lookup(fetch, mods)
    await nexus.refresh(NOW)

    mods.push(mod(790))
    expect(await nexus.refresh(NOW)).toBe(true)
    expect(requestedIds(fetch)).toEqual([[2557], [790]])

    expect(await nexus.refresh(NOW)).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(4)
  })

  it('runs overlapping refreshes one after the other, without asking twice', async () => {
    const fetch = nexusFetch()
    const nexus = lookup(fetch, [mod(2557)])

    await Promise.all([nexus.refresh(NOW), nexus.refresh(NOW)])
    expect(fetch).toHaveBeenCalledTimes(2)
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

  it('stores nothing when one of the two lookups fails', async () => {
    const answers = nexusFetch()
    const filesFail = vi.fn<Fetch>(async (url, init) =>
      Array.isArray(variablesOf(init).ids) ? answers(url, init) : new Response('', { status: 500 })
    )
    const nexus = lookup(filesFail, [mod(2557)])

    await expect(nexus.refresh(NOW)).rejects.toThrow('HTTP 500')
    expect(nexus.requirements()).toEqual({})
    expect(cache.staleIds([2557], NOW)).toEqual([2557])
  })

  it('only reports a failed background refresh', async () => {
    const onError = vi.fn<(error: unknown) => void>()
    const offline = vi.fn<Fetch>(async () => new Response('', { status: 503 }))

    lookup(offline, [mod(2557)], true, undefined, onError).refreshInBackground()
    await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce())
    expect(String(onError.mock.calls[0][0])).toContain('HTTP 503')
  })

  it('reports new answers from a background refresh', async () => {
    const onUpdated = vi.fn()
    lookup(nexusFetch(), [mod(2557)], true, onUpdated).refreshInBackground()
    await vi.waitFor(() => expect(onUpdated).toHaveBeenCalledOnce())
  })

  it('stays quiet when a background refresh finds nothing new', async () => {
    const onUpdated = vi.fn()
    const nexus = lookup(nexusFetch(), [mod(2557)], true, onUpdated)
    await nexus.refresh()

    nexus.refreshInBackground()
    expect(await nexus.refresh()).toBe(false)
    expect(onUpdated).not.toHaveBeenCalled()
  })
})
