import { execFile } from 'child_process'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { promisify } from 'util'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { stageArchive } from './staging'

const execFileAsync = promisify(execFile)
const SEVEN_ZIP = join(process.cwd(), 'resources', '7zip', '7z.exe')

let work: string
let mods: string

beforeEach(async () => {
  work = await mkdtemp(join(tmpdir(), 'ncm-staging-'))
  mods = join(work, 'modss')
})

afterEach(async () => {
  await rm(work, { recursive: true, force: true })
})

async function makeZip(
  name: string,
  files: Record<string, string>,
  password?: string
): Promise<string> {
  const src = join(work, `src-${name}`)
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(src, path)), { recursive: true })
    await writeFile(join(src, path), content)
  }

  const zip = join(work, name)
  const passwordArgs = password ? [`-p${password}`] : []
  await execFileAsync(SEVEN_ZIP, ['a', '-tzip', '-bso0', ...passwordArgs, zip, '*'], { cwd: src })
  return zip
}

describe('stageArchive', () => {
  it('extracts everything into the mod folder and leaves not temp folder', async () => {
    const zip = await makeZip('ok.zip', { 'archive/pc/mod/a.archive': 'x', 'readme.txt': 'r' })

    const folder = await stageArchive(SEVEN_ZIP, zip, mods, 'Faster Elevators')

    expect(folder).toBe(join(mods, 'Faster Elevators'))
    expect(await readdir(mods)).toEqual(['Faster Elevators'])
    expect(await readdir(folder, { recursive: true })).toContain(
      join('archive', 'pc', 'mod', 'a.archive')
    )
  })

  it('fails fast on an excrypted archive and cleans up', async () => {
    const zip = await makeZip('enc.zip', { 'a.archive': 'x' }, 'secret')
    await expect(stageArchive(SEVEN_ZIP, zip, mods, 'Enc')).rejects.toThrow(/Wrong password/)
    expect(await readdir(mods)).toEqual([])
  })

  it('fails on a file that is not an archive and cleans up', async () => {
    const fake = join(work, 'fake.zip')
    await writeFile(fake, 'not an archive')

    await expect(stageArchive(SEVEN_ZIP, fake, mods, 'Fake')).rejects.toThrow()
    expect(await readdir(mods, { withFileTypes: false }).catch(() => [])).toEqual([])
  })
})
