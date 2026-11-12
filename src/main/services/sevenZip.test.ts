import { describe, expect, it } from 'vitest'
import { parseListing, sevenZipError } from './sevenZip'

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

describe('sevenZipError', () => {
  function failure(output: { stdout?: string; stderr?: string }): object {
    return Object.assign(new Error('Command failed: 7z.exe ...'), {
      code: 2,
      killed: false,
      ...output
    })
  }

  it.each([
    [
      'an encrypted archive',
      { stderr: 'ERROR: enc.7z : Cannot open encrypted archive. Wrong password?\r\n' },
      'password-protected'
    ],
    [
      'encrypted files in a zip',
      { stderr: 'ERROR: Wrong password : a.archive\r\nERROR: Wrong password : readme.txt\r\n' },
      'password-protected'
    ],
    [
      'a file that is no archive',
      {
        stderr:
          'ERROR: fake.zip\r\nfake.zip\r\nOpen ERROR: Cannot open the file as [zip] archive\r\n\r\nERRORS:\r\nIs not archive\r\n'
      },
      "isn't an archive"
    ],
    [
      'a truncated download while listing (reported on stdout)',
      { stdout: 'ERRORS:\r\nUnexpected end of archive\r\nPhysical Size = 150000\r\n' },
      'damaged or incomplete'
    ],
    [
      'a truncated download while extracting',
      { stderr: 'ERRORS:\r\nUnexpected end of archive\r\nERROR: CRC Failed : a.archive\r\n' },
      'damaged or incomplete'
    ]
  ])('explains %s', (_case, output, expected) => {
    expect(sevenZipError(failure(output)).message).toContain(expected)
  })

  it("falls back to 7-Zip's own error line", () => {
    const error = failure({
      stderr: 'ERROR: The system cannot find the file specified.\r\nmissing.zip\r\n'
    })
    expect(sevenZipError(error).message).toBe(
      '7-Zip could not open the archive: The system cannot find the file specified.'
    )
    expect(sevenZipError(error).cause).toBe(error)
  })

  it('explains a missing 7-Zip and a run that took too long', () => {
    expect(sevenZipError(Object.assign(new Error('spawn'), { code: 'ENOENT' })).message).toContain(
      'missing from the app folder'
    )
    expect(sevenZipError(Object.assign(new Error('x'), { killed: true })).message).toContain(
      'took too long'
    )
  })
})
