import { mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { stageArchive } from './staging'
import { makeZip, SEVEN_ZIP } from './testArchives'

let work: string
let mods: string

beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), 'ncm-staging-'))
  mods = join(work, 'modss')
})

afterEach(async () => {
  await rm(work, { recursive: true, force: true })
})

describe('stageArchive', () => {
  it('extracts everything into the mod folder and leaves not temp folder', async () => {
    const zip = await makeZip(work, 'ok.zip', {
      'archive/pc/mod/a.archive': 'x',
      'readme.txt': 'r'
    })

    const folder = await stageArchive(SEVEN_ZIP, zip, mods, 'Faster Elevators')

    expect(folder).toBe(join(mods, 'Faster Elevators'))
    expect(await readdir(mods)).toEqual(['Faster Elevators'])
    expect(await readdir(folder, { recursive: true })).toContain(
      join('archive', 'pc', 'mod', 'a.archive')
    )
  })

  it('fails fast on an excrypted archive and cleans up', async () => {
    const zip = await makeZip(work, 'enc.zip', { 'a.archive': 'x' }, 'secret')
    await expect(stageArchive(SEVEN_ZIP, zip, mods, 'Enc')).rejects.toThrow('password-protected')

    expect(await readdir(mods)).toEqual([])
  })

  it('fails on a file that is not an archive and cleans up', async () => {
    const fake = join(work, 'fake.zip')
    await writeFile(fake, 'not an archive')

    await expect(stageArchive(SEVEN_ZIP, fake, mods, 'Fake')).rejects.toThrow()
    expect(await readdir(mods, { withFileTypes: false }).catch(() => [])).toEqual([])
  })
})
