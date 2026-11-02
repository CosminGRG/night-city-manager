import { randomUUID } from 'crypto'
import { mkdir, mkdtemp, rm, unlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { exists } from './folders'
import {
  cleanLeftovers,
  findLeftovers,
  scanLeftovers,
  cleanUnusedLeftovers,
  cleanModLeftovers
} from './leftovers'
import { ManifestStore, type Manifest } from './manifests'

describe('findLeftovers', () => {
  it('groups unowned files by the nearest folder we created', () => {
    const groups = findLeftovers({
      registered: ['bin/x64/plugins', 'bin/x64/plugins/cyber_engine_tweaks/mods/Mod'],
      owned: [],
      kept: [],
      found: [
        { path: 'bin/x64/plugins/cyber_engine_tweaks/mods/Mod/db.sqlite3', size: 10 },
        { path: 'bin/x64/plugins/cyber_engine_tweaks/config.json', size: 2 }
      ]
    })

    expect(groups.map((group) => [group.folder, group.files.map((file) => file.size)])).toEqual([
      ['bin/x64/plugins', [2]],
      ['bin/x64/plugins/cyber_engine_tweaks/mods/Mod', [10]]
    ])
  })

  it('skips files a manifest owns and marks folders a deployed mod still uses', () => {
    const groups = findLeftovers({
      registered: ['red4ext'],
      owned: ['red4ext/RED4ext.dll'],
      kept: [],
      found: [
        { path: 'red4ext/RED4ext.dll', size: 1 },
        { path: 'red4ext/logs/red4ext.log', size: 5 }
      ]
    })

    expect(groups).toEqual([
      {
        folder: 'red4ext',
        inUse: true,
        files: [{ path: 'red4ext/logs/red4ext.log', size: 5, changed: false }]
      }
    ])
  })

  it('puts kept files in a vanilla folder under their own folder', () => {
    const groups = findLeftovers({
      registered: [],
      owned: [],
      kept: ['r6/cache/inputUserMappings.xml'],
      found: [{ path: 'r6/cache/inputUserMappings.xml', size: 3 }]
    })

    expect(groups).toEqual([
      {
        folder: 'r6/cache',
        inUse: false,
        files: [{ path: 'r6/cache/inputUserMappings.xml', size: 3, changed: true }]
      }
    ])
  })

  it('compares paths ignoring case and lists each file once', () => {
    const groups = findLeftovers({
      registered: ['R6/Scripts'],
      owned: ['r6/scripts/a.reds'],
      kept: ['r6/scripts/b.reds'],
      found: [
        { path: 'r6/scripts/A.reds', size: 1 },
        { path: 'r6/scripts/b.reds', size: 1 },
        { path: 'R6/Scripts/B.reds', size: 1 }
      ]
    })

    expect(groups).toHaveLength(1)
    expect(groups[0].files).toEqual([{ path: 'r6/scripts/b.reds', size: 1, changed: true }])
  })
})

describe('scanning and cleaning the game folder', () => {
  let dir: string
  let gamePath: string
  let manifests: ManifestStore
  const trashed: string[] = []
  const trash = async (file: string): Promise<void> => {
    trashed.push(file)
    await unlink(file)
  }

  const game = (path: string): string => join(gamePath, ...path.split('/'))

  async function put(path: string, content = 'x'): Promise<void> {
    await mkdir(dirname(game(path)), { recursive: true })
    await writeFile(game(path), content)
  }

  function manifestOwning(...paths: string[]): Manifest {
    return {
      version: 1,
      modId: randomUUID(),
      gamePath,
      status: 'deployed',
      files: paths.map((path) => ({ path, source: path, method: 'link', backedUp: false })),
      folders: []
    }
  }

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ncm-leftovers-'))
    gamePath = join(dir, 'game')
    manifests = new ManifestStore(join(dir, 'manifests'))
    trashed.length = 0
    await put('bin/x64/Cyberpunk2077.exe')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('finds runtime files in folders we created, with their sizes', async () => {
    await manifests.setCreatedFolders(['red4ext', 'red4ext/logs'])
    await put('red4ext/logs/red4ext.log', 'hello')
    await put('red4ext/config.ini', 'abc')

    const groups = await scanLeftovers(manifests, gamePath)

    expect(groups.map((group) => group.folder)).toEqual(['red4ext', 'red4ext/logs'])
    expect(groups[1].files).toEqual([{ path: 'red4ext/logs/red4ext.log', size: 5, changed: false }])
  })

  it('never lists files outside the folders we created', async () => {
    await put('r6/cache/final.redscripts')
    expect(await scanLeftovers(manifests, gamePath)).toEqual([])
  })

  it('lists a kept file only while it is still there', async () => {
    await manifests.addKeptFiles(['r6/cache/inputUserMappings.xml', 'r6/cache/gone.xml'])
    await put('r6/cache/inputUserMappings.xml')

    const groups = await scanLeftovers(manifests, gamePath)

    expect(groups.flatMap((group) => group.files.map((file) => file.path))).toEqual([
      'r6/cache/inputUserMappings.xml'
    ])
  })

  it('trashes the chosen files and removes the folders that are left empty', async () => {
    await manifests.setCreatedFolders(['bin/x64/plugins/cyber_engine_tweaks/mods/Mod'])
    await put('bin/x64/plugins/cyber_engine_tweaks/mods/Mod/data/db.sqlite3')
    await put('bin/x64/plugins/cyber_engine_tweaks/mods/Mod/settings.json')

    const result = await cleanLeftovers(
      manifests,
      gamePath,
      [
        'bin/x64/plugins/cyber_engine_tweaks/mods/Mod/data/db.sqlite3',
        'bin/x64/plugins/cyber_engine_tweaks/mods/Mod/settings.json'
      ],
      trash
    )

    expect(result).toEqual({ trashed: 2, failed: [] })
    expect(await exists(game('bin/x64/plugins/cyber_engine_tweaks/mods/Mod'))).toBe(false)
    expect(await exists(game('bin/x64/plugins/cyber_engine_tweaks/mods'))).toBe(true)
    expect(await manifests.createdFolders()).toEqual([])
  })

  it('ignores paths that are not leftovers, even if the renderer sends them', async () => {
    await manifests.setCreatedFolders(['red4ext'])
    await manifests.write(manifestOwning('red4ext/RED4ext.dll'))
    await put('red4ext/RED4ext.dll')

    const result = await cleanLeftovers(
      manifests,
      gamePath,
      ['red4ext/RED4ext.dll', 'bin/x64/Cyberpunk2077.exe', '../outside.txt'],
      trash
    )

    expect(result).toEqual({ trashed: 0, failed: [] })
    expect(trashed).toEqual([])
    expect(await exists(game('red4ext/RED4ext.dll'))).toBe(true)
  })

  it('keeps going after a file fails and reports it', async () => {
    await manifests.setCreatedFolders(['red4ext'])
    await put('red4ext/a.log')
    await put('red4ext/b.log')
    const failFirst = async (file: string): Promise<void> => {
      if (file.endsWith('a.log')) throw new Error('in use')
      await trash(file)
    }

    const result = await cleanLeftovers(
      manifests,
      gamePath,
      ['red4ext/a.log', 'red4ext/b.log'],
      failFirst
    )

    expect(result).toEqual({ trashed: 1, failed: [{ path: 'red4ext/a.log', error: 'in use' }] })
    expect(await manifests.createdFolders()).toEqual(['red4ext'])
  })

  it('forgets kept files once they are trashed', async () => {
    await manifests.addKeptFiles(['r6/cache/inputUserMappings.xml'])
    await put('r6/cache/inputUserMappings.xml')
    await put('r6/cache/final.redscripts')

    await cleanLeftovers(manifests, gamePath, ['r6/cache/inputUserMappings.xml'], trash)

    expect(await manifests.keptFiles()).toEqual([])
    expect(await exists(game('r6/cache/final.redscripts'))).toBe(true)
  })

  it('cleans only folders that no deployed mod uses', async () => {
    await manifests.setCreatedFolders(['red4ext', 'r6/scripts'])
    await manifests.write(manifestOwning('red4ext/RED4ext.dll'))
    await put('red4ext/RED4ext.dll')
    await put('red4ext/logs/red4ext.log')
    await put('r6/scripts/Old/settings.json')

    expect(await cleanUnusedLeftovers(manifests, gamePath, trash)).toEqual({
      trashed: 1,
      failed: []
    })
    expect(await exists(game('red4ext/logs/red4ext.log'))).toBe(true)
    expect(await exists(game('r6/scripts'))).toBe(false)
    expect(await manifests.createdFolders()).toEqual(['red4ext'])
  })
  it("cleans only the removed mod's own leftovers", async () => {
    const mine = 'bin/x64/plugins/cyber_engine_tweaks/mods/Mine'
    const other = 'bin/x64/plugins/cyber_engine_tweaks/mods/Other'
    await manifests.setCreatedFolders([mine, other])
    await put(`${mine}/settings.json`)
    await put(`${other}/settings.json`)
    await put('r6/cache/mine.xml')
    await manifests.addKeptFiles(['r6/cache/mine.xml'])

    const result = await cleanModLeftovers(
      manifests,
      gamePath,
      { folders: [mine], kept: ['r6/cache/mine.xml'] },
      trash
    )

    expect(result).toEqual({ trashed: 2, failed: [] })
    expect(await exists(game(mine))).toBe(false)
    expect(await exists(game(`${other}/settings.json`))).toBe(true)
    expect(await manifests.createdFolders()).toEqual([other])
  })
})
