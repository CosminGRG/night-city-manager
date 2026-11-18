import { describe, expect, it } from 'vitest'
import type {
  BisectStatus,
  DeployStatus,
  Framework,
  ModRecord,
  NexusRequirement
} from '@shared/types'
import { createTranslator } from '@shared/i18n/translate'
import {
  bisectCandidates,
  defaultSuspects,
  namesOf,
  roundCount,
  roundSummary,
  neededBy
} from './bisectView'

function mod(
  id: string,
  name: string,
  providers: Framework[] = [],
  targets: string[] = []
): ModRecord {
  const files = targets.map((target) => ({ source: target, target }))
  return {
    id,
    name,
    version: null,
    nexusModId: null,
    archive: `${name}.zip`,
    folder: name,
    plan: { providers, files, types: [], ignored: [], unmatched: [], warnings: [] },
    importedAt: '2026-11-05T00:00:00.000Z'
  }
}

const MODS = [
  mod('cet', 'Cyber Engine Tweaks', ['cet']),
  mod('va', 'VirtualAtelier'),
  mod('a', 'Appearance Menu Mod'),
  mod('b', 'Better Netrunning'),
  mod('c', 'Crash Fix')
]

const DEPLOYED: Record<string, DeployStatus> = {
  cet: 'deployed',
  va: 'deployed',
  a: 'deployed',
  b: 'deploying'
}

describe('bisectCandidates', () => {
  it('offers deployed mods that are not core mods, in mod list order', () => {
    expect(bisectCandidates(MODS, DEPLOYED).map((m) => m.id)).toEqual(['va', 'a'])
  })
})

describe('defaultSuspects', () => {
  it('keeps mods that other mods build on switched on, whatever their archive is called', () => {
    const library = [
      mod('va', 'VA 1.6.4 renamed', [], ['r6/scripts/virtual-atelier-full/Config.reds']),
      mod('il', 'Input Loader', [], ['red4ext/plugins/input_loader/input_loader.dll']),
      mod('rx', 'RadioExt', [], ['bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/init.lua'])
    ]
    const pack = mod(
      'pack',
      'Radio pack',
      [],
      ['bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/radios/Station/song.mp3']
    )
    expect(defaultSuspects([...library, pack, mod('a', 'A')], {})).toEqual(new Set(['pack', 'a']))
  })

  it('keeps mods on that another tested mod requires on Nexus', () => {
    const refract = { ...mod('refract', 'ReFRACT'), nexusModId: 34858 }
    const blurBegone = { ...mod('blur', 'Blur Begone'), nexusModId: 12345 }
    const browserExtension = { ...mod('browser', 'Browser Extension'), nexusModId: 10038 }
    const nexus: Record<number, NexusRequirement[]> = {
      34858: [
        { nexusId: 12345, name: 'Blur Begone', optional: false },
        { nexusId: 10038, name: 'Browser Extension', optional: true }
      ]
    }

    const candidates = [refract, blurBegone, browserExtension]
    expect(defaultSuspects(candidates, nexus)).toEqual(new Set(['refract', 'browser']))
  })
})

describe('neededBy', () => {
  it('names the tested mods that need a mod, from files and from Nexus', () => {
    const radioExt = mod(
      'rx',
      'RadioExt',
      [],
      ['bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/init.lua']
    )
    const pack = mod(
      'pack',
      'Outrun Waves',
      [],
      ['bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/radios/Station/song.mp3']
    )
    const selfListed = { ...mod('self', 'Self'), nexusModId: 1 }
    const nexus = { 1: [{ nexusId: 1, name: 'Self', optional: false }] }

    expect(neededBy(radioExt, [radioExt, pack], {})).toEqual(['Outrun Waves'])
    expect(neededBy(selfListed, [selfListed], nexus)).toEqual([])
  })
})

describe('roundCount', () => {
  it('counts the game launches, plus one for the check round', () => {
    expect(roundCount(1, true)).toBe(0)
    expect(roundCount(2, false)).toBe(1)
    expect(roundCount(9, false)).toBe(4)
    expect(roundCount(8, true)).toBe(4)
  })
})

const t = createTranslator('en')

describe('namesOf', () => {
  it('names mods that left the library too', () => {
    expect(namesOf(['a', 'gone'], MODS, t)).toEqual(['Appearance Menu Mod', 'A removed mod'])
  })
})

describe('roundSummary', () => {
  const testing = (checking: boolean): Extract<BisectStatus, { kind: 'testing' }> => ({
    kind: 'testing',
    round: 1,
    checking,
    suspects: ['a', 'b', 'c'],
    off: checking ? ['a', 'b', 'c'] : ['a', 'b'],
    roundsLeft: 2
  })

  it('says how many mods are off', () => {
    expect(roundSummary(testing(true), t)).toBe('All 3 tested mods are switched off.')
    expect(roundSummary(testing(false), t)).toBe('2 of the 3 remaining suspects are switched off.')
    expect(roundSummary({ ...testing(false), suspects: ['a', 'b'], off: ['a'] }, t)).toBe(
      '1 of the 2 remaining suspects is switched off.'
    )
  })
})
