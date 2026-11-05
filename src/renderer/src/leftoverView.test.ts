import { describe, expect, it } from 'vitest'
import type { LeftoverGroup } from '@shared/types'
import { defaultSelection, formatSize, selectedTotals, toggleFiles } from './leftoversView'

const groups: LeftoverGroup[] = [
  {
    folder: 'red4ext',
    inUse: false,
    files: [
      { path: 'red4ext/config.ini', size: 300, changed: false },
      { path: 'red4ext/logs/a.log', size: 2048, changed: false }
    ]
  },
  {
    folder: 'bin/x64/plugins/cyber_engine_tweaks/mods/AMM',
    inUse: false,
    files: [
      { path: 'bin/x64/plugins/cyber_engine_tweaks/mods/AMM/db.sqlite3', size: 10, changed: true }
    ]
  },
  {
    folder: 'r6/tweaks',
    inUse: true,
    files: [{ path: 'r6/tweaks/x.log', size: 5, changed: false }]
  }
]

describe('formatSize', () => {
  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1536, '1.5 KB'],
    [18 * 1024 * 1024, '18.0 MB'],
    [3 * 1024 ** 3, '3.0 GB']
  ])('%i bytes is %s', (bytes, text) => {
    expect(formatSize(bytes)).toBe(text)
  })
})

describe('defaultSelection', () => {
  it('selects files in unused folders, but not changed mod files', () => {
    expect([...defaultSelection(groups)]).toEqual(['red4ext/config.ini', 'red4ext/logs/a.log'])
  })
})

describe('toggleFiles and selectedTotals', () => {
  it('adds and removes paths without changing the old set', () => {
    const before = new Set(['red4ext/config.ini'])
    const after = toggleFiles(before, ['red4ext/config.ini', 'r6/tweaks/x.log'], false)
    expect([...before]).toEqual(['red4ext/config.ini'])
    expect([...toggleFiles(after, ['r6/tweaks/x.log'], true)]).toEqual(['r6/tweaks/x.log'])
  })

  it('counts and sums the selected files', () => {
    expect(selectedTotals(groups, defaultSelection(groups))).toEqual({ count: 2, size: 2348 })
  })
})
