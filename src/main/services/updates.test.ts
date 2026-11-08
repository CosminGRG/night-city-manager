import { describe, expect, it } from 'vitest'
import type { ModRecord } from '@shared/types'
import type { NexusFile } from './nexus'
import { findUpdates, identifyFile, newerFile } from './updates'

// Real CET files (2026-11-08): 1.38.0 is the user's, 1.38.1 the update.
const CET_1380: NexusFile = {
  fileId: 167620,
  sqid: 'Q6xF6lly7',
  groupId: 497182,
  name: 'CET 1.38.0 - Game version 2.5',
  version: '1.38.0',
  category: 'OLD_VERSION',
  uploadedAt: 1792673845
}
const CET_1381: NexusFile = {
  ...CET_1380,
  fileId: 168615,
  sqid: 'ozVyzbb0n',
  name: 'CET 1.38.1 - Game version 2.5',
  version: '1.38.1',
  category: 'MAIN',
  uploadedAt: 1792978138
}
const CET_ARCHIVE = 'CET 1.38.0 - Game version 2.5 107 1.38.0 2026-10-22T12-57Z Q6xF6lly7.zip'
const CET_1381_ARCHIVE = 'CET 1.38.1 - Game version 2.5 107 1.38.1 2026-11-01T09-15Z ozVyzbb0n.zip'

function mod(id: string, archive: string, nexusModId: number | null = 107): ModRecord {
  return {
    id,
    name: id,
    version: null,
    nexusModId,
    archive,
    folder: id,
    plan: { providers: [], files: [], types: [], ignored: [], unmatched: [], warnings: [] },
    importedAt: '2026-11-08T00:00:00.000Z'
  }
}

describe('identifyFile', () => {
  it('finds the file by its sqid or, for classic names, by its upload time', () => {
    const files = [CET_1380, CET_1381]
    expect(identifyFile({ kind: 'sqid', sqid: 'ozVyzbb0n' }, files)).toBe(CET_1381)
    expect(identifyFile({ kind: 'uploaded', uploadedAt: 1792673845 }, files)).toBe(CET_1380)
  })

  it('gives up when nothing or more than one file matches', () => {
    const twin = { ...CET_1381, fileId: 1, sqid: 'other', uploadedAt: CET_1380.uploadedAt }
    expect(identifyFile({ kind: 'sqid', sqid: 'gone' }, [CET_1380])).toBeNull()
    expect(identifyFile({ kind: 'uploaded', uploadedAt: 1792673845 }, [CET_1380, twin])).toBeNull()
  })
})

describe('newerFile', () => {
  it('returns the newest later file of the same version line', () => {
    const middle = { ...CET_1381, fileId: 2, uploadedAt: CET_1381.uploadedAt - 1000 }
    expect(newerFile(CET_1380, [CET_1380, CET_1381, middle])).toBe(CET_1381)
  })

  it('ignores other version lines and removed or archived files', () => {
    const otherLine = { ...CET_1381, groupId: 1 }
    const removed = { ...CET_1381, category: 'REMOVED' as const }
    const archived = { ...CET_1381, category: 'ARCHIVED' as const }
    expect(newerFile(CET_1380, [CET_1380, otherLine, removed, archived])).toBeNull()
  })

  it('finds nothing for the newest file or a file without a version line', () => {
    expect(newerFile(CET_1381, [CET_1380, CET_1381])).toBeNull()
    expect(newerFile({ ...CET_1380, groupId: null }, [CET_1380, CET_1381])).toBeNull()
  })
})

describe('findUpdates', () => {
  const files = { 107: [CET_1380, CET_1381] }

  it('reports the newer file for each mod that has one', () => {
    expect(findUpdates([mod('cet', CET_ARCHIVE)], files)).toEqual({
      cet: {
        name: 'CET 1.38.1 - Game version 2.5',
        version: '1.38.1',
        uploadedAt: '2026-10-26T01:28:58.000Z'
      }
    })
  })

  it('reports nothing when the newer file is already in the library', () => {
    const mods = [mod('old', CET_ARCHIVE), mod('new', CET_1381_ARCHIVE)]
    expect(findUpdates(mods, files)).toEqual({})
  })

  it('skips mods it cannot identify', () => {
    const mods = [
      mod('renamed', 'cet.zip'),
      mod('no-id', CET_ARCHIVE, null),
      mod('not-fetched', CET_ARCHIVE, 999)
    ]
    expect(findUpdates(mods, files)).toEqual({})
  })
})
