import { describe, expect, it } from 'vitest'
import type { DeployStatus, ModRecord } from '@shared/types'
import { checkState, selectedMods, selectionCounts, toggleAll } from './selection'

function mod(id: string, files = 1): ModRecord {
  return {
    id,
    name: id,
    version: null,
    nexusModId: null,
    archive: `${id}.zip`,
    folder: id,
    plan: {
      providers: [],
      files: Array.from({ length: files }, (_, i) => ({ source: `f${i}`, target: `f${i}` })),
      types: [],
      ignored: [],
      unmatched: [],
      warnings: []
    },
    importedAt: '2026-11-20T00:00:00.000Z'
  }
}

describe('checkState', () => {
  it('is none, some or all for the rows in view', () => {
    const view = ['a', 'b', 'c']

    expect(checkState(new Set(), view)).toBe('none')
    expect(checkState(new Set(['b']), view)).toBe('some')
    expect(checkState(new Set(['a', 'b', 'c']), view)).toBe('all')
    expect(checkState(new Set(['x']), view)).toBe('none')
    expect(checkState(new Set(), [])).toBe('none')
  })
})

describe('toggleAll', () => {
  it('selects the whole view, or clears it when everything is selected', () => {
    const view = ['a', 'b']

    expect([...toggleAll(new Set(['a']), view)]).toEqual(['a', 'b'])
    expect([...toggleAll(new Set(['a', 'b']), view)]).toEqual([])
  })
})

describe('selectedMods', () => {
  it('keeps only selected mods that are still in view', () => {
    const mods = [mod('a'), mod('b')]
    expect(selectedMods(mods, new Set(['b', 'gone'])).map((m) => m.id)).toEqual(['b'])
  })
})

describe('selectionCounts', () => {
  it('counts what each button would really touch', () => {
    const mods = [mod('on'), mod('off'), mod('empty', 0), mod('stuck')]
    const deployments: Record<string, DeployStatus> = { on: 'deployed', stuck: 'deploying' }

    expect(selectionCounts(mods, deployments)).toEqual({ deploy: 1, purge: 2, remove: 4 })
  })
})
