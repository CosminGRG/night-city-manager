import { mkdtemp, readdir, readFile, rename, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readJsonFile, writeJsonFile } from './jsonFile'

vi.mock('fs/promises', async (importOriginal) => {
  const real = await importOriginal<typeof import('fs/promises')>()
  return { ...real, rename: vi.fn(real.rename) }
})

function locked(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${code}: operation not permitted, rename`), { code })
}

let dir: string
let file: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-json-'))
  file = join(dir, 'data', 'test.json')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('jsonFile', () => {
  it('returns null for a missing file', async () => {
    expect(await readJsonFile(file)).toBeNull()
  })

  it('writes and reads back, creating the folder', async () => {
    await writeJsonFile(file, { a: 1 })
    expect(await readJsonFile(file)).toEqual({ a: 1 })
  })

  it('keeps the last of several overlapping writes', async () => {
    await Promise.all([1, 2, 3, 4, 5].map((n) => writeJsonFile(file, { n })))
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ n: 5 })
  })

  it('renames a corrupt file and returns null', async () => {
    await writeJsonFile(file, {})
    await writeFile(file, '{ not json')
    expect(await readJsonFile(file)).toBeNull()
    expect(await readdir(join(dir, 'data'))).toEqual(['test.json.corrupt'])
  })

  it('waits and tries again while Windows has the file locked', async () => {
    vi.mocked(rename).mockRejectedValueOnce(locked('EPERM')).mockRejectedValueOnce(locked('EBUSY'))

    await writeJsonFile(file, { a: 1 })

    expect(await readJsonFile(file)).toEqual({ a: 1 })
  })

  it('gives up on other errors at once', async () => {
    vi.mocked(rename).mockRejectedValueOnce(locked('ENOSPC'))

    await expect(writeJsonFile(file, { a: 1 })).rejects.toThrow('ENOSPC')
  })
})
