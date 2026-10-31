import { copyFile, link, mkdtemp, rename, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isOurFile } from './ownership'

let dir: string
let source: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-owner-'))
  source = join(dir, 'staged.archive')
  await writeFile(source, 'mod data')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('isOurFile', () => {
  it('recognises a hard link to the staged file', async () => {
    const target = join(dir, 'linked.archive')
    await link(source, target)
    expect(await isOurFile(target, source, 'link')).toBe(true)
  })

  it('does not accept an idential copy as our link', async () => {
    const target = join(dir, 'copied.archive')
    await copyFile(source, target)
    expect(await isOurFile(target, source, 'link')).toBe(false)
  })

  it('no longer recognises a link file that a tool replaced', async () => {
    const target = join(dir, 'settings.json')
    await link(source, target)
    await writeFile(`${target}.tmp`, 'new settings')
    await rename(`${target}.tmp`, target)
    expect(await isOurFile(target, source, 'link')).toBe(false)
  })

  it('recognises a copy with the same content', async () => {
    const target = join(dir, 'copied.archive')
    await copyFile(source, target)
    expect(await isOurFile(target, source, 'copy')).toBe(true)
  })

  it('rejects a copy whose content changed, even at the same size', async () => {
    const target = join(dir, 'copied.archive')
    await writeFile(target, 'mod DATA')
    expect(await isOurFile(target, source, 'copy')).toBe(false)
  })

  it('accepts either proof when the method is unknown', async () => {
    const linked = join(dir, 'linked.archive')
    const copied = join(dir, 'copied.archive')
    await link(source, linked)
    await copyFile(source, copied)
    expect(await isOurFile(linked, source, null)).toBe(true)
    expect(await isOurFile(copied, source, null)).toBe(true)
  })

  it('return false when the target or the staged file is gone', async () => {
    expect(await isOurFile(join(dir, 'missing.archive'), source, null)).toBe(false)

    const target = join(dir, 'linked.archive')
    await link(source, target)
    await rm(source)
    expect(await isOurFile(target, source, 'link')).toBe(false)
  })
})
