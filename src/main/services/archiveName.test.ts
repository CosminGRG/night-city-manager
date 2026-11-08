import { describe, expect, it } from 'vitest'
import { parseArchiveName } from './archiveName'

describe('parseArchiveName', () => {
  it.each([
    [
      'Faster Elevators 18389 2.0.0 2026-09-16T13-25Z 5em9eomcJ.zip',
      'Faster Elevators',
      '2.0.0',
      18389,
      '5em9eomcJ'
    ],
    [
      'Skip Radio Song - CET 6170 2.4.1 2026-09-16T11-39Z 6ZNKZcNBA.zip',
      'Skip Radio Song - CET',
      '2.4.1',
      6170,
      '6ZNKZcNBA'
    ],
    [
      'Native Settings UI 1.97 3518 1.97 2026-10-22T15-26Z cB3xB00Va.zip',
      'Native Settings UI 1.97',
      '1.97',
      3518,
      'cB3xB00Va'
    ],
    [
      'CET 1.38.0 - Game version 2.5 107 1.38.0 2026-10-22T12-57Z Q6xF6lly7.zip',
      'CET 1.38.0 - Game version 2.5',
      '1.38.0',
      107,
      'Q6xF6lly7'
    ]
  ])('parses the current Nexus format: %s', (fileName, name, version, nexusModId, sqid) => {
    expect(parseArchiveName(fileName)).toEqual({
      name,
      version,
      nexusModId,
      nexusFile: { kind: 'sqid', sqid }
    })
  })

  it.each([
    [
      'Dismemberment Settings-12901-v1-2-1710332558.rar',
      'Dismemberment Settings',
      'v1.2',
      12901,
      1710332558
    ],
    [
      'Outrun Waves 93.7 - Radio Mod (Only Music)-5808-1-1-0-1717159726.rar',
      'Outrun Waves 93.7 - Radio Mod (Only Music)',
      '1.1.0',
      5808,
      1717159726
    ]
  ])('parses the classic Nexus format: %s', (fileName, name, version, nexusModId, uploadedAt) => {
    expect(parseArchiveName(fileName)).toEqual({
      name,
      version,
      nexusModId,
      nexusFile: { kind: 'uploaded', uploadedAt }
    })
  })

  it('reads a file the browser saved again with " (1)"', () => {
    const current = parseArchiveName(
      'Faster Elevators 18389 2.0.0 2026-09-16T13-25Z 5em9eomcJ (1).zip'
    )
    expect(current.name).toBe('Faster Elevators')
    expect(current.nexusFile).toEqual({ kind: 'sqid', sqid: '5em9eomcJ' })

    const classic = parseArchiveName('Dismemberment Settings-12901-v1-2-1710332558 (12).rar')
    expect(classic.nexusFile).toEqual({ kind: 'uploaded', uploadedAt: 1710332558 })
  })

  it('falls back to the file name for other archives', () => {
    expect(parseArchiveName('Mod_v1.2.rar')).toEqual({
      name: 'Mod_v1.2',
      version: null,
      nexusModId: null,
      nexusFile: null
    })
    expect(parseArchiveName('My Mod (2).zip').name).toBe('My Mod (2)')
  })
})
