import { describe, expect, it } from "vitest";
import { findRootPrefixes, normalizePath } from './classifier'

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
