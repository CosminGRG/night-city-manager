import { describe, expect, it } from 'vitest'
import type { ModRecord, ModType, Framework, DeployStatus } from '@shared/types'
import { filterMods, pageNumbers, paginate, sortMods, bulkCounts, bulkTargets } from './modListView'

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

describe('sortMods', () => {
  it('puts core mods first and keeps the import order otherwise', () => {
    const mods = [mod('A'), mod('CET', [], ['cet']), mod('B'), mod('RED4ext', [], ['red4ext'])]
    expect(names(sortMods(mods))).toEqual(['CET', 'RED4ext', 'A', 'B'])
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
