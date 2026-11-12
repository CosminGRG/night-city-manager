import { randomUUID } from 'crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ModRecord, VersionGroup } from '@shared/types'
import { deployMod, type DeployContext } from './deployer'
import { GameManifests } from './manifests'
import { ModLibrary } from './modLibrary'
import type { RemoveContext } from './removal'
import { deployVersion, removeVersions } from './versionSwitch'

const TARGET = 'archive/pc/mod/a.archive'

let dir: string
let gamePath: string
let context: DeployContext & RemoveContext

async function put(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

async function staged(name: string, targets: string[]): Promise<ModRecord> {
  const mod: ModRecord = {
    id: randomUUID(),
    name,
    version: null,
    nexusModId: null,
    archive: `${name}.zip`,
    folder: name,
    plan: {
      providers: [],
      files: targets.map((target) => ({ source: target, target })),
      types: [],
      ignored: [],
      unmatched: [],
      warnings: []
    },
    importedAt: new Date().toISOString()
  }
  await context.library.add(mod)
  for (const target of targets) await put(join(context.modsDir, name, target), name)
  return mod
}

async function deployedIds(): Promise<string[]> {
  return (await context.manifests.list()).map((manifest) => manifest.modId)
}

const group = (...mods: ModRecord[]): VersionGroup[] => [
  { key: 'nexus:1', modIds: mods.map((mod) => mod.id) }
]

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-switch-'))
  gamePath = join(dir, 'game')
  const games = new GameManifests(join(dir, 'data', 'manifests'))
  context = {
    modsDir: join(dir, 'mods'),
    backupsDir: join(dir, 'data', 'backups'),
    manifests: games.forGame(gamePath),
    library: new ModLibrary(join(dir, 'data', 'mods.json')),
    games
  }

  await put(join(gamePath, 'bin', 'x64', 'Cyberpunk2077.exe'), 'game')
  await mkdir(join(gamePath, 'archive', 'pc', 'mod'), { recursive: true })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('deployVersion', () => {
  it('swaps the deployed version for the chosen one', async () => {
    const v1 = await staged('v1', [TARGET])
    const v2 = await staged('v2', [TARGET])
    await deployMod(context, gamePath, v1)

    await deployVersion(context, gamePath, v2, group(v2, v1))

    expect(await deployedIds()).toEqual([v2.id])
    expect(await readFile(join(gamePath, TARGET), 'utf8')).toBe('v2')
  })

  it('deploys normally when no other version is deployed', async () => {
    const v1 = await staged('v1', [TARGET])
    const v2 = await staged('v2', [TARGET])

    await deployVersion(context, gamePath, v1, group(v2, v1))

    expect(await deployedIds()).toEqual([v1.id])
  })

  it('puts the old version back when the new one cannot be deployed', async () => {
    const v1 = await staged('v1', [TARGET])
    const v2 = await staged('v2', [TARGET, 'archive/pc/mod/shared.archive'])
    const other = await staged('Other', ['archive/pc/mod/shared.archive'])
    await deployMod(context, gamePath, v1)
    await deployMod(context, gamePath, other)

    await expect(deployVersion(context, gamePath, v2, group(v2, v1))).rejects.toThrow(
      /would overwrite files from Other/
    )

    expect((await deployedIds()).toSorted()).toEqual([v1.id, other.id].toSorted())
    expect(await readFile(join(gamePath, TARGET), 'utf8')).toBe('v1')
  })
})

describe('removeVersions', () => {
  it('deploys the newest remaining version when the deployed one is removed', async () => {
    const v1 = await staged('v1', [TARGET])
    const v2 = await staged('v2', [TARGET])
    const v3 = await staged('v3', [TARGET])
    await deployMod(context, gamePath, v1)

    const result = await removeVersions(context, gamePath, v1, [v3, v2], false)

    expect(result.deployedInstead?.id).toBe(v3.id)
    expect(await deployedIds()).toEqual([v3.id])
    expect(await readFile(join(gamePath, TARGET), 'utf8')).toBe('v3')
    expect(context.library.list().map((mod) => mod.name)).toEqual(['v2', 'v3'])
  })

  it('skips versions with nothing to place', async () => {
    const v1 = await staged('v1', [TARGET])
    const v2 = await staged('v2', [TARGET])
    const empty = await staged('v3', [])
    await deployMod(context, gamePath, v2)

    const result = await removeVersions(context, gamePath, v2, [empty, v1], false)

    expect(result.deployedInstead?.id).toBe(v1.id)
  })

  it('deploys nothing when the removed version was not deployed', async () => {
    const v1 = await staged('v1', [TARGET])
    const v2 = await staged('v2', [TARGET])
    await deployMod(context, gamePath, v2)

    const result = await removeVersions(context, gamePath, v1, [v2], false)

    expect(result.deployedInstead).toBeNull()
    expect(await deployedIds()).toEqual([v2.id])
  })

  it('deploys nothing when every version is removed', async () => {
    const v1 = await staged('v1', [TARGET])
    const v2 = await staged('v2', [TARGET])
    await deployMod(context, gamePath, v2)

    const result = await removeVersions(context, gamePath, v2, [v1], true)

    expect(result.deployedInstead).toBeNull()
    expect(result.removed.map(({ deployed }) => deployed)).toEqual([true, false])
    expect(await deployedIds()).toEqual([])
    expect(context.library.list()).toEqual([])
  })

  it('says so when the newest remaining version cannot be deployed', async () => {
    const v1 = await staged('v1', ['archive/pc/mod/old.archive'])
    const v2 = await staged('v2', [TARGET])
    const other = await staged('Other', [TARGET])
    await deployMod(context, gamePath, v1)
    await deployMod(context, gamePath, other)

    await expect(removeVersions(context, gamePath, v1, [v2], false)).rejects.toThrow(
      /v1 was removed, but v2 could not be deployed in its place: .*Other/
    )
    expect(context.library.list().map((mod) => mod.name)).toEqual(['v2', 'Other'])
  })
})
