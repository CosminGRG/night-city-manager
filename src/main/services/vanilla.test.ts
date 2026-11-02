import { describe, expect, it } from 'vitest'
import { isVanillaFolder } from './vanilla'

describe('isVanillaFolder', () => {
  it.each(['r6', 'R6/Config', 'archive/pc/mod', 'r6/cache', 'r6/cache/modded', 'tools/redmod/bin'])(
    'protects %s',
    (folder) => {
      expect(isVanillaFolder(folder)).toBe(true)
    }
  )

  it.each([
    'r6/config/cybercmd',
    'r6/scripts',
    'bin/x64/plugins',
    'red4ext',
    'engine/tools',
    'r6x'
  ])('allows %s', (folder) => {
    expect(isVanillaFolder(folder)).toBe(false)
  })
})
