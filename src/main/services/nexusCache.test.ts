import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { NexusRequirement } from '@shared/types'
import type { NexusFile } from './nexus'
import { MAX_AGE_MS, NexusCache, type NexusAnswer } from './nexusCache'

const NOW = new Date('2026-11-06T12:00:00.000Z')
const REDSCRIPT = { nexusId: 1511, name: 'redscript', optional: false }

const CET_FILE: NexusFile = {
  fileId: 168615,
  sqid: 'ozVyzbb0n',
  groupId: 497182,
  name: 'CET 1.38.1 - Game version 2.5',
  version: '1.38.1',
  category: 'MAIN',
  uploadedAt: 1792978138
}

let dir: string
let file: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-nexus-'))
  file = join(dir, 'nexus.json')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function answer(requirements: NexusRequirement[] = [], files: NexusFile[] = []): NexusAnswer {
  return { requirements, files }
}

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000)
}

describe('NexusCache', () => {
  it('keeps answers across a restart', async () => {
    const cache = new NexusCache(file)
    await cache.store(new Map([[107, answer([REDSCRIPT], [CET_FILE])]]), NOW)

    const reloaded = new NexusCache(file)
    await reloaded.load()
    expect(reloaded.requirements()).toEqual({ 107: [REDSCRIPT] })
    expect(reloaded.files()).toEqual({ 107: [CET_FILE] })
  })

  it('starts empty without a file, so every mod needs a lookup', async () => {
    const cache = new NexusCache(file)
    await cache.load()
    expect(cache.requirements()).toEqual({})
    expect(cache.staleIds([2557, 790], NOW)).toEqual([2557, 790])
  })

  it(`counts answers older than ${MAX_AGE_MS / 3_600_000} hours as stale`, async () => {
    const cache = new NexusCache(file)
    await cache.store(new Map([[1, answer()]]), hoursAgo(23))
    await cache.store(new Map([[2, answer()]]), hoursAgo(25))

    expect(cache.staleIds([1, 2, 3, 3], NOW)).toEqual([2, 3])
  })

  it('counts answers dated in the future as stale (the clock was changed)', async () => {
    const cache = new NexusCache(file)
    await cache.store(new Map([[1, answer()]]), new Date(NOW.getTime() + 60_000))
    expect(cache.staleIds([1], NOW)).toEqual([1])
  })

  it('drops broken entries from a hand-edited file', async () => {
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        mods: {
          '2557': { fetchedAt: NOW.toISOString(), requirements: [REDSCRIPT], files: [CET_FILE] },
          abc: { fetchedAt: NOW.toISOString(), requirements: [], files: [] },
          '790': { fetchedAt: 'yesterday', requirements: [], files: [] },
          '107': { fetchedAt: NOW.toISOString(), requirements: [{ nexusId: 1 }], files: [] },
          '4197': { fetchedAt: NOW.toISOString(), requirements: [], files: [{ fileId: 1 }] }
        }
      })
    )
    const cache = new NexusCache(file)
    await cache.load()
    expect(cache.requirements()).toEqual({ 2557: [REDSCRIPT] })
  })

  it('drops entries saved before files were cached, so they are looked up again', async () => {
    await writeFile(
      file,
      JSON.stringify({
        version: 1,
        mods: { '2557': { fetchedAt: NOW.toISOString(), requirements: [REDSCRIPT] } }
      })
    )
    const cache = new NexusCache(file)
    await cache.load()
    expect(cache.staleIds([2557], NOW)).toEqual([2557])
  })

  it('hands out copies, so callers cannot change the cache', async () => {
    const cache = new NexusCache(file)
    await cache.store(new Map([[107, answer([REDSCRIPT], [CET_FILE])]]), NOW)

    cache.requirements()[107].push({ nexusId: 9, name: 'x', optional: true })
    cache.files()[107][0].version = '9.9.9'
    expect(cache.requirements()[107]).toHaveLength(1)
    expect(cache.files()[107][0].version).toBe('1.38.1')
  })

  it('does not write the file when there is nothing to store', async () => {
    await new NexusCache(file).store(new Map(), NOW)
    await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
