import { mkdir, mkdtemp, stat, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { removeEmptyFolders } from './folders'

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
