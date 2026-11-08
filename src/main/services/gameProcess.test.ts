import { EventEmitter } from 'events'
import { describe, expect, it, vi, type Mock } from 'vitest'
import { GAME_IMAGE, isImageListed, launchExe, type StartProcess } from './gameProcess'

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

    const launched = launchExe('E:\\Game\\bin\\x64\\Cyberpunk2077.exe', start)
    child.emit('spawn')
    await launched

    expect(start).toHaveBeenCalledWith('E:\\Game\\bin\\x64\\Cyberpunk2077.exe', [], {
      cwd: 'E:\\Game\\bin\\x64',
      detached: true,
      stdio: 'ignore'
    })
    expect(child.unref).toHaveBeenCalled()
  })

  it('reports a game that could not be started', async () => {
    const child = fakeProcess()
    const launched = launchExe('E:\\Game\\bin\\x64\\Cyberpunk2077.exe', () => child)
    child.emit('error', new Error('spawn UNKNOWN'))

    await expect(launched).rejects.toThrow('spawn UNKNOWN')
  })
})
