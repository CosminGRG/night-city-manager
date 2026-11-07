import { describe, expect, it } from 'vitest'
import type { ModRecord, ModType, NexusRequirement } from '@shared/types'
import {
  requirementsToDeploy,
  deployWithRequirements,
  type RequirementSources
} from './autoRequirements'

function mod(
  name: string,
  types: ModType[],
  targets: string[] = [],
  nexusModId: number | null = null
): ModRecord {
  return {
    id: name,
    name,
    version: null,
    nexusModId,
    archive: `${name}.zip`,
    folder: name,
    plan: {
      providers: [],
      types,
      files: targets.map((target) => ({ source: target, target })),
      ignored: [],
      unmatched: [],
      warnings: []
    },
    importedAt: '2026-11-07T00:00:00.000Z'
  }
}

function sources(overrides: Partial<RequirementSources> = {}): RequirementSources {
  return { library: [], installed: [], deployments: {}, nexus: {}, ...overrides }
}

function requires(nexusId: number, name: string, optional = false): NexusRequirement {
  return { nexusId, name, optional }
}

const names = (mods: ModRecord[]): string[] => mods.map((m) => m.name)

const red4ext = mod('RED4ext', [], ['red4ext/RED4ext.dll', 'bin/x64/winmm.dll'], 2380)
const inputLoader = mod(
  'Input Loader',
  ['red4ext'],
  ['red4ext/plugins/input_loader/input_loader.dll'],
  4575
)
const alwaysFirstEquip = mod(
  'Always First Equip',
  ['input'],
  ['r6/input/AlwaysFirstEquip.xml'],
  2557
)
const refract = mod('ReFRACT', [], ['archive/pc/mod/refract.archive'], 34858)
const blurBegone = mod('Blur Begone', ['archive'], ['archive/pc/mod/blur.archive'], 12345)

describe('requirementsToDeploy', () => {
  it('deploys what a mod needs from the library, requirements of requirements first', () => {
    const library = [red4ext, inputLoader, alwaysFirstEquip]
    expect(names(requirementsToDeploy(alwaysFirstEquip, sources({ library })))).toEqual([
      'RED4ext',
      'Input Loader'
    ])
  })

  it('skips what is already installed, deployed or interrupted', () => {
    const library = [red4ext, inputLoader, alwaysFirstEquip]
    expect(
      requirementsToDeploy(alwaysFirstEquip, sources({ library, installed: ['inputloader'] }))
    ).toEqual([])
    expect(
      names(
        requirementsToDeploy(
          alwaysFirstEquip,
          sources({ library, deployments: { RED4ext: 'deployed' } })
        )
      )
    ).toEqual(['Input Loader'])
    expect(
      requirementsToDeploy(
        alwaysFirstEquip,
        sources({ library, deployments: { 'Input Loader': 'deploying' } })
      )
    ).toEqual([])
  })

  it('cannot deploy what is not in the library', () => {
    expect(
      requirementsToDeploy(alwaysFirstEquip, sources({ library: [alwaysFirstEquip] }))
    ).toEqual([])
  })

  it('follows Nexus requirements, but never optional ones', () => {
    const library = [refract, blurBegone, red4ext, inputLoader, alwaysFirstEquip]
    const nexus = {
      34858: [requires(12345, 'Blur Begone')],
      2557: [requires(4575, 'Input Loader', true)]
    }

    expect(names(requirementsToDeploy(refract, sources({ library, nexus })))).toEqual([
      'Blur Begone'
    ])
    expect(requirementsToDeploy(alwaysFirstEquip, sources({ library, nexus }))).toEqual([])
  })

  it('stops at circles instead of looping forever', () => {
    const a = mod('A', [], ['archive/pc/mod/a.archive'], 1)
    const b = mod('B', [], ['archive/pc/mod/b.archive'], 2)
    const nexus = { 1: [requires(2, 'B')], 2: [requires(1, 'A')] }

    expect(names(requirementsToDeploy(a, sources({ library: [a, b], nexus })))).toEqual(['B'])
  })

  it('deploys a shared requirement once', () => {
    const library = [red4ext, inputLoader, alwaysFirstEquip, refract]
    const nexus = { 2557: [requires(2380, 'RED4ext')] }
    expect(names(requirementsToDeploy(alwaysFirstEquip, sources({ library, nexus })))).toEqual([
      'RED4ext',
      'Input Loader'
    ])
  })

  it('skips a library mod that has nothing to deploy', () => {
    const variants = mod('Blur Begone variants', [], [], 12345)
    const nexus = { 34858: [requires(12345, 'Blur Begone')] }
    expect(requirementsToDeploy(refract, sources({ library: [variants, refract], nexus }))).toEqual(
      []
    )
  })
})

describe('deployWithRequirements', () => {
  it('deploys the requirements in order, then the mod', async () => {
    const deployed: string[] = []
    const deploy = async (target: ModRecord): Promise<void> => {
      deployed.push(target.name)
    }

    const names = await deployWithRequirements(alwaysFirstEquip, [red4ext, inputLoader], deploy)
    expect(deployed).toEqual(['RED4ext', 'Input Loader', 'Always First Equip'])
    expect(names).toEqual(['RED4ext', 'Input Loader'])
  })

  it('does not deploy the mod when a requirement fails', async () => {
    const deployed: string[] = []
    const deploy = async (target: ModRecord): Promise<void> => {
      if (target === inputLoader) throw new Error('A file is owned by Other Mod.')
      deployed.push(target.name)
    }

    await expect(
      deployWithRequirements(alwaysFirstEquip, [red4ext, inputLoader], deploy)
    ).rejects.toThrow(
      'Always First Equip was not deployed: it needs Input Loader, which could not be deployed. A file is owned by Other Mod.'
    )
    expect(deployed).toEqual(['RED4ext'])
  })
})
