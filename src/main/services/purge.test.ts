import { randomUUID } from 'crypto'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Framework, ModRecord } from '@shared/types'
import { deployMod, type DeployContext } from './deployer'
import { ManifestStore } from './manifests'
import { ModLibrary } from './modLibrary'
import { purgeMods } from './purge'

let dir: string
let gamePath: string
let context: DeployContext

async function put(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content)
}

async function deployed(
  name: string,
  target: string,
  providers: Framework[] = []
): Promise<ModRecord> {
  const mod: ModRecord = {
    id: randomUUID(),
    name,
    version: null,
    nexusModId: null,
    archive: `${name}.zip`,
    folder: name,
    plan: {
      providers,
      files: [{ source: target, target }],
      types: [],
      ignored: [],
      unmatched: [],
      warnings: []
    },
    importedAt: new Date().toISOString()
  }
  await context.library.add(mod)
  await put(join(context.modsDir, name, target), name)
  await deployMod(context, gamePath, mod)
  return mod
}

async function deployedIds(): Promise<string[]> {
  return (await context.manifests.list()).map((manifest) => manifest.modId)
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ncm-purge-'))
  gamePath = join(dir, 'game')
  context = {
    modsDir: join(dir, 'mods'),
    backupsDir: join(dir, 'data', 'backups'),
    manifests: new ManifestStore(join(dir, 'data', 'manifests')),
    library: new ModLibrary(join(dir, 'data', 'mods.json'))
  }
  await put(join(gamePath, 'bin', 'x64', 'Cyberpunk2077.exe'), 'game')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('purgeMods', () => {
  it('undeploys every mod and leaves the game folder clean', async () => {
    await deployed('CET', 'bin/x64/plugins/cyber_engine_tweaks.asi', ['cet'])
    await deployed('Faster Elevators', 'archive/pc/mod/a.archive')

    expect(await purgeMods(context, 'all')).toEqual({ undeployed: 2, kept: [], failed: [] })
    expect(await deployedIds()).toEqual([])
    expect(await readdir(gamePath)).toEqual(['bin'])
    expect(context.library.list()).toHaveLength(2)
  })

  it('keeps core mods deployed when purging non-core mods', async () => {
    const cet = await deployed('CET', 'bin/x64/plugins/cyber_engine_tweaks.asi', ['cet'])
    await deployed('Faster Elevators', 'archive/pc/mod/a.archive')

    expect(await purgeMods(context, 'non-core')).toMatchObject({ undeployed: 1 })
    expect(await deployedIds()).toEqual([cet.id])
  })

  it('carries on when one mod fails and reports it', async () => {
    const broken = await deployed('Broken', 'archive/pc/mod/b.archive')
    await deployed('Faster Elevators', 'archive/pc/mod/a.archive')
    const manifest = await context.manifests.read(broken.id)
    if (!manifest) throw new Error('no manifest')
    await context.manifests.write({
      ...manifest,
      files: [{ path: '../outside.txt', source: 'x', method: 'link', backedUp: false }]
    })

    const result = await purgeMods(context, 'all')

    expect(result).toMatchObject({ undeployed: 1, failed: [{ name: 'Broken' }] })
    expect(result.failed[0].error).toMatch(/outside the game folder/)
    expect(await deployedIds()).toEqual([broken.id])
  })
})
