import { describe, expect, it } from 'vitest'
import type { BisectStatus, DeployStatus, Framework, ModRecord } from '@shared/types'
import { bisectCandidates, defaultSuspects, namesOf, roundCount, roundSummary } from './bisectView'

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
    expect(defaultSuspects([...library, pack, mod('a', 'A')])).toEqual(new Set(['pack', 'a']))
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

describe('namesOf', () => {
  it('names mods that left the library too', () => {
    expect(namesOf(['a', 'gone'], MODS)).toEqual(['Appearance Menu Mod', 'A removed mod'])
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
    expect(roundSummary(testing(true))).toBe('All 3 tested mods are switched off.')
    expect(roundSummary(testing(false))).toBe('2 of the 3 remaining suspects are switched off.')
  })
})
