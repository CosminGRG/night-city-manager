import { describe, expect, it } from 'vitest'
import { classify, detectType, findRootPrefixes, normalizePath } from './classifier'

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
})
