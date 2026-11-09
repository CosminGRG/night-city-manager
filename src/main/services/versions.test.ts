import { describe, expect, it } from 'vitest'
import type { ModRecord } from '@shared/types'
import type { NexusFile } from './nexus'
import { versionGroups } from './versions'

function mod(
  id: string,
  archive: string,
  nexusModId: number | null,
  importedAt = '2026-11-01'
): ModRecord {
  return {
    id,
    name: id,
    version: null,
    nexusModId,
    archive,
    folder: id,
    plan: { providers: [], files: [], types: [], ignored: [], unmatched: [], warnings: [] },
    importedAt: `${importedAt}T00:00:00.000Z`
  }
}

function file(sqid: string, groupId: number | null, uploadedAt: number): NexusFile {
  return {
    fileId: uploadedAt,
    sqid,
    groupId,
    name: sqid,
    version: '1',
    category: 'MAIN',
    uploadedAt
  }
}

// Real names: CET 1.38.0 and 1.38.1 share one version line (497182).
const CET_1380 = 'CET 1.38.0 - Game version 2.5 107 1.38.0 2026-10-22T12-57Z Q6xF6lly7.zip'
const CET_1381 = 'CET 1.38.1 - Game version 2.5 107 1.38.1 2026-11-01T09-15Z ozVyzbb0n.zip'
const CET_FILES = {
  107: [file('Q6xF6lly7', 497182, 1792673845), file('ozVyzbb0n', 497182, 1792978138)]
}

// Real page with two separate mods: Complete Radio and Only Music.
const COMPLETE =
  'Outrun Waves 93.7 - Radio Mod (Complete Radio) 5808 1.1.0 2026-10-20T10-00Z cOmPlEtE1.zip'
const ONLY_MUSIC =
  'Outrun Waves 93.7 - Radio Mod (Only Music) 5808 1.1.0 2026-10-20T10-00Z oNlYmUsIc.zip'
const OUTRUN_FILES = { 5808: [file('cOmPlEtE1', 1, 1717159700), file('oNlYmUsIc', 2, 1717159726)] }

describe('versionGroups', () => {
  it('puts files of one version line in one group, newest first', () => {
    const mods = [mod('old', CET_1380, 107), mod('new', CET_1381, 107)]
    expect(versionGroups(mods, CET_FILES)).toEqual([{ key: 'nexus:107', modIds: ['new', 'old'] }])
  })

  it('keeps separate files of one Nexus page apart once Nexus says so', () => {
    const mods = [mod('complete', COMPLETE, 5808), mod('music', ONLY_MUSIC, 5808)]
    expect(versionGroups(mods, OUTRUN_FILES)).toEqual([
      { key: 'nexus:5808:1', modIds: ['complete'] },
      { key: 'nexus:5808:2', modIds: ['music'] }
    ])
  })

  it('groups by the Nexus id in the name when there is no Nexus data', () => {
    const mods = [mod('complete', COMPLETE, 5808), mod('music', ONLY_MUSIC, 5808)]
    expect(versionGroups(mods, {})).toEqual([{ key: 'nexus:5808', modIds: ['complete', 'music'] }])
  })

  it('keeps a file Nexus does not list yet apart from a split page', () => {
    const fresh = COMPLETE.replace('cOmPlEtE1', 'brandNew1')
    const mods = [
      mod('complete', COMPLETE, 5808),
      mod('music', ONLY_MUSIC, 5808),
      mod('fresh', fresh, 5808)
    ]
    expect(versionGroups(mods, OUTRUN_FILES).map(({ modIds }) => modIds)).toEqual([
      ['complete'],
      ['music'],
      ['fresh']
    ])
  })

  it('never groups archives without a Nexus name', () => {
    const mods = [mod('a', 'My Mod.zip', null), mod('b', 'My Mod.zip', null)]
    expect(versionGroups(mods, {})).toEqual([
      { key: 'mod:a', modIds: ['a'] },
      { key: 'mod:b', modIds: ['b'] }
    ])
  })

  it('orders without Nexus data by the upload time in classic names, else the import date', () => {
    const classicOld = 'Dismemberment Settings-12901-v1-1-1700000000.rar'
    const classicNew = 'Dismemberment Settings-12901-v1-2-1710332558.rar'
    const mods = [
      mod('new', classicNew, 12901, '2026-01-01'),
      mod('old', classicOld, 12901, '2026-11-01')
    ]
    expect(versionGroups(mods, {})[0].modIds).toEqual(['new', 'old'])

    const current = [
      mod('first', CET_1380, 107, '2026-10-22'),
      mod('second', CET_1381, 107, '2026-11-02')
    ]
    expect(versionGroups(current, {})[0].modIds).toEqual(['second', 'first'])
  })
})
