import { describe, expect, it } from 'vitest'
import {
  classify,
  detectType,
  detectFramework,
  findRootPrefixes,
  normalizePath,
  isSafePath
} from './classifier'

describe('normalizePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('archive\\pc\\mod\\a.archive')).toBe('archive/pc/mod/a.archive')
  })

  it('strips a leading ./ or /', () => {
    expect(normalizePath('./r6/scripts/a.reds')).toBe('r6/scripts/a.reds')
    expect(normalizePath('/r6/scripts/a.reds')).toBe('r6/scripts/a.reds')
  })
})

describe('findRootPrefixes', () => {
  it('returns an emprty prefix for files laid out from the game root', () => {
    expect(findRootPrefixes(['archive/pc/mod/a.archive'])).toEqual(new Set(['']))
  })

  it('detects a wrapper folder', () => {
    const files = ['Mod v1.2/archive/pc/mod/a.archive', 'Mod v1.2/readme.txt']
    expect(findRootPrefixes(files)).toEqual(new Set(['Mod v1.2']))
  })

  it('anchors on bin not on the mods folder inside a CET path', () => {
    const files = ['bin/x64/plugins/cyber_engine_tweaks/mods/Foo/init.lua']
    expect(findRootPrefixes(files)).toEqual(new Set(['']))
  })

  it('ignores a file that is merely named lika a root folder', () => {
    expect(findRootPrefixes(['docs/bin'])).toEqual(new Set())
  })

  it('returns seveal prefixes for archives with variants', () => {
    const files = ['Main/archive/pc/mod/a.archive', 'Optional/archive/pc/mod/b.archive']
    expect(findRootPrefixes(files)).toEqual(new Set(['Main', 'Optional']))
  })

  it('returns nothing for loose files', () => {
    expect(findRootPrefixes(['a.archive', 'readme.txt'])).toEqual(new Set())
  })

  it('matches root folders case-insensitively', () => {
    expect(findRootPrefixes(['Archive/PC/Mod/a.archive'])).toEqual(new Set(['']))
  })
})

describe('detectType', () => {
  it.each([
    ['archive/pc/mod/a.archive', 'archive'],
    ['bin/x64/plugins/cyber_engine_tweaks/mods/Foo/init.lua', 'cet'],
    ['red4ext/plugins/Foo/Foo.dll', 'red4ext'],
    ['r6/scripts/Foo/Foo.reds', 'redscript'],
    ['r6/tweaks/Foo/foo.yaml', 'tweakxl'],
    ['r6/input/foo.xml', 'input'],
    ['engine/config/platform/pc/foo.ini', 'config'],
    ['mods/Foo/info.json', 'redmod'],
    ['Archive/PC/Mod/a.archive', 'archive']
  ])('%s → %s', (target, type) => {
    expect(detectType(target)).toBe(type)
  })

  it('returns null for files that belong to no mod type', () => {
    expect(detectType('bin/x64/winmm.dll')).toBeNull()
  })
})

describe('classify', () => {
  it('maps a game-root layout one to one', () => {
    const plan = classify({ files: ['archive/pc/mod/a.archive'], modName: 'A' })
    expect(plan.files).toEqual([
      { source: 'archive/pc/mod/a.archive', target: 'archive/pc/mod/a.archive' }
    ])
    expect(plan.types).toEqual(['archive'])
  })

  it('strips a wrapper folder and ignores readmes next to it', () => {
    const plan = classify({
      files: ['Mod/r6/scripts/Mod/mod.reds', 'Mod/readme.txt'],
      modName: 'Mod'
    })
    expect(plan.files).toEqual([
      { source: 'Mod/r6/scripts/Mod/mod.reds', target: 'r6/scripts/Mod/mod.reds' }
    ])
    expect(plan.ignored).toEqual(['Mod/readme.txt'])
  })

  it('normalizes backslashes in sources and targets', () => {
    const plan = classify({ files: ['archive\\pc\\mod\\a.archive'], modName: 'A' })
    expect(plan.files[0]).toEqual({
      source: 'archive/pc/mod/a.archive',
      target: 'archive/pc/mod/a.archive'
    })
  })

  it('collects every mod type one', () => {
    const plan = classify({
      files: ['archive/pc/mod/a.archive', 'archive/pc/mod/b.archive', 'r6/scripts/A/a.reds'],
      modName: 'A'
    })
    expect(plan.types).toEqual(['archive', 'redscript'])
  })

  it('drops OS junk files', () => {
    const plan = classify({
      files: ['archive/pc/mod/a.archive', '__MACOSX/archive/._a.archive', 'Thumbs.db'],
      modName: 'A'
    })
    expect(plan.files).toHaveLength(1)
    expect(plan.ignored).toEqual([])
    expect(plan.unmatched).toEqual([])
  })

  it('puts unknown files outside the game-root folders in unmatched', () => {
    const plan = classify({
      files: ['Mod/archive/pc/mod/a.archive', 'Mod/extras/tool.exe'],
      modName: 'Mod'
    })
    expect(plan.unmatched).toEqual(['Mod/extras/tool.exe'])
  })

  it('warns and places nothing when the archive has variants', () => {
    const plan = classify({
      files: ['Main/archive/pc/mod/a.archive', 'Optional/archive/pc/mod/b.archive'],
      modName: 'A'
    })
    expect(plan.files).toEqual([])
    expect(plan.unmatched).toHaveLength(2)
    expect(plan.warnings).toHaveLength(1)
  })

  it('places nothing and warns when the archive has bad folder structure', () => {
    const plan = classify({
      files: ['Mod/a.archive', 'Mod/b.reds', 'Mod/readme.txt'],
      modName: 'MyMod'
    })
    expect(plan.files).toEqual([])
    expect(plan.unmatched).toEqual(['Mod/a.archive', 'Mod/b.reds'])
    expect(plan.ignored).toEqual(['Mod/readme.txt'])
    expect(plan.warnings).toHaveLength(1)
  })

  it('places nothing when any path seems unsafe', () => {
    const plan = classify({
      files: ['archive/pc/mod/a.archive', 'archive\\..\\..\\bad.dll'],
      modName: 'A'
    })
    expect(plan.files).toEqual([])
    expect(plan.unmatched).toHaveLength(2)
    expect(plan.warnings).toHaveLength(1)
  })
})

describe('detectFramework', () => {
  it.each([
    ['bin/x64/plugins/cyber_engine_tweaks.asi', 'cet'],
    ['red4ext/RED4ext.dll', 'red4ext'],
    ['engine/tools/scc.exe', 'redscript'],
    ['red4ext/plugins/ArchiveXL/ArchiveXL.dll', 'archivexl'],
    ['red4ext/plugins/TweakXL/TweakXL.dll', 'tweakxl'],
    ['red4ext/plugins/Codeware/Codeware.dll', 'codeware']
  ])('%s → %s', (target, framework) => {
    expect(detectFramework(target)).toBe(framework)
  })

  it('does not treat other files in a framework folder as the framework', () => {
    expect(detectFramework('red4ext/plugins/ArchiveXL/LICENSE')).toBeNull()
  })
})

describe('real mods', () => {
  it('Relentless Live Dismember: archive + redscript', () => {
    const plan = classify({
      files: [
        'archive/pc/mod/RelentlessLiveDismember.archive',
        'r6/scripts/CazanuLimbSurvival/ArmCombat.reds',
        'r6/scripts/CazanuLimbSurvival/WoundedPriority.reds'
      ],
      modName: 'Relentless Live Dismember'
    })
    expect(plan.types).toEqual(['archive', 'redscript'])
    expect(plan.unmatched).toEqual([])
    expect(plan.files.map((file) => detectType(file.target))).not.toContain(null)
  })

  it('Night City Alive: REDmod tweaks are not TweakXL', () => {
    const plan = classify({
      files: [
        'archive/pc/mod/bike_fix.archive',
        'mods/NIGHT CITY ALIVE/info.json',
        'mods/NIGHT CITY ALIVE/tweaks/base/gameplay/static_data/database/ai/aigeneralsettings.tweak'
      ],
      modName: 'Night City Alive'
    })
    expect(plan.types).toEqual(['archive', 'redmod'])
  })

  it('RadioExt: CET + RED4ext, including the empty radios/.keep', () => {
    const plan = classify({
      files: [
        'bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/init.lua',
        'bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/radios/.keep',
        'red4ext/plugins/RadioExt/fmod.dll',
        'red4ext/plugins/RadioExt/RadioExt.dll'
      ],
      modName: 'RadioExt'
    })
    expect(plan.types).toEqual(['cet', 'red4ext'])
    expect(plan.files.map((file) => file.target)).toContain(
      'bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/radios/.keep'
    )
  })

  it('Cyber Engine Tweaks core: provides CET needs nothing', () => {
    const files = [
      'bin/x64/global.ini',
      'bin/x64/LICENSE',
      'bin/x64/plugins/cyber_engine_tweaks/scripts/json/README.md',
      'bin/x64/plugins/cyber_engine_tweaks/tweakdb/usedhashes.kark',
      'bin/x64/plugins/cyber_engine_tweaks.asi',
      'bin/x64/version.dll'
    ]
    const plan = classify({ files, modName: 'Cyber Engine Tweaks' })
    expect(plan.types).toEqual([])
    expect(plan.providers).toEqual(['cet'])
    expect(plan.files).toHaveLength(files.length)
  })
})

describe('isSafePath', () => {
  it.each([
    'archive/pc/mod/a.archive',
    'mods/Mod/info.json',
    'bin/x64/plugins/cyber_engine_tweaks/mods/radioExt/radio/.keep',
    'archive/pc/mod/a.b.archie'
  ])('accepts %s', (path) => {
    expect(isSafePath(path)).toBe(true)
  })

  it.each([
    'archive/../../Windows/virus.dll',
    '../bad.dll',
    'archive/./a.archive',
    'r6/.. /evil.dll',
    'C:/Windows/virus.dll',
    'archive/pc/mod/a.archive:hidden',
    'r6/scripts/Mod./a.reds'
  ])('rejects %s', (path) => {
    expect(isSafePath(path)).toBe(false)
  })
})
