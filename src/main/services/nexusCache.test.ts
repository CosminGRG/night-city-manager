import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MAX_AGE_MS, NexusCache } from './nexusCache'

const NOW = new Date('2026-11-06T12:00:00.000Z')
const REDSCRIPT = { nexusId: 1511, name: 'redscript', optional: false }

let dir: string
let file: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-nexus-'))
  file = join(dir, 'nexus.json')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000)
}

describe('NexusCache', () => {
  it('keeps answers across a restart', async () => {
    const cache = new NexusCache(file)
    await cache.store(new Map([[2557, [REDSCRIPT]]]), NOW)

    const reloaded = new NexusCache(file)
    await reloaded.load()
    expect(reloaded.requirements()).toEqual({ 2557: [REDSCRIPT] })
  })

  it('starts empty without a file, so every mod needs a lookup', async () => {
    const cache = new NexusCache(file)
    await cache.load()
    expect(cache.requirements()).toEqual({})
    expect(cache.staleIds([2557, 790], NOW)).toEqual([2557, 790])
  })

  it(`counts answers older than ${MAX_AGE_MS / 3_600_000} hours as stale`, async () => {
    const cache = new NexusCache(file)
    await cache.store(new Map([[1, []]]), hoursAgo(23))
    await cache.store(new Map([[2, []]]), hoursAgo(25))

    expect(cache.staleIds([1, 2, 3, 3], NOW)).toEqual([2, 3])
  })

  it('counts answers dated in the future as stale (the clock was changed)', async () => {
    const cache = new NexusCache(file)
    await cache.store(new Map([[1, []]]), new Date(NOW.getTime() + 60_000))
    expect(cache.staleIds([1], NOW)).toEqual([1])
  })

  it('drops broken entries from a hand-edited file', async () => {
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        mods: {
          '2557': { fetchedAt: NOW.toISOString(), requirements: [REDSCRIPT] },
          abc: { fetchedAt: NOW.toISOString(), requirements: [] },
          '790': { fetchedAt: 'yesterday', requirements: [] },
          '107': { fetchedAt: NOW.toISOString(), requirements: [{ nexusId: 1 }] }
        }
      })
    )
    const cache = new NexusCache(file)
    await cache.load()
    expect(cache.requirements()).toEqual({ 2557: [REDSCRIPT] })
  })

  it('hands out copies, so callers cannot change the cache', async () => {
    const cache = new NexusCache(file)
    await cache.store(new Map([[2557, [REDSCRIPT]]]), NOW)

    cache.requirements()[2557].push({ nexusId: 9, name: 'x', optional: true })
    expect(cache.requirements()[2557]).toHaveLength(1)
  })

  it('does not write the file when there is nothing to store', async () => {
    await new NexusCache(file).store(new Map(), NOW)
    await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
