import { describe, expect, it } from 'vitest'
import type { ModRecord, VersionGroup } from '@shared/types'
import { currentLink, linkOptions, versionRows } from './versionsView'

function mod(id: string, files = 1): ModRecord {
  return {
    id,
    name: id,
    version: id,
    nexusModId: 1,
    archive: `${id}.zip`,
    folder: id,
    plan: {
      providers: [],
      files: Array.from({ length: files }, () => ({ source: 'a', target: 'a' })),
      types: [],
      ignored: [],
      unmatched: [],
      warnings: []
    },
    importedAt: '2026-11-01T00:00:00.000Z'
  }
}

const shownIds = ({ rows }: ReturnType<typeof versionRows>): string[] =>
  rows.map((row) => row.mod.id)

// Library order: old version imported first. Groups list the newest first.
const mods = [mod('Other'), mod('1.0'), mod('2.0')]
const groups: VersionGroup[] = [
  { key: 'nexus:2', modIds: ['Other'] },
  { key: 'nexus:1', modIds: ['2.0', '1.0'] }
]

describe('versionRows', () => {
  it('shows one row per mod, in library order, with the newest version', () => {
    const result = versionRows(mods, groups, {}, {})

    expect(shownIds(result)).toEqual(['Other', '2.0'])
    expect(result.rows[1].versions.map((version) => version.id)).toEqual(['2.0', '1.0'])
  })

  it('shows the version in the game, whatever was picked', () => {
    const result = versionRows(mods, groups, { '1.0': 'deployed' }, { 'nexus:1': '2.0' })
    expect(shownIds(result)).toEqual(['Other', '1.0'])
  })

  it('shows the picked version while nothing is deployed', () => {
    expect(shownIds(versionRows(mods, groups, {}, { 'nexus:1': '1.0' }))).toEqual(['Other', '1.0'])
  })

  it('ignores a pick that is no longer in the group', () => {
    expect(shownIds(versionRows(mods, groups, {}, { 'nexus:1': 'gone' }))).toEqual(['Other', '2.0'])
  })

  it('tells Deploy all to skip every version but the one main deploys', () => {
    const picked = { 'nexus:1': '1.0' }
    expect(versionRows(mods, groups, {}, picked).skip).toEqual(new Set(['1.0']))

    const noFiles = [mod('Other'), mod('1.0'), mod('2.0', 0)]
    expect(versionRows(noFiles, groups, {}, {}).skip).toEqual(new Set(['2.0']))
  })

  it('shows mods that are in no group yet on their own row', () => {
    const fresh = mod('Just imported')
    const result = versionRows([...mods, fresh], groups, {}, {})
    expect(shownIds(result)).toEqual(['Other', '2.0', 'Just imported'])
  })
})

describe('linkOptions', () => {
  const renamed = { ...mod('renamed'), nexusModId: null }

  it('offers one option per other mod, by name, with its newest version', () => {
    const options = linkOptions(
      renamed,
      [...mods, renamed],
      [...groups, { key: 'mod:renamed', modIds: ['renamed'] }]
    )
    expect(options.map(({ id, key }) => [id, key])).toEqual([
      ['2.0', 'nexus:1'],
      ['Other', 'nexus:2']
    ])
  })

  it('offers the mod it is linked to now, and marks it as the current choice', () => {
    const linked = { ...renamed, versionOf: '1.0' }
    const linkedGroups: VersionGroup[] = [
      { key: 'nexus:2', modIds: ['Other'] },
      { key: 'nexus:1', modIds: ['renamed', '2.0', '1.0'] }
    ]
    const options = linkOptions(linked, [...mods, linked], linkedGroups)

    expect(options.map((option) => option.id)).toEqual(['2.0', 'Other'])
    expect(currentLink(linked, linkedGroups, options)).toBe('2.0')
    expect(currentLink(renamed, linkedGroups, options)).toBeNull()
  })

  it('never offers a mod that is already a version of this one', () => {
    const child = { ...mod('child'), nexusModId: null, versionOf: 'renamed' }
    const options = linkOptions(
      renamed,
      [renamed, child],
      [{ key: 'mod:renamed', modIds: ['renamed', 'child'] }]
    )
    expect(options).toEqual([])
  })
})
