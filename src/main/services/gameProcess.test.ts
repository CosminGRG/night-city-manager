import { EventEmitter } from 'events'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  GAME_IMAGE,
  isImageListed,
  launchEnvironment,
  launchExe,
  readLaunchEnvironment,
  type StartProcess
} from './gameProcess'

describe('isImageListed', () => {
  it('finds the game in tasklist CSV output', () => {
    const output = '"Cyberpunk2077.exe","11480","Console","1","3,456,789 K"\r\n'
    expect(isImageListed(output, GAME_IMAGE)).toBe(true)
  })

  it('ignores case', () => {
    expect(isImageListed('"cyberpunk2077.EXE","1","Console","1","1 K"\r\n', GAME_IMAGE)).toBe(true)
  })

  it.each([
    'INFO: No tasks are running which match the specified criteria.\r\n',
    'INFORMATION: Es werden keine Aufgaben mit den angegebenen Kriterien ausgeführt.\r\n',
    '"Cyberpunk2077Launcher.exe","1","Console","1","1 K"\r\n',
    ''
  ])('is false for %j', (output) => {
    expect(isImageListed(output, GAME_IMAGE)).toBe(false)
  })
})

describe('launchExe', () => {
  function fakeProcess(): EventEmitter & { unref: Mock<() => void> } {
    return Object.assign(new EventEmitter(), { unref: vi.fn<() => void>() })
  }

  it('starts the game on its own, from its folder, and lets it outlive the app', async () => {
    const child = fakeProcess()
    const start = vi.fn<StartProcess>(() => child)

    const launched = launchExe(
      'E:\\Game\\bin\\x64\\Cyberpunk2077.exe',
      ['-modded'],
      { SteamAppId: '1091500' },
      start
    )
    child.emit('spawn')
    await launched

    expect(start).toHaveBeenCalledWith('E:\\Game\\bin\\x64\\Cyberpunk2077.exe', ['-modded'], {
      cwd: 'E:\\Game\\bin\\x64',
      env: expect.objectContaining({ SteamAppId: '1091500' }),
      detached: true,
      stdio: 'ignore'
    })
    expect(child.unref).toHaveBeenCalled()
  })

  it('reports a game that could not be started', async () => {
    const child = fakeProcess()
    const launched = launchExe('E:\\Game\\bin\\x64\\Cyberpunk2077.exe', [], {}, () => child)
    child.emit('error', new Error('spawn UNKNOWN'))

    await expect(launched).rejects.toThrow('spawn UNKNOWN')
  })
})

describe('launchEnvironment', () => {
  it("gives a Steam install the game's app id, like Steam does", () => {
    expect(launchEnvironment({ platform: 'steam', gameId: 'cyberpunk2077' })).toEqual({
      SteamAppId: '1091500',
      SteamGameId: '1091500'
    })
  })

  it.each([{ platform: 'gog' }, { platform: 'epic' }, {}, null, 'steam', []])(
    'adds nothing for %j',
    (config) => {
      expect(launchEnvironment(config)).toEqual({})
    }
  )
})

describe('readLaunchEnvironment', () => {
  let game: string

  beforeEach(async () => {
    game = await mkdtemp(join(tmpdir(), 'ncm-launch-'))
  })

  afterEach(async () => {
    await rm(game, { recursive: true, force: true })
  })

  it("reads the store from the game's launcher configuration", async () => {
    const config =
      '{\r\n  "platform": "steam",\r\n  "executablePath": "bin\\\\x64\\\\Cyberpunk2077.exe"\r\n}'
    await writeFile(join(game, 'launcher-configuration.json'), config)

    expect(await readLaunchEnvironment(game)).toEqual({
      SteamAppId: '1091500',
      SteamGameId: '1091500'
    })
  })

  it('adds nothing when the file is missing or broken', async () => {
    expect(await readLaunchEnvironment(game)).toEqual({})

    await writeFile(join(game, 'launcher-configuration.json'), '{ not json')
    expect(await readLaunchEnvironment(game)).toEqual({})
  })
})
