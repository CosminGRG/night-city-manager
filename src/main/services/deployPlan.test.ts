import { describe, expect, it } from 'vitest'
import type { ModRecord, PlannedFile } from '@shared/types'
import { planDeploy } from './deployPlan'

const GAME = 'E:\\Games\\Cyberpunk2077'
const STAGING = 'D:\\NCM\\mods\\Faster Elevators'

function modWith(files: PlannedFile[]): ModRecord {
  return {
    id: 'mod-1',
    name: 'Faster Elevators',
    version: '2.0.0',
    nexusModId: 18389,
    archive: 'Faster Elevators.zip',
    folder: 'Faster Elevators',
    plan: { providers: [], files, types: ['archive'], ignored: [], unmatched: [], warnings: [] },
    importedAt: '2026-10-31T10:00:00.000Z'
  }
}

describe('planDeploy', () => {
  it('turns plan paths into absolute Windows paths', () => {
    const mod = modWith([
      { source: 'Mod v1/archive/pc/mod/a.archive', target: 'archive/pc/mod/a.archive' }
    ])
    expect(planDeploy(mod, STAGING, GAME)).toEqual([
      {
        path: 'archive/pc/mod/a.archive',
        source: `${STAGING}\\Mod v1\\archive\\pc\\mod\\a.archive`,
        target: `${GAME}\\archive\\pc\\mod\\a.archive`
      }
    ])
  })

  it('refuses a target outside the game folder', () => {
    const mod = modWith([{ source: 'a.dll', target: 'archive/../../evil.dll' }])
    expect(() => planDeploy(mod, STAGING, GAME)).toThrow(/outside/)
  })

  it('refuses a source outside the staging folder', () => {
    const mod = modWith([{ source: '../Other Mod/a.archive', target: 'archive/pc/mod/a.archive' }])
    expect(() => planDeploy(mod, STAGING, GAME)).toThrow(/outside/)
  })

  it('refuses the same target twice, ignoring case', () => {
    const mod = modWith([
      { source: 'archive/pc/mod/a.archive', target: 'archive/pc/mod/a.archive' },
      { source: 'Archive/PC/Mod/A.archive', target: 'Archive/PC/Mod/A.archive' }
    ])
    expect(() => planDeploy(mod, STAGING, GAME)).toThrow(/twice/)
  })
})
