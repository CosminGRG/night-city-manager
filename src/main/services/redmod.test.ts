import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModRecord } from '@shared/types'
import {
  checkDeploy,
  compileRedMods,
  deployArgs,
  otherRedModFolders,
  redModExe,
  redModFolders,
  type RunProcess
} from './redmod'

const GAME = 'E:\\SteamLibrary\\steamapps\\common\\Cyberpunk 2077'

function mod(id: string, targets: string[]): ModRecord {
  return {
    id,
    name: id,
    version: null,
    nexusModId: null,
    archive: `${id}.zip`,
    folder: id,
    plan: {
      providers: [],
      files: targets.map((target) => ({ source: target, target })),
      types: [],
      ignored: [],
      unmatched: [],
      warnings: []
    },
    importedAt: '2026-11-12T00:00:00.000Z'
  }
}

// Real layout: NCA-Lite ships a REDmod folder plus one plain archive.
const NCA = mod('nca', [
  'archive/pc/mod/bike_fix.archive',
  'mods/NIGHT CITY ALIVE/info.json',
  'mods/NIGHT CITY ALIVE/tweaks/base/gameplay/static_data/database/ai/aigeneralsettings.tweak'
])

// Real output of a successful and a failed run (2026-11-12).
const SUCCESS = {
  code: 0,
  stdout:
    '[DEPLOY] Stage 1/5 - Initialization\r\nNeeds deployment: false\r\n\r\nCommandlet deploy has succeeded.\r\n',
  stderr: ''
}
const FAILURE = {
  code: 131072,
  stdout: '[DEPLOY] Stage 1/5 - Initialization\r\n\r\nCommandlet deploy has failed.\r\n',
  stderr: 'Non-existant mod selected: "DOES NOT EXIST"!\r\n'
}

describe('redModFolders', () => {
  it('lists the REDmod folders of deployed mods, in mod list order', () => {
    const other = mod('other', [
      'mods/Better Cars/info.json',
      'mods/better cars/archives/a.archive'
    ])
    const off = mod('off', ['mods/Not Deployed/info.json'])
    const deployed = (id: string): boolean => id !== 'off'

    expect(redModFolders([other, off, NCA], deployed)).toEqual(['Better Cars', 'NIGHT CITY ALIVE'])
  })

  it('ignores files lying directly in the mods folder', () => {
    expect(redModFolders([mod('odd', ['mods/readme.txt'])], () => true)).toEqual([])
  })
})

describe('deployArgs', () => {
  it('puts the quotes around the values, the way redMod.exe reads them', () => {
    expect(deployArgs(GAME, ['NIGHT CITY ALIVE', 'Better Cars'])).toEqual([
      'deploy',
      `-root="${GAME}"`,
      '-mod="NIGHT CITY ALIVE"',
      '-mod="Better Cars"'
    ])
  })

  it('refuses a name with a quote in it', () => {
    expect(() => deployArgs(GAME, ['Bad"Name'])).toThrow('Bad"Name')
  })
})

describe('checkDeploy', () => {
  it('accepts a successful run', () => {
    expect(() => checkDeploy(SUCCESS)).not.toThrow()
  })

  it('reports the reason redMod.exe gives', () => {
    expect(() => checkDeploy(FAILURE)).toThrow(
      'REDmod could not compile your mods: Non-existant mod selected: "DOES NOT EXIST"!'
    )
  })

  it('does not trust "succeeded" when redMod.exe did not see the game folder', () => {
    const misread = {
      ...SUCCESS,
      stderr: 'No root specified, using default root path.\r\nInvalid root path found: ...'
    }
    expect(() => checkDeploy(misread)).toThrow('No root specified')
  })

  it('explains a run that was stopped for taking too long', () => {
    expect(() => checkDeploy({ code: null, stdout: '', stderr: '' })).toThrow('took too long')
  })
})

describe('with a game folder', () => {
  let game: string

  beforeEach(async () => {
    game = await mkdtemp(join(tmpdir(), 'ncm-redmod-'))
  })

  afterEach(async () => {
    await rm(game, { recursive: true, force: true })
  })

  async function put(path: string): Promise<void> {
    await mkdir(join(game, path, '..'), { recursive: true })
    await writeFile(join(game, path), '')
  }

  it('finds REDmod mods placed by hand, but not ours or plain folders', async () => {
    await put('mods/NIGHT CITY ALIVE/info.json')
    await put('mods/Manual Mod/info.json')
    await put('mods/Another One/info.json')
    await put('mods/Not A Mod/readme.txt')
    await put('mods/.stub')

    expect(await otherRedModFolders(game, ['night city alive'])).toEqual([
      'Another One',
      'Manual Mod'
    ])
  })

  it('finds nothing when there is no mods folder', async () => {
    expect(await otherRedModFolders(game, [])).toEqual([])
  })

  it('runs redMod.exe from the game with the folders in order', async () => {
    await put('tools/redmod/bin/redMod.exe')
    const run = vi.fn<RunProcess>(async () => SUCCESS)

    await compileRedMods(game, ['NIGHT CITY ALIVE'], run)

    expect(run).toHaveBeenCalledWith(redModExe(game), [
      'deploy',
      `-root="${game}"`,
      '-mod="NIGHT CITY ALIVE"'
    ])
  })

  it('asks for the REDmod DLC when redMod.exe is missing', async () => {
    const run = vi.fn<RunProcess>(async () => SUCCESS)
    await expect(compileRedMods(game, ['NIGHT CITY ALIVE'], run)).rejects.toThrow('REDmod DLC')
    expect(run).not.toHaveBeenCalled()
  })
})
