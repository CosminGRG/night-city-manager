import { describe, expect, it } from 'vitest'
import { parseListing } from './sevenZip'

const listing = (lines: string[]): string => lines.join('\r\n')

const HEADER = [
  'Listing archive: C:\\Downloads\\Mod.zip',
  '',
  '--',
  'Path = C:\\Downloads\\Mod.zip',
  'Type = zip',
  '',
  '----------'
]

describe('parseListing', () => {
  it('returns only files, not folder or the archive itself', () => {
    const stdout = listing([
      ...HEADER,
      'Path = Mod v1',
      'Folder = +',
      'Attributes = D',
      '',
      'Path = Mod v1\\archive\\pc\\mod\\a.archive',
      'Folder = -',
      'Attributes = A',
      '',
      'Path = Mod v1\\readme.txt',
      'Folder = -',
      'Attributes = A',
      ''
    ])
    expect(parseListing(stdout)).toEqual([
      'Mod v1\\archive\\pc\\mod\\a.archive',
      'Mod v1\\readme.txt'
    ])
  })

  it('detects folders by attributes when there is no folder field (7z)', () => {
    const stdout = listing([
      ...HEADER,
      'Path = Mod',
      'Attributes = D',
      '',
      'Path = Mod\\a.reds',
      'Attributes = A',
      ''
    ])
    expect(parseListing(stdout)).toEqual(['Mod\\a.reds'])
  })

  it('returns nothing for an empty archive', () => {
    expect(parseListing(listing(HEADER))).toEqual([])
  })
})
