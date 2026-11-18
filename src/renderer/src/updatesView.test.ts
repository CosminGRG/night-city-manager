import { describe, expect, it } from 'vitest'
import { createTranslator } from '@shared/i18n/translate'
import type { Framework, ModRecord, ModUpdate } from '@shared/types'
import { coreUpdates, updateTitle } from './updatesView'

const UPDATE: ModUpdate = {
  name: 'CET 1.38.1 - Game version 2.5',
  version: '1.38.1',
  uploadedAt: '2026-10-26T12:00:00.000Z'
}

function mod(id: string, providers: Framework[] = []): ModRecord {
  return {
    id,
    name: id,
    version: null,
    nexusModId: 107,
    archive: `${id}.zip`,
    folder: id,
    plan: { providers, files: [], types: [], ignored: [], unmatched: [], warnings: [] },
    importedAt: '2026-11-08T00:00:00.000Z'
  }
}

describe('coreUpdates', () => {
  it('reports the update of the deployed copy of each core mod', () => {
    const cet = mod('cet', ['cet'])
    expect(coreUpdates([cet], { cet: 'deployed' }, { cet: UPDATE })).toEqual({
      cet: { mod: cet, update: UPDATE }
    })
  })

  it('ignores core mods that are not deployed and mods that are not core mods', () => {
    const mods = [mod('cet', ['cet']), mod('amm')]
    const deployments = { amm: 'deployed' as const }
    expect(coreUpdates(mods, deployments, { cet: UPDATE, amm: UPDATE })).toEqual({})
  })

  it('gives every framework of a plugin the same update', () => {
    const plugin = mod('plugin', ['red4ext', 'archivexl'])
    const result = coreUpdates([plugin], { plugin: 'deployed' }, { plugin: UPDATE })
    expect(Object.keys(result)).toEqual(['red4ext', 'archivexl'])
  })
})

describe('updateTitle', () => {
  it('names the new version, the Nexus file and its upload day', () => {
    expect(updateTitle(UPDATE, createTranslator('en'), 'en-GB')).toBe(
      'Update available: 1.38.1 ("CET 1.38.1 - Game version 2.5"), uploaded 26 Oct 2026. Click to see its files on Nexus Mods.'
    )
  })
})
