import { describe, expect, it } from 'vitest'
import type { ModRecord } from '@shared/types'
import { afterRemoval, checkVersionLink, linkedTo, rootOf } from './versionLinks'

function mod(id: string, versionOf?: string, nexusModId: number | null = null): ModRecord {
  return {
    id,
    name: id,
    version: null,
    nexusModId,
    archive: `${id}.zip`,
    folder: id,
    plan: { providers: [], files: [], types: [], ignored: [], unmatched: [], warnings: [] },
    importedAt: '2026-11-01T00:00:00.000Z',
    versionOf
  }
}

const byIdOf = (mods: ModRecord[]): Map<string, ModRecord> =>
  new Map(mods.map((entry) => [entry.id, entry]))

describe('rootOf', () => {
  it('follows links to the mod the chain starts from', () => {
    const mods = [
      mod('cet', undefined, 107),
      mod('renamed', 'cet'),
      mod('renamed again', 'renamed')
    ]
    expect(rootOf(mods[2], byIdOf(mods)).id).toBe('cet')
  })

  it('ignores a link on a mod with a Nexus name', () => {
    const mods = [mod('a'), mod('nexus', 'a', 107)]
    expect(rootOf(mods[1], byIdOf(mods)).id).toBe('nexus')
  })

  it('stops at a missing mod and survives a loop', () => {
    const missing = [mod('a', 'gone')]
    expect(rootOf(missing[0], byIdOf(missing)).id).toBe('a')

    const loop = [mod('a', 'b'), mod('b', 'a')]
    expect(['a', 'b']).toContain(rootOf(loop[0], byIdOf(loop)).id)
  })
})

describe('linkedTo', () => {
  it('lists the mod and every mod linked to it', () => {
    const mods = [mod('root'), mod('child', 'root'), mod('grandchild', 'child'), mod('other')]
    expect(linkedTo('root', mods)).toEqual(['root', 'child', 'grandchild'])
  })
})

describe('checkVersionLink', () => {
  const nobody = (): boolean => false

  it('refuses archives with a Nexus name', () => {
    const nexus = mod('cet', undefined, 107)
    expect(() => checkVersionLink(nexus, mod('x'), [nexus], [], nobody)).toThrow(/Nexus/)
  })

  it('refuses a link to itself or to one of its own versions', () => {
    const mods = [mod('root'), mod('child', 'root')]
    expect(() => checkVersionLink(mods[0], mods[0], mods, [], nobody)).toThrow(/already a version/)
    expect(() => checkVersionLink(mods[0], mods[1], mods, [], nobody)).toThrow(/already a version/)
  })

  it('refuses a link that would leave two deployed versions of one mod', () => {
    const mods = [mod('renamed'), mod('cet', undefined, 107), mod('cet old', undefined, 107)]
    const groups = [{ key: 'nexus:107', modIds: ['cet', 'cet old'] }]
    const deployed = (id: string): boolean => id === 'renamed' || id === 'cet old'

    expect(() => checkVersionLink(mods[0], mods[1], mods, groups, deployed)).toThrow(
      'Only one version of a mod can be deployed. Undeploy renamed or cet old first.'
    )
    expect(() => checkVersionLink(mods[0], mods[1], mods, groups, nobody)).not.toThrow()
  })

  it('always allows removing a link', () => {
    const linked = mod('renamed', 'cet')
    expect(() => checkVersionLink(linked, null, [linked], [], () => true)).not.toThrow()
  })
})

describe('afterRemoval', () => {
  it('re-points the versions of a removed mod to the mod it was a version of', () => {
    const mods = [mod('root'), mod('middle', 'root'), mod('leaf', 'middle')]
    expect(afterRemoval(mods, 'middle').map((entry) => entry.versionOf)).toEqual([
      undefined,
      'root'
    ])
  })

  it('re-points them to another Nexus version of the removed mod', () => {
    const mods = [mod('cet', undefined, 107), mod('cet old', undefined, 107), mod('renamed', 'cet')]
    expect(afterRemoval(mods, 'cet').find((entry) => entry.id === 'renamed')?.versionOf).toBe(
      'cet old'
    )
  })

  it('keeps the remaining versions together when the removed one was the start', () => {
    const mods = [mod('root'), mod('a', 'root'), mod('b', 'root')]
    const rest = afterRemoval(mods, 'root')
    expect(rest.map((entry) => [entry.id, entry.versionOf])).toEqual([
      ['a', undefined],
      ['b', 'a']
    ])
  })
})
