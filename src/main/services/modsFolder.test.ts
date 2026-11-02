import { randomUUID } from 'crypto'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ModRecord } from '@shared/types'
import { exists } from './folders'
import { checkNewModsFolder, copyModFolders, moveMods, sameDrive } from './modsFolder'

let dir: string
let from: string
let to: string

function makeMod(folder: string): ModRecord {
  return {
    id: randomUUID(),
    name: folder,
    version: null,
    nexusModId: null,
    archive: `${folder}.zip`,
    folder,
    plan: { providers: [], files: [], types: [], ignored: [], unmatched: [], warnings: [] },
    importedAt: new Date().toISOString()
  }
}

async function put(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

async function stagedMods(...names: string[]): Promise<ModRecord[]> {
  const mods = names.map(makeMod)
  for (const mod of mods)
    await put(join(from, mod.folder, 'archive', 'pc', 'mod', 'a.archive'), mod.name)
  return mods
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-modsfolder-'))
  from = join(dir, 'mods')
  to = join(dir, 'new-mods')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('sameDrive', () => {
  it('compares drive letters, ignoring case', () => {
    expect(sameDrive('E:\\Games\\Cyberpunk 2077', 'e:/NightCityManager/mods')).toBe(true)
    expect(sameDrive('E:\\Games\\Cyberpunk 2077', 'D:\\mods')).toBe(false)
  })
})

describe('checkNewModsFolder', () => {
  const game = 'E:\\Games\\Cyberpunk 2077'

  it('accepts a new or empty folder', async () => {
    await expect(checkNewModsFolder(to, from, game)).resolves.toBeUndefined()
  })

  it.each([
    ['the current folder', () => from, /already your mods folder/],
    ['a folder inside it', () => join(from, 'sub'), /current mods folder/],
    ['a folder around it', () => dir, /current mods folder/],
    ['the game folder', () => game, /outside the game folder/],
    ['a folder inside the game', () => `${game}\\mods-here`, /outside the game folder/]
  ])('refuses %s', async (_name, target, message) => {
    await expect(checkNewModsFolder(target(), from, game)).rejects.toThrow(message)
  })

  it('refuses a folder that is not empty', async () => {
    await put(join(to, 'something.txt'), 'x')
    await expect(checkNewModsFolder(to, from, game)).rejects.toThrow(/empty folder/)
  })
})

describe('moveMods', () => {
  it('moves every mod folder and removes the old mods folder', async () => {
    const mods = await stagedMods('First', 'Second')
    let committed = 0

    await moveMods(from, to, mods, async () => {
      committed++
    })

    expect(committed).toBe(1)
    expect((await readdir(to)).sort()).toEqual(['First', 'Second'])
    expect(await readFile(join(to, 'Second', 'archive', 'pc', 'mod', 'a.archive'), 'utf8')).toBe(
      'Second'
    )
    expect(await exists(from)).toBe(false)
  })

  it('skips a mod whose folder is missing', async () => {
    const [present] = await stagedMods('Present')
    await moveMods(from, to, [present, makeMod('Missing')], async () => {})
    expect(await readdir(to)).toEqual(['Present'])
  })

  it('puts everything back when saving the setting fails', async () => {
    const mods = await stagedMods('First', 'Second')

    await expect(
      moveMods(from, to, mods, async () => {
        throw new Error('disk full')
      })
    ).rejects.toThrow('disk full')

    expect((await readdir(from)).sort()).toEqual(['First', 'Second'])
    expect(await readdir(to)).toEqual([])
  })
})

describe('copyModFolders', () => {
  it('copies every mod folder and leaves the originals', async () => {
    const mods = await stagedMods('First', 'Second')
    await copyModFolders(from, to, mods)
    expect((await readdir(to)).sort()).toEqual(['First', 'Second'])
    expect((await readdir(from)).sort()).toEqual(['First', 'Second'])
  })

  it('removes what it copied when a later mod fails', async () => {
    const [first] = await stagedMods('First')
    const outside = makeMod('..\\outside')

    await expect(copyModFolders(from, to, [first, outside])).rejects.toThrow(
      /outside the mods folder/
    )

    expect(await readdir(to)).toEqual([])
    expect(await readdir(from)).toEqual(['First'])
  })
})
