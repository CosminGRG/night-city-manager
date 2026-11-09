import { randomUUID } from 'crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ModRecord, VersionGroup } from '@shared/types'
import { deployMod, type DeployContext } from './deployer'
import { GameManifests } from './manifests'
import { ModLibrary } from './modLibrary'
import { deployVersion } from './versionSwitch'

const TARGET = 'archive/pc/mod/a.archive'

let dir: string
let gamePath: string
let context: DeployContext

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
  context = {
    modsDir: join(dir, 'mods'),
    backupsDir: join(dir, 'data', 'backups'),
    manifests: new GameManifests(join(dir, 'data', 'manifests')).forGame(gamePath),
    library: new ModLibrary(join(dir, 'data', 'mods.json'))
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
