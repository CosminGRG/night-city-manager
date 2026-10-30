import { mkdir, mkdtemp, readFile, rename, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backUp, backupPathFor, moveFile, restore } from './backups'

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return { ...actual, rename: vi.fn(actual.rename) }
})

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-backups-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function put(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

describe('moveFile', () => {
  it('moves a file and creates the target folders', async () => {
    await put(join(dir, 'a.dll'), 'data')

    await moveFile(join(dir, 'a.dll'), join(dir, 'deep', 'folder', 'a.dll'))

    expect(await readFile(join(dir, 'deep', 'folder', 'a.dll'), 'utf8')).toBe('data')
    expect(await exists(join(dir, 'a.dll'))).toBe(false)
  })

  it('copies and then deletes when rename fails across drives', async () => {
    vi.mocked(rename).mockRejectedValueOnce(
      Object.assign(new Error('cross-device'), { code: 'EXDEV' })
    )
    await put(join(dir, 'a.dll'), 'data')

    await moveFile(join(dir, 'a.dll'), join(dir, 'other', 'a.dll'))

    expect(await readFile(join(dir, 'other', 'a.dll'), 'utf8')).toBe('data')
    expect(await exists(join(dir, 'a.dll'))).toBe(false)
  })

  it('refuses to replace an existing file', async () => {
    await put(join(dir, 'new.dll'), 'new')
    await put(join(dir, 'old.dll'), 'original')

    await expect(moveFile(join(dir, 'new.dll'), join(dir, 'old.dll'))).rejects.toThrow(
      /already exists/
    )
    expect(await readFile(join(dir, 'old.dll'), 'utf8')).toBe('original')
    expect(await readFile(join(dir, 'new.dll'), 'utf8')).toBe('new')
  })
})

describe('backup and restore', () => {
  it('moves a game file into the backup and back again', async () => {
    const target = join(dir, 'game', 'bin', 'x64', 'version.dll')
    const backup = join(dir, 'backups', 'bin', 'x64', 'version.dll')
    await put(target, 'manual CET')

    expect(await backUp(target, backup)).toBe(true)
    expect(await exists(target)).toBe(false)

    expect(await restore(backup, target)).toBe(true)
    expect(await readFile(target, 'utf8')).toBe('manual CET')
    expect(await exists(backup)).toBe(false)
  })

  it('returns flase when tehre is nothing to back up or restore', async () => {
    const target = join(dir, 'game', 'a.archive')
    const backup = join(dir, 'backups', 'a.archive')

    expect(await backUp(target, backup)).toBe(false)
    expect(await restore(backup, target)).toBe(false)
  })

  it('refuses to back up a folder', async () => {
    const target = join(dir, 'game', 'r6', 'scripts')
    await mkdir(target, { recursive: true })

    await expect(backUp(target, join(dir, 'backups', 'r6', 'scripts'))).rejects.toThrow(/folder/)
  })
})

describe('backupPathFor', () => {
  it('mirrors the game path inside the backup folder', () => {
    expect(backupPathFor('D:\\data\\backups\\id', 'bin/x64/version.dll')).toBe(
      'D:\\data\\backups\\id\\bin\\x64\\version.dll'
    )
  })

  it('refuses a path that leaves the backup folder', () => {
    expect(() => backupPathFor('D:\\data\\backups\\id', '../../evil.dll')).toThrow(/leaves/)
  })
})
