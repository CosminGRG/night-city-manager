import { describe, expect, it } from 'vitest'
import type { ModRecord, ModType } from '@shared/types'
import type { Dependency } from '@shared/requirements'
import { requirementBadges } from './requirementsView'

function mod(name: string, types: ModType[], targets: string[] = []): ModRecord {
  return {
    id: name,
    name,
    version: null,
    nexusModId: null,
    archive: `${name}.zip`,
    folder: name,
    plan: {
      providers: [],
      types,
      files: targets.map((target) => ({ source: target, target })),
      ignored: [],
      unmatched: [],
      warnings: []
    },
    importedAt: '2026-11-05T00:00:00.000Z'
  }
}

const radioPack = mod(
  'Outrun Waves',
  ['cet'],
  ['bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/radios/Station/song.mp3']
)
const radioExt = mod(
  'RadioExt 2.92',
  ['cet', 'red4ext'],
  ['bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/init.lua']
)
const alwaysFirstEquip = mod('Always First Equip', ['archive', 'archivexl', 'input', 'redscript'])
const inputLoader = mod(
  'Input Loader',
  ['red4ext'],
  ['red4ext/plugins/input_loader/input_loader.dll']
)

const states = (badges: ReturnType<typeof requirementBadges>): string[] =>
  badges.map((badge) => `${badge.key}:${badge.state}`)

describe('requirementBadges', () => {
  it('shows installed non-framework dependencies as met', () => {
    const installed: Dependency[] = ['cet', 'radioext']
    expect(requirementBadges(radioPack, [radioPack], installed)).toEqual([
      {
        key: 'radioext',
        label: 'RadioExt',
        state: 'met',
        title: 'RadioExt is installed.'
      }
    ])
  })

  it('hides installed frameworks, because the type badges already show them', () => {
    const installed: Dependency[] = ['archivexl', 'redscript', 'inputloader']
    expect(states(requirementBadges(alwaysFirstEquip, [], installed))).toEqual(['inputloader:met'])
  })

  it('shows a framework only when it is missing', () => {
    const badges = requirementBadges(alwaysFirstEquip, [], ['inputloader'])
    expect(states(badges)).toEqual(['archivexl:missing', 'redscript:missing', 'inputloader:met'])
    expect(badges[0].title).toBe('ArchiveXL is not installed. Get it on Nexus Mods.')
  })

  it('names the library mod that would provide a dependency that is not deployed', () => {
    const [badge] = requirementBadges(radioPack, [radioPack, radioExt], ['cet'])
    expect(badge.state).toBe('not-deployed')
    expect(badge.title).toBe('RadioExt is in your library (RadioExt 2.92) but not deployed.')
  })

  it('lists missing first, then not deployed, then met', () => {
    const both = mod(
      'Both',
      ['input'],
      ['bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/radios/Station/song.mp3']
    )
    expect(states(requirementBadges(both, [inputLoader], []))).toEqual([
      'radioext:missing',
      'inputloader:not-deployed'
    ])
  })

  it('sends REDmod users to their game store, not to Nexus', () => {
    const [badge] = requirementBadges(mod('A REDmod', ['redmod']), [], [])
    expect(badge.title).toBe('REDmod DLC is not installed. It is free in your game store.')
  })

  it('shows nothing for a mod that needs nothing', () => {
    expect(requirementBadges(mod('Plain', ['archive']), [], [])).toEqual([])
  })
})
