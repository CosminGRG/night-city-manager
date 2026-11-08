import { mkdir, mkdtemp, rm, utimes, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkCrashReports, findLog, logTitle, newestLogs, scanLogs, type FoundLog } from './logs'

const CET = 'bin/x64/plugins/cyber_engine_tweaks'

function log(path: string, time: string, size = 100): FoundLog {
  return { path, size, modifiedMs: Date.parse(time) }
}

describe('logTitle', () => {
  it('drops the launch date and the extension', () => {
    expect(logTitle('red4ext/logs/red4ext-2026-11-07-17-30-15.log')).toBe('red4ext')
    expect(logTitle('red4ext/plugins/ArchiveXL/ArchiveXL-2026-11-07-17-30-17.log')).toBe(
      'ArchiveXL'
    )
    expect(logTitle('r6/logs/redscript_r2026-11-07_17-30-24.log')).toBe('redscript')
    expect(logTitle('r6/logs/redscript_rCURRENT.log')).toBe('redscript')
    expect(logTitle(`${CET}/cyber_engine_tweaks.log`)).toBe('cyber_engine_tweaks')
  })
})

describe('newestLogs', () => {
  it('keeps the newest log of each kind and counts the older ones', () => {
    const logs = newestLogs([
      log('red4ext/logs/red4ext-2026-11-07-17-05-13.log', '2026-11-07T17:06:00Z'),
      log('red4ext/logs/red4ext-2026-11-07-17-30-15.log', '2026-11-07T17:34:00Z', 3146),
      log('red4ext/logs/red4ext-2026-11-07-17-07-21.log', '2026-11-07T17:10:00Z')
    ])

    expect(logs).toEqual([
      {
        path: 'red4ext/logs/red4ext-2026-11-07-17-30-15.log',
        title: 'red4ext',
        source: 'red4ext',
        modifiedAt: '2026-11-07T17:34:00.000Z',
        size: 3146,
        older: 2
      }
    ])
  })

  it('goes by the time a log was written, not by its name', () => {
    const [redscript] = newestLogs([
      log('r6/logs/redscript_r2026-11-07_17-30-24.log', '2026-11-07T17:07:00Z'),
      log('r6/logs/redscript_rCURRENT.log', '2026-11-07T17:30:00Z')
    ])

    expect(redscript.path).toBe('r6/logs/redscript_rCURRENT.log')
    expect(redscript.older).toBe(1)
  })

  it('keeps logs of different kinds in one folder apart', () => {
    const logs = newestLogs([
      log('red4ext/logs/red4ext-2026-11-07-17-30-15.log', '2026-11-07T17:34:00Z'),
      log('red4ext/logs/skipradioinput-2026-11-07-17-30-40.log', '2026-11-07T17:30:00Z'),
      log(`${CET}/mods/nativeSettings/nativeSettings.log`, '2026-11-07T17:08:00Z')
    ])

    expect(logs.map((entry) => `${entry.source}:${entry.title}`)).toEqual([
      'cet:nativeSettings',
      'red4ext:red4ext',
      'red4ext:skipradioinput'
    ])
  })

  it('ignores files that are not logs or are outside the log folders', () => {
    expect(
      newestLogs([
        log(`${CET}/config.json`, '2026-11-07T17:00:00Z'),
        log('red4ext/config.ini', '2026-11-07T17:00:00Z'),
        log('archive/pc/mod/notes.log', '2026-11-07T17:00:00Z')
      ])
    ).toEqual([])
  })

  it('lists CET first, then redscript, then RED4ext, each by name', () => {
    const logs = newestLogs([
      log('red4ext/plugins/TweakXL/TweakXL-2026-11-07-17-30-19.log', '2026-11-07T17:30:00Z'),
      log('r6/logs/redscript_rCURRENT.log', '2026-11-07T17:30:00Z'),
      log(`${CET}/scripting.log`, '2026-11-07T17:34:00Z'),
      log('red4ext/plugins/ArchiveXL/ArchiveXL-2026-11-07-17-30-17.log', '2026-11-07T17:32:00Z'),
      log(`${CET}/cyber_engine_tweaks.log`, '2026-11-07T17:34:00Z')
    ])

    expect(logs.map((entry) => entry.title)).toEqual([
      'cyber_engine_tweaks',
      'scripting',
      'redscript',
      'ArchiveXL',
      'TweakXL'
    ])
  })
})

describe('logs on disk', () => {
  const NEWEST = 'red4ext/logs/red4ext-2026-11-07-17-30-15.log'
  const OLDER = 'red4ext/logs/red4ext-2026-11-07-17-05-13.log'
  let gamePath: string
  let crashDir: string

  beforeEach(async () => {
    gamePath = await mkdtemp(join(tmpdir(), 'ncm-logs-'))
    crashDir = await mkdtemp(join(tmpdir(), 'ncm-crashes-'))
  })

  afterEach(async () => {
    await rm(gamePath, { recursive: true, force: true })
    await rm(crashDir, { recursive: true, force: true })
  })

  async function put(path: string, time: string, content = 'log'): Promise<void> {
    const file = join(gamePath, path)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, content)
    await utimes(file, new Date(time), new Date(time))
  }

  async function putRunLogs(): Promise<void> {
    await put(OLDER, '2026-11-07T17:06:00Z')
    await put(NEWEST, '2026-11-07T17:34:00Z', 'newest')
    await put('red4ext/RED4ext.dll', '2026-11-07T17:00:00Z')
  }

  async function putCrash(name: string, time: string): Promise<void> {
    const folder = join(crashDir, name)
    await mkdir(folder)
    await utimes(folder, new Date(time), new Date(time))
  }

  it('finds the newest logs', async () => {
    await putRunLogs()
    await put(`${CET}/scripting.log`, '2026-11-07T17:34:00Z')
    await put(`${CET}/config.json`, '2026-11-07T17:34:00Z')

    const { logs } = await scanLogs(gamePath, crashDir)

    expect(logs.map((log) => [log.path, log.size, log.older])).toEqual([
      [`${CET}/scripting.log`, 3, 0],
      [NEWEST, 6, 1]
    ])
    expect(logs[1].modifiedAt).toBe('2026-11-07T17:34:00.000Z')
  })

  it('counts crash reports and says when the last one happened', async () => {
    await putCrash('Cyberpunk2077-20261025-220113-4076-25248', '2026-10-25T22:01:00Z')
    await putCrash('Cyberpunk2077-20261025-220650-33248-19004', '2026-10-25T22:06:00Z')
    await writeFile(join(crashDir, 'notes.txt'), 'not a report')

    const { crashReports, lastCrashAt } = await scanLogs(gamePath, crashDir)

    expect(crashReports).toBe(2)
    expect(lastCrashAt).toBe('2026-10-25T22:06:00.000Z')
  })

  it('finds nothing in a game that never ran with mods', async () => {
    const missing = join(crashDir, 'missing')
    expect(await scanLogs(gamePath, missing)).toEqual({
      logs: [],
      crashReports: 0,
      lastCrashAt: null
    })
  })

  it('only hands out logs that are in the list', async () => {
    await putRunLogs()

    expect(await findLog(gamePath, NEWEST.toUpperCase())).toBe(join(gamePath, NEWEST))
    await expect(findLog(gamePath, OLDER)).rejects.toThrow('no longer there')
    await expect(findLog(gamePath, 'red4ext/RED4ext.dll')).rejects.toThrow('no longer there')
    await expect(findLog(gamePath, '../../Windows/notepad.exe')).rejects.toThrow()
    await expect(findLog(gamePath, 42)).rejects.toThrow('Invalid log.')
  })

  it('opens the crash reports folder only when it has reports', async () => {
    await expect(checkCrashReports(crashDir)).rejects.toThrow('no crash reports')

    await putCrash('Cyberpunk2077-20261025-220113-4076-25248', '2026-10-25T22:01:00Z')
    expect(await checkCrashReports(crashDir)).toBe(crashDir)
  })
})
