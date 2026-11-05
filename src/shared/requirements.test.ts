import { describe, expect, it } from 'vitest'
import type { ModRecord, ModType } from './types'
import {
  KNOWN_DEPENDENCIES,
  needs,
  provides,
  unmetRequirements,
  type Dependency
} from './requirements'

function mod(id: string, types: ModType[], targets: string[] = []): ModRecord {
  return {
    id,
    name: id,
    version: null,
    nexusModId: null,
    archive: `${id}.zip`,
    folder: id,
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

const alwaysFirstEquip = mod('Always First Equip', ['archive', 'archivexl', 'input', 'redscript'])
const inputLoader = mod(
  'Input Loader',
  ['red4ext', 'config'],
  ['red4ext/plugins/input_loader/input_loader.dll', 'engine/config/platform/pc/input_loader.ini']
)
const archiveXl = mod('ArchiveXL', ['red4ext'], ['red4ext/plugins/ArchiveXL/ArchiveXL.dll'])

describe('KNOWN_DEPENDENCIES', () => {
  it('stores paths in lower case, because targets are compared in lower case', () => {
    for (const { file, addons } of Object.values(KNOWN_DEPENDENCIES)) {
      expect(file).toBe(file.toLowerCase())
      if (addons) expect(addons).toBe(addons.toLowerCase())
    }
  })

  it('keeps each signature file inside its own add-on folder', () => {
    for (const { file, addons } of Object.values(KNOWN_DEPENDENCIES)) {
      if (addons) expect(file.startsWith(addons)).toBe(true)
    }
  })
})

describe('needs', () => {
  it('maps file types to the frameworks that load them', () => {
    expect(needs(alwaysFirstEquip.plan)).toEqual(['archivexl', 'inputloader', 'redscript'])
  })

  it('needs nothing for plain archives and config tweaks', () => {
    expect(needs(mod('Plain', ['archive', 'config']).plan)).toEqual([])
  })

  it('needs the REDmod DLC for REDmod mods', () => {
    expect(needs(mod('A REDmod', ['redmod']).plan)).toEqual(['redmod'])
  })

  it('needs the mod whose folder an add-on puts files into', () => {
    const radioPack = mod(
      'Outrun Waves',
      ['archive', 'cet'],
      [
        'archive/pc/mod/OWADS.archive',
        'bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/radios/93.7 Outrun Waves/song.mp3'
      ]
    )
    expect(needs(radioPack.plan)).toEqual(['cet', 'radioext'])
  })

  it('does not count what the mod provides itself', () => {
    const radioExt = mod(
      'RadioExt',
      ['cet'],
      [
        'bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/init.lua',
        'bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/radios/.keep'
      ]
    )
    expect(needs(radioExt.plan)).toEqual(['cet'])
    expect(needs(archiveXl.plan)).toEqual(['red4ext'])
    const redscript = mod('redscript', ['redscript'], ['engine/tools/scc.exe'])
    expect(needs(redscript.plan)).toEqual([])
  })
})

describe('provides', () => {
  it('recognises frameworks and other known mods by their signature files, ignoring case', () => {
    expect(
      provides(mod('Codeware', ['red4ext'], ['red4ext/plugins/Codeware/Codeware.dll']).plan)
    ).toEqual(['codeware'])
    const nativeSettings = mod(
      'Native Settings UI',
      ['cet'],
      ['bin/x64/plugins/cyber_engine_tweaks/mods/nativeSettings/init.lua']
    )
    const virtualAtelier = mod(
      'Virtual Atelier',
      ['archive', 'archivexl', 'redscript'],
      ['archive/pc/mod/VirtualAtelier.archive', 'r6/scripts/virtual-atelier-full/Config.reds']
    )

    expect(provides(virtualAtelier.plan)).toEqual(['virtualatelier'])
    expect(provides(nativeSettings.plan)).toEqual(['nativesettings'])
    expect(provides(inputLoader.plan)).toEqual(['inputloader'])
  })

  it('provides nothing for an ordinary mod', () => {
    expect(provides(mod('Plain', ['archive'], ['archive/pc/mod/plain.archive']).plan)).toEqual([])
  })
})

describe('unmetRequirements', () => {
  it('lists every dependency that is not installed', () => {
    expect(unmetRequirements(alwaysFirstEquip, [], [])).toEqual([
      { dependency: 'archivexl', provider: null },
      { dependency: 'inputloader', provider: null },
      { dependency: 'redscript', provider: null }
    ])
  })

  it('skips installed dependencies', () => {
    const installed: Dependency[] = ['redscript', 'archivexl', 'red4ext']
    expect(unmetRequirements(alwaysFirstEquip, [], installed)).toEqual([
      { dependency: 'inputloader', provider: null }
    ])
  })

  it('points to a library mod that provides a missing dependency', () => {
    const library = [alwaysFirstEquip, inputLoader, archiveXl]
    expect(unmetRequirements(alwaysFirstEquip, library, ['redscript'])).toEqual([
      { dependency: 'archivexl', provider: archiveXl },
      { dependency: 'inputloader', provider: inputLoader }
    ])
  })
})
