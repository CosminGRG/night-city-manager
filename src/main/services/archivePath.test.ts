import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkArchivePath } from './archivePath'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-archive-path-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('checkArchivePath', () => {
  it('accepts an existing archive in any case and normalizes the path', async () => {
    const archive = join(dir, 'Mod.ZIP')
    await writeFile(archive, 'x')
    await expect(checkArchivePath(archive.replaceAll('\\', '/'))).resolves.toBe(archive)
  })

  it('refuses a value that is not a string', async () => {
    await expect(checkArchivePath(42)).rejects.toThrow(/must be a string/)
  })

  it.each([
    'mods\\a.zip',
    '\\a.zip',
    'C:a.zip',
    '\\\\server\\share\\a.zip',
    '//server/share/a.zip',
    '\\\\?\\C:\\a.zip'
  ])('refuses %s before touching the disk', async (path) => {
    await expect(checkArchivePath(path)).rejects.toThrow(/full path on a local drive/)
  })

  it('refuses other file types', async () => {
    await writeFile(join(dir, 'setup.exe'), 'x')
    await expect(checkArchivePath(join(dir, 'setup.exe'))).rejects.toThrow(/not a .zip/)
  })

  it('refuses a missing file and a folder', async () => {
    await mkdir(join(dir, 'folder.zip'))
    await expect(checkArchivePath(join(dir, 'missing.zip'))).rejects.toThrow(/was not found/)
    await expect(checkArchivePath(join(dir, 'folder.zip'))).rejects.toThrow(/is not a file/)
  })
})
