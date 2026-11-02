import { randomUUID } from 'crypto'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ModRecord } from '@shared/types'
import { GameManifests } from './manifests'
import { ModLibrary } from './modLibrary'
import { removeMod, type RemoveContext } from './removal'

let dir: string
let context: RemoveContext

function makeMod(folder: string): ModRecord {
  return {
    id: randomUUID(),
    name: 'Test Mod',
    version: null,
    nexusModId: null,
    archive: 'test.zip',
    folder,
    plan: { providers: [], files: [], types: [], ignored: [], unmatched: [], warnings: [] },
    importedAt: new Date().toISOString()
  }
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-remove-'))
  context = {
    modsDir: join(dir, 'mods'),
    library: new ModLibrary(join(dir, 'data', 'mods.json')),
    games: new GameManifests(join(dir, 'data', 'manifests'))
  }
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('removeMod', () => {
  it('deletes the staging folder and the library entry', async () => {
    const mod = makeMod('Test Mod')
    await context.library.add(mod)
    await mkdir(join(context.modsDir, 'Test Mod', 'archive'), { recursive: true })
    await writeFile(join(context.modsDir, 'Test Mod', 'archive', 'a.archive'), 'x')

    await removeMod(context, mod)

    expect(context.library.list()).toEqual([])
    expect(await readdir(context.modsDir)).toEqual([])
  })

  it('refuses a mod that is still deployed in any game folder', async () => {
    const mod = makeMod('Test Mod')
    await context.library.add(mod)
    const otherGame = join(dir, 'other-game')
    await context.games.forGame(otherGame).write({
      version: 1,
      modId: mod.id,
      gamePath: otherGame,
      status: 'deployed',
      files: [],
      folders: []
    })

    await expect(removeMod(context, mod)).rejects.toThrow(/still deployed in .*other-game/)
    expect(context.library.list()).toHaveLength(1)
  })

  it('refuses a folder outside the mods folder and deletes nothing', async () => {
    const mod = makeMod('..\\precious')
    await context.library.add(mod)
    await mkdir(join(dir, 'precious'), { recursive: true })
    await writeFile(join(dir, 'precious', 'keep.txt'), 'important')

    await expect(removeMod(context, mod)).rejects.toThrow(/outside the mods folder/)
    expect(await readdir(join(dir, 'precious'))).toEqual(['keep.txt'])
    expect(context.library.list()).toHaveLength(1)
  })
})
