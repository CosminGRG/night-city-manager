import { mkdtemp, readdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { importMod, type ImportContext } from './importer'
import { ModLibrary } from './modLibrary'
import { makeZip, SEVEN_ZIP } from './testArchives'

const NEXUS_NAME = 'Faster Elevators 18389 2.0.0 2026-09-16T13-25Z 5em9eomcJ.zip'

let work: string
let context: ImportContext

beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), 'ncm-import-'))
  context = {
    sevenZip: SEVEN_ZIP,
    modsDir: join(work, 'mods'),
    library: new ModLibrary(join(work, 'data', 'mods.json'))
  }
})

afterEach(async () => {
  await rm(work, { recursive: true, force: true })
})

describe('importMod', () => {
  it('imports a Nexus archive into the library and the mods folder', async () => {
    const zip = await makeZip(work, NEXUS_NAME, {
      'archive/pc/mod/a.archive': 'x',
      'readme.txt': 'r'
    })

    const mod = await importMod(context, zip)

    expect(mod).toMatchObject({
      name: 'Faster Elevators',
      version: '2.0.0',
      nexusModId: 18389,
      archive: NEXUS_NAME,
      folder: 'Faster Elevators'
    })
    expect(mod.plan.types).toEqual(['archive'])
    expect(context.library.list()).toEqual([mod])
    expect(await readdir(context.modsDir)).toEqual(['Faster Elevators'])
  })

  it('gives a second import of the same archives its own folder', async () => {
    const zip = await makeZip(work, NEXUS_NAME, { 'archive/pc/mod/a.archive': 'x' })

    await importMod(context, zip)
    const second = await importMod(context, zip)

    expect(second.folder).toBe('Faster Elevators (2)')
    expect(context.library.list()).toHaveLength(2)
  })

  it('leaves nothing behind when extraction fails', async () => {
    const zip = await makeZip(work, 'locked.zip', { 'archive/pc/mod/a.archive': 'x' }, 'secret')

    await expect(importMod(context, zip)).rejects.toThrow(/Wrong password/)
    expect(context.library.list()).toEqual([])
    expect(await readdir(context.modsDir).catch(() => [])).toEqual([])
  })
})
