import { mkdtemp, readdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { importMod, findDuplicate, type ImportContext } from './importer'
import { parseArchiveName } from './archiveName'
import { ModLibrary } from './modLibrary'
import { makeZip, SEVEN_ZIP } from './testArchives'
import type { ModRecord } from '@shared/types'

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

    const outcome = await importMod(context, zip)
    expect(outcome.kind).toBe('imported')

    const { mod } = outcome

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

  it('does not import the same Nexus file twice', async () => {
    const zip = await makeZip(work, NEXUS_NAME, { 'archive/pc/mod/a.archive': 'x' })

    const first = await importMod(context, zip)
    const second = await importMod(context, zip)

    expect(second).toEqual({ kind: 'duplicate', mod: first.mod })
    expect(context.library.list()).toHaveLength(1)
    expect(await readdir(context.modsDir)).toEqual(['Faster Elevators'])
  })

  it('gives a second import of an archive without a Nexus name its own folder', async () => {
    const zip = await makeZip(work, 'My Mod.zip', { 'archive/pc/mod/a.archive': 'x' })

    await importMod(context, zip)
    const second = await importMod(context, zip)

    expect(second.mod.folder).toBe('My Mod (2)')
    expect(context.library.list()).toHaveLength(2)
  })

  it('leaves nothing behind when extraction fails', async () => {
    const zip = await makeZip(work, 'locked.zip', { 'archive/pc/mod/a.archive': 'x' }, 'secret')

    await expect(importMod(context, zip)).rejects.toThrow(/Wrong password/)
    expect(context.library.list()).toEqual([])
    expect(await readdir(context.modsDir).catch(() => [])).toEqual([])
  })
})

describe('findDuplicate', () => {
  function libraryMod(archive: string, nexusModId: number | null): ModRecord {
    return {
      id: archive,
      name: archive,
      version: null,
      nexusModId,
      archive,
      folder: archive,
      plan: { providers: [], files: [], types: [], ignored: [], unmatched: [], warnings: [] },
      importedAt: '2026-11-08T00:00:00.000Z'
    }
  }

  const CET_1380 = 'CET 1.38.0 - Game version 2.5 107 1.38.0 2026-10-22T12-57Z Q6xF6lly7.zip'
  const OUTRUN = 'Outrun Waves 93.7 - Radio Mod (Only Music)-5808-1-1-0-1717159726.rar'

  it('finds the same Nexus file, also when the browser saved it again', () => {
    const library = [libraryMod(CET_1380, 107), libraryMod(OUTRUN, 5808)]
    const again = CET_1380.replace('.zip', ' (1).zip')

    expect(findDuplicate(parseArchiveName(again), library)).toBe(library[0])
    expect(findDuplicate(parseArchiveName(OUTRUN), library)).toBe(library[1])
  })

  it('treats another file of the same mod as a different import', () => {
    const library = [libraryMod(CET_1380, 107)]
    const cet1381 = 'CET 1.38.1 - Game version 2.5 107 1.38.1 2026-11-01T09-15Z ozVyzbb0n.zip'

    expect(findDuplicate(parseArchiveName(cet1381), library)).toBeNull()
  })

  it('never matches archives without a Nexus name', () => {
    const library = [libraryMod('My Mod.zip', null)]
    expect(findDuplicate(parseArchiveName('My Mod.zip'), library)).toBeNull()
  })
})
