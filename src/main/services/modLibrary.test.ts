import { randomUUID } from 'crypto'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ModRecord } from '@shared/types'
import { ModLibrary } from './modLibrary'

let dir: string
let file: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-library-'))
  file = join(dir, 'data', 'mods.json')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

function makeMod(name: string): ModRecord {
  return {
    id: randomUUID(),
    name,
    version: '1.0.0',
    nexusModId: 1,
    archive: `${name}.zip`,
    folder: name,
    plan: {
      providers: [],
      files: [],
      types: ['archive'],
      ignored: [],
      unmatched: [],
      warnings: []
    },
    importedAt: new Date().toISOString()
  }
}

describe('ModLibrary', () => {
  it('starts empty where there is not file', async () => {
    const library = new ModLibrary(file)
    await library.load()
    expect(library.list()).toEqual([])
  })

  it('saves added mods so a new instance loads them', async () => {
    const mod = makeMod('Faster Elevators')
    const library = new ModLibrary(file)
    await library.add(mod)

    const reloaded = new ModLibrary(file)
    await reloaded.load()
    expect(reloaded.list()).toEqual([mod])
  })

  it('returns copies, so callers cannot change the library', async () => {
    const library = new ModLibrary(file)
    await library.add(makeMod('A'))

    library.list()[0].name = 'changed'
    library.list()[0].plan.types.push('cet')

    expect(library.list()[0].name).toBe('A')
    expect(library.list()[0].plan.types).toEqual(['archive'])
  })

  it('ignores a file twith teh wrong shape', async () => {
    await writeFile(join(dir, 'mods.json'), '[1, 2, 3]')
    const library = new ModLibrary(join(dir, 'mods.json'))
    await library.load()

    expect(library.list()).toEqual([])
  })

  it('does not keep a mod in memory when saving fails', async () => {
    await writeFile(join(dir, 'data'), 'a file where the data folder should be')
    const library = new ModLibrary(file)

    await expect(library.add(makeMod('A'))).rejects.toThrow()
    expect(library.list()).toEqual([])
  })
})
