import { describe, expect, it } from 'vitest'
import type { Framework, ModRecord, ModType } from '@shared/types'
import type { RequirementBadge } from './requirementsView'
import {
  inView,
  matchesTypes,
  modFacts,
  nextSort,
  statusRank,
  viewCounts,
  type ModFacts
} from './modFilters'

function mod(
  types: ModType[] = [],
  providers: Framework[] = [],
  warnings: string[] = []
): ModRecord {
  return {
    id: 'm',
    name: 'M',
    version: null,
    nexusModId: null,
    archive: 'm.zip',
    folder: 'm',
    plan: { providers, files: [], types, ignored: [], unmatched: [], warnings },
    importedAt: '2026-11-20T00:00:00.000Z'
  }
}

function badge(state: RequirementBadge['state'], optional = false): RequirementBadge {
  return { key: 'x', label: 'X', state, optional, title: '' }
}

const facts = (deployed: boolean, attention = false, update = false): ModFacts => ({
  deployed,
  attention,
  update
})

describe('modFacts', () => {
  it('flags interrupted deploys and plan warnings', () => {
    expect(modFacts(mod(), 'deploying', [], false).attention).toBe(true)
    expect(modFacts(mod([], [], ['Two variants']), undefined, [], false).attention).toBe(true)
    expect(modFacts(mod(), 'deployed', [], true)).toEqual(facts(true, false, true))
  })

  it('flags a missing required mod only when the mod is deployed', () => {
    expect(modFacts(mod(), 'deployed', [badge('missing')], false).attention).toBe(true)
    expect(modFacts(mod(), undefined, [badge('missing')], false).attention).toBe(false)
    expect(modFacts(mod(), 'deployed', [badge('missing', true)], false).attention).toBe(false)
    expect(modFacts(mod(), 'deployed', [badge('met')], false).attention).toBe(false)
  })
})

describe('views', () => {
  it('sorts rows into tabs and counts them', () => {
    const list = [facts(true), facts(false, true), facts(true, false, true), facts(false)]

    expect(list.filter((item) => inView('active', item))).toHaveLength(2)
    expect(viewCounts(list)).toEqual({ all: 4, active: 2, inactive: 2, attention: 1, updates: 1 })
  })
})

describe('matchesTypes', () => {
  it('matches any chosen type, and "core" for framework mods', () => {
    expect(matchesTypes(mod(['archive']), [])).toBe(true)
    expect(matchesTypes(mod(['archive', 'cet']), ['cet', 'redmod'])).toBe(true)
    expect(matchesTypes(mod(['archive']), ['cet'])).toBe(false)
    expect(matchesTypes(mod([], ['cet']), ['core'])).toBe(true)
  })
})

describe('nextSort', () => {
  it('goes ascending, descending, then back to the default order', () => {
    const ascending = nextSort(null, 'name')
    expect(ascending).toEqual({ column: 'name', descending: false })

    const descending = nextSort(ascending, 'name')
    expect(descending).toEqual({ column: 'name', descending: true })

    expect(nextSort(descending, 'name')).toBeNull()
    expect(nextSort(descending, 'imported')).toEqual({ column: 'imported', descending: false })
  })
})

describe('statusRank', () => {
  it('puts problems first, then deployed, then the rest', () => {
    expect(statusRank(facts(true, true))).toBe(0)
    expect(statusRank(facts(true))).toBe(1)
    expect(statusRank(facts(false))).toBe(2)
    expect(statusRank(undefined)).toBe(2)
  })
})
