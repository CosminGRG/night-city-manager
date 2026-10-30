import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectInstalledFrameworks } from './frameworks'

let game: string

beforeEach(async () => {
  game = await mkdtemp(join(tmpdir(), 'ncm-game-'))
})

afterEach(async () => {
  await rm(game, { recursive: true, force: true })
})

async function touch(path: string): Promise<void> {
  await mkdir(dirname(join(game, path)), { recursive: true })
  await writeFile(join(game, path), '')
}

describe('detectIntalledFrameworks', () => {
  it('finds framworks by their signature files, ignoring case', async () => {
    await touch('bin/x64/plugins/cyber_engine_tweaks.asi')
    await touch('red4ext/RED4ext.dll')
    await touch('red4ext/plugins/ArchiveXL/ArchiveXL.dll')

    expect(await detectInstalledFrameworks(game)).toEqual(['cet', 'red4ext', 'archivexl'])
  })

  it('does not count a folder named like a signature file', async () => {
    await mkdir(join(game, 'engine', 'tools', 'scc.exe'), { recursive: true })
    expect(await detectInstalledFrameworks(game)).toEqual([])
  })

  it('returns nothing for an empty game folder', async () => {
    expect(await detectInstalledFrameworks(game)).toEqual([])
  })
})
