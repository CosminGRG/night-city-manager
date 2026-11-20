import { describe, expect, it } from 'vitest'
import type { ModRecord, ModType, Framework, DeployStatus } from '@shared/types'
import {
  filterMods,
  fitRows,
  listRows,
  pageNumbers,
  paginate,
  sortRows,
  bulkCounts,
  bulkTargets,
  type RowOrder
} from './modListView'
import { DEFAULT_LIST_OPTIONS, type ModFacts } from './modFilters'
import type { VersionRow } from './versionsView'

function mod(name: string, types: ModType[] = [], providers: Framework[] = []): ModRecord {
  return {
    id: name,
    name,
    version: '1.0.0',
    nexusModId: null,
    archive: `${name}.zip`,
    folder: name,
    plan: { providers, files: [], types, ignored: [], unmatched: [], warnings: [] },
    importedAt: '2026-10-30T10:00:00.000Z'
  }
}

const names = (mods: ModRecord[]): string[] => mods.map((m) => m.name)

describe('sortRows', () => {
  const imported = (record: ModRecord, day: number): ModRecord => ({
    ...record,
    importedAt: `2026-11-${String(day).padStart(2, '0')}T00:00:00.000Z`
  })
  const row = (shown: ModRecord, versions: ModRecord[] = [shown]): VersionRow => ({
    key: shown.id,
    mod: shown,
    versions
  })
  const shown = (rows: VersionRow[]): string[] => rows.map((r) => r.mod.name)

  const cet = imported(mod('CET', [], ['cet']), 3)
  const red4ext = imported(mod('RED4ext', [], ['red4ext']), 1)
  const a = imported(mod('A', ['redmod']), 2)
  const b = imported(mod('B', ['archive']), 4)
  const rows = [row(a), row(cet), row(b), row(red4ext)]
  const order = (newestFirst: boolean, sort: RowOrder['sort'] = null): RowOrder => ({
    newestFirst,
    sort,
    facts: new Map<string, ModFacts>([['B', { deployed: true, attention: false, update: false }]])
  })

  it('puts core mods first and keeps the import order otherwise', () => {
    expect(shown(sortRows(rows, order(false)))).toEqual(['CET', 'RED4ext', 'A', 'B'])
  })

  it('puts the newest imports first under the core mods, which keep their order', () => {
    expect(shown(sortRows(rows, order(true)))).toEqual(['CET', 'RED4ext', 'B', 'A'])
  })

  it('moves a mod up when a newer version of it was imported', () => {
    const update = imported(mod('A 2.0'), 5)
    expect(shown(sortRows([row(a, [update, a]), row(b)], order(true)))).toEqual(['A', 'B'])
  })

  it('sorts by a column under the pinned core mods, in both directions', () => {
    const byType = order(true, { column: 'type', descending: false })
    expect(shown(sortRows(rows, byType))).toEqual(['CET', 'RED4ext', 'B', 'A'])

    const byNameDown = order(true, { column: 'name', descending: true })
    expect(shown(sortRows(rows, byNameDown))).toEqual(['CET', 'RED4ext', 'B', 'A'])
  })

  it('sorts names with numbers the way people read them', () => {
    const mods = [row(mod('Mod 10')), row(mod('Mod 9'))]
    const byName = order(false, { column: 'name', descending: false })
    expect(shown(sortRows(mods, byName))).toEqual(['Mod 9', 'Mod 10'])
  })
})

describe('listRows', () => {
  const row = (shown: ModRecord): VersionRow => ({ key: shown.id, mod: shown, versions: [shown] })
  const rows = [
    row(mod('Eyes', ['archive'])),
    row(mod('Radio', ['cet'])),
    row(mod('Hair', ['archive']))
  ]
  const order: RowOrder = {
    newestFirst: false,
    sort: null,
    facts: new Map<string, ModFacts>([
      ['Eyes', { deployed: false, attention: true, update: false }],
      ['Radio', { deployed: true, attention: false, update: true }]
    ])
  }
  const listedNames = (listed: { rows: VersionRow[] }): string[] =>
    listed.rows.map((r) => r.mod.name)

  it('shows the chosen tab and counts every tab', () => {
    const listed = listRows(rows, { ...DEFAULT_LIST_OPTIONS, view: 'inactive' }, '', order)

    expect(listedNames(listed)).toEqual(['Eyes', 'Hair'])
    expect(listed.counts).toEqual({ all: 3, active: 1, inactive: 2, attention: 1, updates: 1 })
  })

  it('counts only what the type filter and the search let through', () => {
    const archives = { ...DEFAULT_LIST_OPTIONS, types: ['archive' as const] }
    const listed = listRows(rows, archives, 'hair', order)

    expect(listedNames(listed)).toEqual(['Hair'])
    expect(listed.counts).toEqual({ all: 1, active: 0, inactive: 1, attention: 0, updates: 0 })
  })
})

describe('fitRows', () => {
  it('fits whole 40px rows and never goes below 5', () => {
    expect(fitRows(400)).toBe(10)
    expect(fitRows(439)).toBe(10)
    expect(fitRows(100)).toBe(5)
    expect(fitRows(-20)).toBe(5)
  })
})

describe('filterMods', () => {
  const mods = [
    mod('Faster Elevators', ['archive']),
    mod('RadioExt', ['cet', 'red4ext']),
    mod('Cyber Engine Tweaks', [], ['cet']),
    mod('Always First Equip', ['archive', 'redscript'])
  ]

  it('returns everything for an empty search', () => {
    expect(filterMods(mods, '   ')).toHaveLength(4)
  })

  it('matches the name, ignoring case', () => {
    expect(names(filterMods(mods, 'ELEVATOR'))).toEqual(['Faster Elevators'])
  })

  it('matches type, framework and requirement labels', () => {
    expect(names(filterMods(mods, 'redscript'))).toEqual(['Always First Equip'])
    expect(names(filterMods(mods, 'cyber engine'))).toEqual(['RadioExt', 'Cyber Engine Tweaks'])
  })

  it('needs every word to match, in any order', () => {
    expect(names(filterMods(mods, 'red4ext radio'))).toEqual(['RadioExt'])
  })

  it('finds core mods by the word "core"', () => {
    expect(names(filterMods(mods, 'core'))).toEqual(['Cyber Engine Tweaks'])
  })
})

describe('paginate', () => {
  const twelve = Array.from({ length: 12 }, (_, index) => index + 1)

  it('returns the requested page with its range', () => {
    expect(paginate(twelve, 2, 5)).toEqual({
      items: [6, 7, 8, 9, 10],
      page: 2,
      pageCount: 3,
      total: 12,
      first: 6,
      last: 10
    })
  })

  it('clamps a page that no longer exists', () => {
    expect(paginate(twelve, 9, 5)).toMatchObject({ page: 3, items: [11, 12] })
    expect(paginate(twelve, 0, 5)).toMatchObject({ page: 1 })
  })

  it('handles an empty list', () => {
    expect(paginate([], 1)).toEqual({
      items: [],
      page: 1,
      pageCount: 1,
      total: 0,
      first: 0,
      last: 0
    })
  })
})

describe('pageNumbers', () => {
  it.each([
    [1, 5, [1, 2, 3, 4, 5]],
    [1, 10, [1, 2, 'gap', 10]],
    [5, 10, [1, 'gap', 4, 5, 6, 'gap', 10]],
    [8, 10, [1, 'gap', 7, 8, 9, 10]],
    [4, 8, [1, 2, 3, 4, 5, 'gap', 8]]
  ])('page %i of %i', (page, pageCount, expected) => {
    expect(pageNumbers(page, pageCount)).toEqual(expected)
  })
})

describe('bulkCounts', () => {
  const withFiles = (m: ModRecord): ModRecord => ({
    ...m,
    plan: { ...m.plan, files: [{ source: 'a', target: 'a' }] }
  })

  it('counts what each bulk action would touch', () => {
    const mods = [
      withFiles(mod('CET', [], ['cet'])),
      withFiles(mod('Deployed')),
      withFiles(mod('Fresh')),
      mod('Variants'),
      withFiles(mod('Interrupted'))
    ]
    const deployments: Record<string, DeployStatus> = {
      Deployed: 'deployed',
      Interrupted: 'deploying'
    }

    expect(bulkCounts(mods, deployments)).toEqual({
      deploy: { all: 2, core: 1, 'non-core': 1 },
      purge: { all: 2, core: 0, 'non-core': 2 },
      remove: { all: 5, core: 1, 'non-core': 4 }
    })
  })

  it('hands out the same mods it counts', () => {
    const cet = withFiles(mod('CET', [], ['cet']))
    const fresh = withFiles(mod('Fresh'))
    const deployed = withFiles(mod('Deployed'))
    const deployments: Record<string, DeployStatus> = { Deployed: 'deployed' }

    expect(bulkTargets([cet, fresh, deployed], deployments, 'deploy', 'non-core')).toEqual([fresh])
    expect(bulkTargets([cet, fresh, deployed], deployments, 'purge', 'all')).toEqual([deployed])
  })

  it('does not count versions Deploy all skips, but still removes them', () => {
    const newer = withFiles(mod('Mod 2.0'))
    const older = withFiles(mod('Mod 1.0'))
    const skip = new Set(['Mod 1.0'])

    expect(bulkCounts([newer, older], {}, skip)).toMatchObject({
      deploy: { all: 1 },
      remove: { all: 2 }
    })
  })
})
