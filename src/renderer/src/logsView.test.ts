import { describe, expect, it } from 'vitest'
import type { LogFile, LogSource } from '@shared/types'
import { formatWhen, groupLogs } from './logsView'

function log(source: LogSource, title: string): LogFile {
  return {
    path: `${title}.log`,
    title,
    source,
    modifiedAt: '2026-11-07T15:34:00.000Z',
    size: 100,
    older: 0
  }
}

describe('groupLogs', () => {
  it('groups logs by source, in the order main sorted them', () => {
    const groups = groupLogs([
      log('cet', 'cyber_engine_tweaks'),
      log('cet', 'scripting'),
      log('redscript', 'redscript'),
      log('red4ext', 'ArchiveXL')
    ])

    expect(groups.map((group) => [group.label, group.logs.map((entry) => entry.title)])).toEqual([
      ['Cyber Engine Tweaks', ['cyber_engine_tweaks', 'scripting']],
      ['redscript', ['redscript']],
      ['RED4ext', ['ArchiveXL']]
    ])
  })

  it('leaves out sources without logs', () => {
    expect(groupLogs([log('red4ext', 'red4ext')]).map((group) => group.source)).toEqual(['red4ext'])
  })
})

describe('formatWhen', () => {
  const now = new Date(2026, 10, 8, 17, 0)
  const at = (...parts: [number, number, number, number, number]): string =>
    new Date(...parts).toISOString()

  it('says how many minutes ago within the last hour', () => {
    expect(formatWhen(at(2026, 10, 8, 16, 59), now)).toBe('1 min ago')
    expect(formatWhen(at(2026, 10, 8, 16, 12), now)).toBe('48 min ago')
    expect(formatWhen(now.toISOString(), now)).toBe('just now')
  })

  it('gives the time for today and yesterday', () => {
    expect(formatWhen(at(2026, 10, 8, 9, 5), now)).toBe('today 09:05')
    expect(formatWhen(at(2026, 10, 7, 23, 10), now)).toBe('yesterday 23:10')
  })

  it('gives the date for older ones, with the year only when it differs', () => {
    expect(formatWhen(at(2026, 9, 25, 22, 28), now)).toBe('25 Oct, 22:28')
    expect(formatWhen(at(2025, 9, 25, 22, 28), now)).toBe('25 Oct 2025, 22:28')
  })

  it('treats a time in the future as just now', () => {
    expect(formatWhen(at(2026, 10, 8, 17, 30), now)).toBe('just now')
  })
})
