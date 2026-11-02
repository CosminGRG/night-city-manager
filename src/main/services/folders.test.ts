import { mkdir, mkdtemp, stat, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { removeEmptyFolders, missingFolders, removeEmptyTree, removeIfEmpty } from './folders'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'nmc-folders-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

describe('removeEmptyFolders', () => {
  it('removes the listed empty folders deepest first', async () => {
    const mod = join(dir, 'r6', 'scripts', 'Mod')
    const sub = join(mod, 'sub')
    await mkdir(sub, { recursive: true })

    await removeEmptyFolders([mod, sub])

    expect(await exists(mod)).toBe(false)
    expect(await exists(join(dir, 'r6', 'scripts'))).toBe(true)
  })

  it('keeps a folder that gained other files', async () => {
    const radios = join(dir, 'radioExt', 'radios')
    await mkdir(radios, { recursive: true })
    await writeFile(join(radios, 'my station.mp3'), 'music')

    await removeEmptyFolders([radios])

    expect(await exists(join(radios, 'my station.mp3'))).toBe(true)
  })

  it('ignores folders that are already gone', async () => {
    await expect(removeEmptyFolders([join(dir, 'gone')])).resolves.toBeUndefined()
  })
})

describe('missingFolders', () => {
  it('lists each folder that does not exist yet, once, deepest first', async () => {
    const game = join(dir, 'game')
    await mkdir(join(game, 'archive', 'pc'), { recursive: true })

    const missing = await missingFolders(game, [
      join(game, 'archive', 'pc', 'mod', 'a.archive'),
      join(game, 'archive', 'pc', 'mod', 'b.archive'),
      join(game, 'r6', 'scripts', 'M', 'a.reds')
    ])

    expect(missing).toEqual([
      join(game, 'archive', 'pc', 'mod'),
      join(game, 'r6', 'scripts', 'M'),
      join(game, 'r6', 'scripts'),
      join(game, 'r6')
    ])
  })
})

describe('removeEmptyTree', () => {
  it('removes empty folders and keeps any that still hold files', async () => {
    const backups = join(dir, 'backups')
    await mkdir(join(backups, 'bin', 'x64'), { recursive: true })
    await mkdir(join(backups, 'r6', 'scripts'), { recursive: true })
    await writeFile(join(backups, 'r6', 'scripts', 'kept.reds'), 'x')

    await removeEmptyTree(backups)

    expect(await exists(join(backups, 'bin'))).toBe(false)
    expect(await exists(join(backups, 'r6', 'scripts', 'kept.reds'))).toBe(true)
  })
})

describe('removeIfEmpty', () => {
  it('removes an empty folder', async () => {
    await mkdir(join(dir, 'empty'))
    expect(await removeIfEmpty(join(dir, 'empty'))).toBe(true)
    expect(await exists(join(dir, 'empty'))).toBe(false)
  })

  it('keeps a folder that holds a file', async () => {
    await mkdir(join(dir, 'full'))
    await writeFile(join(dir, 'full', 'settings.json'), '{}')
    expect(await removeIfEmpty(join(dir, 'full'))).toBe(false)
    expect(await exists(join(dir, 'full', 'settings.json'))).toBe(true)
  })

  it('treats a folder that is already gone as removed', async () => {
    expect(await removeIfEmpty(join(dir, 'missing'))).toBe(true)
  })
})
