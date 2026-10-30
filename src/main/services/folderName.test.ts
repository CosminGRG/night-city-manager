import { describe, expect, it } from 'vitest'
import { sanitizeFolderName, uniqueFolderName } from './folderName'

describe('sanitizeFolderName', () => {
  it.each([
    ['Faster Elevators', 'Faster Elevators'],
    ['Skip Radio Song - CET', 'Skip Radio Song - CET'],
    ['What: A <Mod>?', 'What_ A _Mod__'],
    ['Mod v1.2.', 'Mod v1.2'],
    ['  Mod  ', 'Mod'],
    ['.hidden', 'hidden'],
    ['CON', '_CON'],
    ['nul.txt', '_nul.txt'],
    ['Console', 'Console'],
    ['...', 'mod']
  ])('%s → %s', (name, folder) => {
    expect(sanitizeFolderName(name)).toBe(folder)
  })

  it('shortens very long names', () => {
    expect(sanitizeFolderName('a'.repeat(200))).toHaveLength(80)
  })
})

describe('uniqueFolderName', () => {
  it('keeps a free name', () => {
    expect(uniqueFolderName('Mod', [])).toBe('Mod')
  })

  it('adds a number when the name is taken, ignoring case', () => {
    expect(uniqueFolderName('Skip Radio Song - CET', ['skip radio song - cet'])).toBe(
      'Skip Radio Song - CET (2)'
    )
  })

  it('counts up past taken numbers', () => {
    expect(uniqueFolderName('Mod', ['Mod', 'Mod (2)'])).toBe('Mod (3)')
  })
})
