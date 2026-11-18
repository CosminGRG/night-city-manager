import { describe, expect, it } from 'vitest'
import { createTranslator } from '@shared/i18n/translate'
import type { ModRecord, ModType, NexusRequirement } from '@shared/types'
import {
  requirementBadges,
  missingForBulkDeploy,
  deployNotice,
  deployMessage,
  brokenBy,
  undeployWarning,
  type RequirementContext
} from './requirementsView'

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
  return {
    library: [],
    installed: [],
    deployments: {},
    nexus: {},
    t: createTranslator('en'),
    ...overrides
  }
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

describe('missingForBulkDeploy', () => {
  it('lists required mods that nothing will provide, per mod', () => {
    const nexus = {
      34858: [requires(12345, 'Blur Begone')],
      2557: [requires(4575, 'Input Loader', true)]
    }
    const installed = context({ nexus, installed: ['archivexl', 'redscript'] })

    expect(missingForBulkDeploy([refract, alwaysFirstEquip], installed)).toEqual([
      { mod: refract, missing: ['Blur Begone'] }
    ])
  })

  it('does not count what is in the library, because Deploy all deploys it too', () => {
    const library = context({ library: [radioPack, radioExt], installed: ['cet'] })
    expect(missingForBulkDeploy([radioPack], library)).toEqual([])
  })
})

describe('deployNotice', () => {
  it('says what a freshly deployed mod still needs', () => {
    const notice = deployNotice(
      radioPack,
      context({ library: [radioPack, radioExt], installed: ['cet'] })
    )
    expect(notice).toBe(
      'Outrun Waves is deployed, but it still needs: RadioExt (in your library, not deployed).'
    )
  })

  it('stays quiet when everything required is there', () => {
    const nexus = { 2557: [requires(4575, 'Input Loader', true)] }
    const installed = context({ nexus, installed: ['archivexl', 'redscript'] })
    expect(deployNotice(alwaysFirstEquip, installed)).toBeNull()
  })
})

describe('deployMessage', () => {
  const ready = context({ library: [radioPack, radioExt], installed: ['cet', 'radioext'] })

  it('says what was deployed along with the mod', () => {
    expect(deployMessage(radioPack, ['RadioExt 2.92'], ready)).toEqual({
      text: 'Also deployed what Outrun Waves needs: RadioExt 2.92.',
      tone: 'info'
    })
  })

  it('warns about what is still missing, after saying what was deployed', () => {
    const nexus = { 34858: [requires(12345, 'Blur Begone'), requires(4575, 'Input Loader')] }
    const message = deployMessage(
      refract,
      ['Input Loader'],
      context({ nexus, installed: ['inputloader'] })
    )
    expect(message).toEqual({
      text: 'Also deployed what ReFRACT needs: Input Loader. ReFRACT is deployed, but it still needs: Blur Begone.',
      tone: 'warning'
    })
  })

  it('says nothing when nothing was added and nothing is missing', () => {
    expect(deployMessage(radioPack, [], ready)).toBeNull()
  })
})

describe('undeployWarning', () => {
  it('names deployed mods that needed the mod just switched off', () => {
    const afterUndeploy = context({
      library: [radioPack, radioExt],
      installed: ['cet'],
      deployments: { 'Outrun Waves': 'deployed' }
    })
    expect(undeployWarning(radioExt, afterUndeploy)).toBe(
      'Outrun Waves still needs RadioExt 2.92 and may not work without it.'
    )
  })

  it('stays quiet when another copy still provides it, or nothing deployed needs it', () => {
    const stillInstalled = context({
      library: [radioPack, radioExt],
      installed: ['cet', 'radioext'],
      deployments: { 'Outrun Waves': 'deployed' }
    })
    expect(undeployWarning(radioExt, stillInstalled)).toBeNull()

    const packOff = context({ library: [radioPack, radioExt], installed: ['cet'] })
    expect(undeployWarning(radioExt, packOff)).toBeNull()
  })

  it('follows Nexus requirements, and ignores problems the mod did not cause', () => {
    const nexus = { 34858: [requires(12345, 'Blur Begone'), requires(4575, 'Input Loader')] }
    const afterRemove = context({
      library: [refract],
      nexus,
      deployments: { ReFRACT: 'deployed' }
    })

    expect(brokenBy(blurBegone, afterRemove)).toEqual(['ReFRACT'])
    expect(brokenBy(radioExt, afterRemove)).toEqual([])
  })
})
