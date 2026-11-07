import { describe, expect, it } from 'vitest'
import type { ModRecord, ModType, NexusRequirement } from '@shared/types'
import { requirementBadges, type RequirementContext } from './requirementsView'

function mod(
  name: string,
  types: ModType[],
  targets: string[] = [],
  nexusModId: number | null = null
): ModRecord {
  return {
    id: name,
    name,
    version: null,
    nexusModId,
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

function context(overrides: Partial<RequirementContext> = {}): RequirementContext {
  return { library: [], installed: [], deployments: {}, nexus: {}, ...overrides }
}

function requires(nexusId: number, name: string, optional = false): NexusRequirement {
  return { nexusId, name, optional }
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
const alwaysFirstEquip = mod(
  'Always First Equip',
  ['archive', 'archivexl', 'input', 'redscript'],
  [],
  2557
)
const inputLoader = mod(
  'Input Loader',
  ['red4ext'],
  ['red4ext/plugins/input_loader/input_loader.dll']
)
const amm = mod(
  'Appearance Menu Mod',
  ['archive', 'archivexl', 'cet', 'redscript'],
  ['bin/x64/plugins/cyber_engine_tweaks/mods/AppearanceMenuMod/init.lua'],
  790
)
const refract = mod('ReFRACT', [], [], 34858)
const blurBegone = mod('Blur Begone', ['archive'], [], 12345)

const states = (badges: ReturnType<typeof requirementBadges>): string[] =>
  badges.map((badge) => `${badge.key}:${badge.state}${badge.optional ? ':optional' : ''}`)

describe('requirementBadges from files', () => {
  it('shows installed non-framework dependencies as met', () => {
    expect(requirementBadges(radioPack, context({ installed: ['cet', 'radioext'] }))).toEqual([
      {
        key: 'radioext',
        label: 'RadioExt',
        state: 'met',
        optional: false,
        title: 'RadioExt is installed.'
      }
    ])
  })

  it('hides installed frameworks, because the type badges already show them', () => {
    const installed = context({ installed: ['archivexl', 'redscript', 'inputloader'] })
    expect(states(requirementBadges(alwaysFirstEquip, installed))).toEqual(['inputloader:met'])
  })

  it('shows a framework only when it is missing', () => {
    const badges = requirementBadges(alwaysFirstEquip, context({ installed: ['inputloader'] }))
    expect(states(badges)).toEqual(['archivexl:missing', 'redscript:missing', 'inputloader:met'])
    expect(badges[0].title).toBe('ArchiveXL is not installed. Get it on Nexus Mods.')
  })

  it('names the library mod that would provide a dependency that is not deployed', () => {
    const [badge] = requirementBadges(
      radioPack,
      context({ library: [radioPack, radioExt], installed: ['cet'] })
    )
    expect(badge.state).toBe('not-deployed')
    expect(badge.title).toBe('RadioExt is in your library (RadioExt 2.92) but not deployed.')
  })

  it('lists missing first, then not deployed, then met', () => {
    const both = mod(
      'Both',
      ['input'],
      ['bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/radios/Station/song.mp3']
    )
    expect(states(requirementBadges(both, context({ library: [inputLoader] })))).toEqual([
      'radioext:missing',
      'inputloader:not-deployed'
    ])
  })

  it('sends REDmod users to their game store, not to Nexus', () => {
    const [badge] = requirementBadges(mod('A REDmod', ['redmod']), context())
    expect(badge.title).toBe('REDmod DLC is not installed. It is free in your game store.')
  })

  it('shows nothing for a mod that needs nothing', () => {
    expect(requirementBadges(mod('Plain', ['archive']), context())).toEqual([])
  })
})

describe('requirementBadges with Nexus requirements', () => {
  const ammOnNexus = {
    790: [
      requires(4198, 'ArchiveXL'),
      requires(7780, 'Codeware'),
      requires(107, 'Cyber Engine Tweaks'),
      requires(35126, 'Appearance Runtime Plugin')
    ]
  }

  it('adds known mods that only the Nexus page reveals', () => {
    const installed = context({
      nexus: ammOnNexus,
      installed: ['archivexl', 'cet', 'redscript', 'appearanceruntime']
    })
    expect(states(requirementBadges(amm, installed))).toEqual([
      'codeware:missing',
      'appearanceruntime:met'
    ])
  })

  it('merges a requirement listed in both files and Nexus into one badge', () => {
    const nexus = { 790: [requires(1511, 'redscript')] }
    const badges = requirementBadges(amm, context({ nexus }))
    expect(badges.filter((badge) => badge.key === 'redscript')).toHaveLength(1)
  })

  it('checks mods outside the known list against the library', () => {
    const nexus = { 34858: [requires(12345, 'Blur Begone')] }
    const library = [refract, blurBegone]

    expect(states(requirementBadges(refract, context({ nexus })))).toEqual(['nexus-12345:missing'])
    expect(states(requirementBadges(refract, context({ nexus, library })))).toEqual([
      'nexus-12345:not-deployed'
    ])
    const deployed = context({ nexus, library, deployments: { 'Blur Begone': 'deployed' } })
    expect(requirementBadges(refract, deployed)).toEqual([
      {
        key: 'nexus-12345',
        label: 'Blur Begone',
        state: 'met',
        optional: false,
        title: 'Blur Begone is deployed.'
      }
    ])
  })

  it('says where to get a mod that is not in the library', () => {
    const nexus = { 34858: [requires(12345, 'Blur Begone')] }
    const [badge] = requirementBadges(refract, context({ nexus }))
    expect(badge.title).toBe('Blur Begone is not in your library. Get it on Nexus Mods.')
  })

  it('trusts the Nexus page when it calls a requirement optional, and lists those last', () => {
    const nexus = {
      2557: [requires(4575, 'Input Loader', true), requires(10038, 'Browser Extension', true)]
    }
    const badges = requirementBadges(alwaysFirstEquip, context({ nexus }))

    expect(states(badges)).toEqual([
      'archivexl:missing',
      'redscript:missing',
      'inputloader:missing:optional',
      'nexus-10038:missing:optional'
    ])
    expect(badges[2].title).toBe('Optional: Input Loader is not installed. Get it on Nexus Mods.')
  })

  it('ignores a page that lists the mod itself', () => {
    const nexus = { 790: [requires(790, 'Appearance Menu Mod')] }
    const installed = context({ nexus, installed: ['archivexl', 'cet', 'redscript'] })
    expect(requirementBadges(amm, installed)).toEqual([])
  })

  it('ignores a requirement the mod provides itself', () => {
    const nexus = { 9999: [requires(4591, 'RadioExt')] }
    const repack = { ...radioExt, nexusModId: 9999 }
    const installed = context({ nexus, installed: ['cet', 'red4ext'] })
    expect(states(requirementBadges(repack, installed))).toEqual([])
  })
})
