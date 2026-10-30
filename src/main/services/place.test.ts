import { link, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { linkOrCopy } from './place'

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>()
  return { ...actual, link: vi.fn(actual.link) }
})

let dir: string
let source: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-place-'))
  source = join(dir, 'staging', 'a.archive')
  await mkdir(join(dir, 'staging'), { recursive: true })
  await writeFile(source, 'mod data')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('linkOrCopy', () => {
  it('hard links on the smae drive, creating the folders', async () => {
    const target = join(dir, 'game', 'archive', 'pc', 'mod', 'a.archive')

    expect(await linkOrCopy(source, target)).toBe('link')
    expect((await stat(target)).nlink).toBe(2)
  })

  it('copies when linking fails, eg. across drives', async () => {
    vi.mocked(link).mockRejectedValueOnce(
      Object.assign(new Error('corss-device'), { code: 'EXDEV' })
    )
    const target = join(dir, 'game', 'a.archive')

    expect(await linkOrCopy(source, target)).toBe('copy')
    expect(await readFile(target, 'utf8')).toBe('mod data')
    expect((await stat(target)).nlink).toBe(1)
  })

  it('never overwrites and existing file', async () => {
    const target = join(dir, 'game', 'a.archive')
    await mkdir(join(dir, 'game'), { recursive: true })
    await writeFile(target, 'game file')

    await expect(linkOrCopy(source, target)).rejects.toMatchObject({ code: 'EEXIST' })
    expect(await readFile(target, 'utf8')).toBe('game file')
  })
})
