import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { detectInstalled } from './frameworks'

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

describe('detectInstalled', () => {
  it('finds framworks by their signature files, ignoring case', async () => {
    await touch('bin/x64/plugins/cyber_engine_tweaks.asi')
    await touch('red4ext/RED4ext.dll')
    await touch('red4ext/plugins/ArchiveXL/ArchiveXL.dll')

    expect(await detectInstalled(game)).toEqual(['cet', 'red4ext', 'archivexl'])
  })

  it('finds other known mods and the REDmod DLC', async () => {
    await touch('red4ext/plugins/input_loader/input_loader.dll')
    await touch('tools/redmod/bin/redMod.exe')

    expect(await detectInstalled(game)).toEqual(['inputloader', 'redmod'])
  })

  it('does not count a folder named like a signature file', async () => {
    await mkdir(join(game, 'engine', 'tools', 'scc.exe'), { recursive: true })
    expect(await detectInstalled(game)).toEqual([])
  })

  it('returns nothing for an empty game folder', async () => {
    expect(await detectInstalled(game)).toEqual([])
  })
})
